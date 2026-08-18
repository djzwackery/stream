/**
 * Twitch relay driver for twitch-relay.html. Authenticates directly against
 * Twitch (implicit grant OAuth, no server-side secret) and subscribes to
 * Channel Point redemptions over Twitch's EventSub WebSocket, forwarding
 * them into every alerts.html/redemptions.html source on this origin, over
 * the same BroadcastChannel + localStorage channel control.html uses.
 *
 * This exists because Streamlabs' Socket API (streamlabs-relay.ts) doesn't
 * relay Channel Point redemptions at all, only Twitch itself does.
 *
 * Implicit grant tokens expire in a few hours (Twitch doesn't issue a
 * refresh token for this flow), so reconnecting just means clicking
 * "Connect with Twitch" again, there's no long-lived secret to manage. The
 * status line always shows the expiry time and switches to an "expiring
 * soon" warning near the end, rather than silently going dead mid-stream.
 */
(function () {
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  const CLIENT_ID_KEY = "twitch-client-id";
  const TOKEN_KEY = "twitch-token";
  const STATE_KEY = "twitch-oauth-state";
  const EVENTSUB_URL =
    "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
  const KEEPALIVE_MS = 40000;

  /**
   * A validated Twitch user token, persisted across reloads until it expires.
   */
  interface StoredToken {
    /**
     * The bearer token itself.
     */
    token: string;
    /**
     * The broadcaster's numeric Twitch user ID, needed for the subscription condition.
     */
    userId: string;
    /**
     * The broadcaster's Twitch login, shown in the status line.
     */
    login: string;
    /**
     * When this token stops being valid, as a `Date.now()`-comparable timestamp.
     */
    expiresAt: number;
  }

  function redirectUri(): string {
    return location.origin + location.pathname;
  }

  function loadToken(): StoredToken | null {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        isRecord(parsed) &&
        typeof parsed.token === "string" &&
        typeof parsed.userId === "string" &&
        typeof parsed.login === "string" &&
        typeof parsed.expiresAt === "number"
      ) {
        return parsed as unknown as StoredToken;
      }
    } catch {
      // malformed localStorage value, treat as absent
    }
    return null;
  }

  function setStatus(state: string, text: string): void {
    const el = $("status");
    el.dataset.state = state;
    el.textContent = text;
  }

  function formatClockTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const EXPIRY_WARNING_MS = 30 * 60 * 1000;

  function startAuth(clientId: string): void {
    localStorage.setItem(CLIENT_ID_KEY, clientId);
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem(STATE_KEY, state);
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "token");
    url.searchParams.set("scope", "channel:read:redemptions");
    url.searchParams.set("state", state);
    location.href = url.href;
  }

  function validateAndStore(token: string): void {
    setStatus("connecting", "Validating token…");
    fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: `OAuth ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Twitch rejected that token");
        }
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        if (
          !isRecord(data) ||
          typeof data.user_id !== "string" ||
          typeof data.expires_in !== "number"
        ) {
          throw new Error("unexpected response from /oauth2/validate");
        }
        const stored: StoredToken = {
          token,
          userId: data.user_id,
          login: typeof data.login === "string" ? data.login : "",
          expiresAt: Date.now() + data.expires_in * 1000,
        };
        localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
        startEventSub(stored);
      })
      .catch((err: unknown) => {
        setStatus("error", `Error: ${String(err)}, try connecting again.`);
      });
  }

  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel("zw-alerts");
  } catch {
    // BroadcastChannel unsupported. The localStorage fallback below still reaches alerts.html
  }
  function forward(raw: RawAlertPayload): void {
    const o: RawAlertPayload = { ...raw, at: Date.now() };
    bc?.postMessage(o);
    try {
      localStorage.setItem("zw-alert", JSON.stringify(o));
    } catch {
      // storage unavailable (private browsing etc.). BroadcastChannel already carried it
    }
  }

  let clientId = "";
  let socket: WebSocket | null = null;
  let generation = 0;
  let lastMessageAt = 0;
  let currentStored: StoredToken | null = null;

  function startEventSub(stored: StoredToken): void {
    currentStored = stored;
    clientId = localStorage.getItem(CLIENT_ID_KEY) ?? "";
    openSocket(EVENTSUB_URL, stored);
  }

  function openSocket(
    url: string,
    stored: StoredToken,
    handoffFrom?: WebSocket,
  ): void {
    const myGeneration = ++generation;
    setStatus(
      "connecting",
      handoffFrom ? "Reconnecting…" : "Connecting to EventSub…",
    );
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      lastMessageAt = Date.now();
      handleMessage(myGeneration, String(ev.data), stored, handoffFrom);
    };
    ws.onclose = () => {
      if (myGeneration !== generation) {
        return;
      }
      setStatus("idle", "Disconnected, reconnecting…");
      setTimeout(() => openSocket(EVENTSUB_URL, stored), 2000);
    };
    socket = ws;
  }

  function handleMessage(
    myGeneration: number,
    raw: string,
    stored: StoredToken,
    handoffFrom: WebSocket | undefined,
  ): void {
    if (myGeneration !== generation) {
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      !isRecord(data) ||
      !isRecord(data.metadata) ||
      !isRecord(data.payload)
    ) {
      return;
    }
    const messageType = data.metadata.message_type;
    const payload = data.payload;

    if (messageType === "session_welcome") {
      handoffFrom?.close();
      const session = payload.session;
      if (isRecord(session) && typeof session.id === "string") {
        subscribeToRedemptions(stored, session.id);
      }
    } else if (messageType === "session_reconnect") {
      const session = payload.session;
      if (isRecord(session) && typeof session.reconnect_url === "string") {
        openSocket(session.reconnect_url, stored, socket ?? undefined);
      }
    } else if (messageType === "notification") {
      const event = payload.event;
      if (!isRecord(event) || !isRecord(event.reward)) {
        return;
      }
      forward({
        type: "redeem",
        name: typeof event.user_name === "string" ? event.user_name : "someone",
        reward:
          typeof event.reward.title === "string"
            ? event.reward.title
            : undefined,
        cost:
          typeof event.reward.cost === "number" ? event.reward.cost : undefined,
        message:
          typeof event.user_input === "string" && event.user_input
            ? event.user_input
            : undefined,
      });
    }
  }

  function subscribeToRedemptions(
    stored: StoredToken,
    sessionId: string,
  ): void {
    fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stored.token}`,
        "Client-Id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "channel.channel_points_custom_reward_redemption.add",
        version: "1",
        condition: { broadcaster_user_id: stored.userId },
        transport: { method: "websocket", session_id: sessionId },
      }),
    })
      .then((res) => {
        if (res.status === 401) {
          throw new Error(
            "Twitch rejected the token, it's likely expired, click Connect with Twitch again",
          );
        }
        if (!res.ok) {
          throw new Error(`Twitch rejected the subscription (${res.status})`);
        }
        updateConnectedStatus(stored);
      })
      .catch((err: unknown) => {
        setStatus("error", `Error: ${String(err)}`);
      });
  }

  function updateConnectedStatus(stored: StoredToken): void {
    const msRemaining = stored.expiresAt - Date.now();
    const who = stored.login || stored.userId;
    if (msRemaining <= 0) {
      setStatus("idle", "Token expired, click Connect with Twitch again.");
      return;
    }
    if (msRemaining <= EXPIRY_WARNING_MS) {
      setStatus(
        "expiring",
        `Connected as ${who}, but the token expires soon, around ${formatClockTime(stored.expiresAt)}. Reconnect before you go live: click Connect with Twitch again.`,
      );
      return;
    }
    setStatus(
      "connected",
      `Connected as ${who}, listening for redemptions. Token expires around ${formatClockTime(stored.expiresAt)}.`,
    );
  }

  setInterval(() => {
    if (
      socket &&
      lastMessageAt !== 0 &&
      Date.now() - lastMessageAt > KEEPALIVE_MS
    ) {
      socket.close();
    }
    const currentState = $("status").dataset.state;
    if (
      currentStored &&
      (currentState === "connected" || currentState === "expiring")
    ) {
      updateConnectedStatus(currentStored);
    }
  }, 30000);

  $("redirect-uri").textContent = redirectUri();

  $<HTMLButtonElement>("connect").onclick = () => {
    const clientIdValue = $<HTMLInputElement>("client-id").value.trim();
    if (!clientIdValue) {
      setStatus("error", "Paste your Twitch application's Client ID first.");
      return;
    }
    startAuth(clientIdValue);
  };

  const savedClientId = localStorage.getItem(CLIENT_ID_KEY);
  if (savedClientId) {
    $<HTMLInputElement>("client-id").value = savedClientId;
  }

  const hashParams = new URLSearchParams(location.hash.slice(1));
  const hashToken = hashParams.get("access_token");
  if (hashToken) {
    const expectedState = sessionStorage.getItem(STATE_KEY);
    history.replaceState(null, "", location.pathname + location.search);
    if (hashParams.get("state") !== expectedState) {
      setStatus("error", "OAuth state mismatch, try connecting again.");
    } else {
      validateAndStore(hashToken);
    }
  } else if (hashParams.get("error")) {
    setStatus(
      "error",
      `Twitch: ${hashParams.get("error_description") || hashParams.get("error")}`,
    );
  } else {
    const saved = loadToken();
    if (saved) {
      if (saved.expiresAt <= Date.now()) {
        setStatus("idle", "Token expired, click Connect with Twitch again.");
      } else {
        startEventSub(saved);
      }
    }
  }
})();
