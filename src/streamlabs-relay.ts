/**
 * Streamlabs relay driver for streamlabs-relay.html. Connects to the
 * Streamlabs Socket API and forwards follow/subscription/bits/raid/donation
 * events into every alerts.html source on this origin, over the same
 * BroadcastChannel + localStorage channel control.html uses (see
 * zw-alerts.ts's "control.html on the same origin" input).
 *
 * Twitch Channel Point redemptions aren't included: Streamlabs' Socket API
 * doesn't relay them at all, so redemptions.html has no live source here.
 * Streamlabs' events also carry no avatar image, unlike StreamElements'.
 *
 * The socket server speaks the Socket.IO v2 protocol, so the self-hosted
 * client in js/vendor/socket.io.js (copied from socket.io-client, pinned to
 * 2.x in package.json) has to stay on that major version; a v3/v4 client
 * can't complete the handshake against it.
 */

/**
 * A live connection returned by the self-hosted Socket.IO v2 client.
 */
interface StreamlabsSocket {
  /**
   * Registers a handler for a named socket event: "connect", "disconnect", "event", or "error".
   */
  on: (event: string, handler: (data: unknown) => void) => void;
}
declare const io: (
  uri: string,
  opts?: Record<string, unknown>,
) => StreamlabsSocket;

(function () {
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  /**
   * One entry in a Streamlabs donation event's `message` array.
   */
  interface StreamlabsDonation {
    /**
     * Display name of the donor.
     */
    name: string;
    /**
     * Donation amount, as a number in `currency`.
     */
    amount: number;
    /**
     * ISO currency code, e.g. "USD".
     */
    currency: string;
    /**
     * Message left with the donation, if any.
     */
    message?: string;
  }

  /**
   * One entry in a Streamlabs Twitch follow event's `message` array.
   */
  interface StreamlabsFollow {
    /**
     * The follower's Twitch username.
     */
    name: string;
  }

  /**
   * One entry in a Streamlabs Twitch subscription event's `message` array.
   */
  interface StreamlabsSubscription {
    /**
     * The subscriber's Twitch username.
     */
    name: string;
    /**
     * Cumulative months subscribed.
     */
    months: number;
    /**
     * Twitch sub tier code, e.g. "1000"/"2000"/"3000", or "Prime".
     */
    sub_plan: string;
    /**
     * "sub" or "resub" for a normal (re)subscription, a value containing "gift" for a gifted one.
     */
    sub_type: string;
    /**
     * Message left with the (re)subscription, if any.
     */
    message?: string;
  }

  /**
   * One entry in a Streamlabs Twitch bits event's `message` array.
   */
  interface StreamlabsBits {
    /**
     * The cheerer's Twitch username.
     */
    name: string;
    /**
     * Number of bits cheered.
     */
    amount: number;
    /**
     * Message left with the cheer, if any.
     */
    message?: string;
  }

  /**
   * One entry in a Streamlabs Twitch raid event's `message` array.
   */
  interface StreamlabsRaid {
    /**
     * The raiding channel's Twitch username.
     */
    name: string;
    /**
     * Size of the raiding party.
     */
    raiders: number;
  }

  /**
   * A Streamlabs Socket API event envelope. `type` selects which shape
   * `message`'s entries have; `for` names the source platform account and is
   * absent on platform-agnostic events like donations.
   */
  interface StreamlabsEvent {
    /**
     * Which kind of event this is, e.g. "donation", "follow", "subscription", "bits", "raid".
     */
    type: string;
    /**
     * Source platform account, e.g. "twitch_account"; absent for donations.
     */
    for?: string;
    /**
     * One or more event payloads batched into this message.
     */
    message?: unknown[];
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

  function handleEvent(data: unknown): void {
    if (!isRecord(data) || typeof data.type !== "string") {
      return;
    }
    const evt = data as unknown as StreamlabsEvent;
    const messages = Array.isArray(evt.message) ? evt.message : [];

    if (evt.type === "donation") {
      for (const raw of messages) {
        if (!isRecord(raw)) {
          continue;
        }
        const m = raw as unknown as StreamlabsDonation;
        forward({
          type: "tip",
          name: m.name,
          value: m.amount,
          currency: m.currency,
          message: m.message || undefined,
        });
      }
      return;
    }

    if (evt.for !== "twitch_account") {
      return;
    }
    if (evt.type === "follow") {
      for (const raw of messages) {
        if (!isRecord(raw)) {
          continue;
        }
        const m = raw as unknown as StreamlabsFollow;
        forward({ type: "follow", name: m.name });
      }
    } else if (evt.type === "subscription") {
      for (const raw of messages) {
        if (!isRecord(raw)) {
          continue;
        }
        const m = raw as unknown as StreamlabsSubscription;
        forward({
          type: "sub",
          name: m.name,
          value: m.months,
          plan: m.sub_plan.replace("000", ""),
          message: m.message || undefined,
          gifted: (m.sub_type || "").includes("gift") ? 1 : 0,
        });
      }
    } else if (evt.type === "bits") {
      for (const raw of messages) {
        if (!isRecord(raw)) {
          continue;
        }
        const m = raw as unknown as StreamlabsBits;
        forward({
          type: "bits",
          name: m.name,
          value: m.amount,
          message: m.message || undefined,
        });
      }
    } else if (evt.type === "raid") {
      for (const raw of messages) {
        if (!isRecord(raw)) {
          continue;
        }
        const m = raw as unknown as StreamlabsRaid;
        forward({ type: "raid", name: m.name, value: m.raiders });
      }
    }
  }

  function setStatus(state: string, text: string): void {
    const el = $("status");
    el.dataset.state = state;
    el.textContent = text;
  }

  function connect(token: string): void {
    if (!token) {
      setStatus("error", "Paste your Streamlabs Socket API token first.");
      return;
    }
    localStorage.setItem("streamlabs-token", token);
    setStatus("connecting", "Connecting…");
    const socket = io(
      `https://sockets.streamlabs.com?token=${encodeURIComponent(token)}`,
      { transports: ["websocket"] },
    );
    socket.on("connect", () => setStatus("connected", "Connected."));
    socket.on("disconnect", () => setStatus("idle", "Disconnected, retrying…"));
    socket.on("error", (err) => setStatus("error", `Error: ${String(err)}`));
    socket.on("event", handleEvent);
  }

  $<HTMLButtonElement>("connect").onclick = () => {
    connect($<HTMLInputElement>("token").value.trim());
  };

  const saved = localStorage.getItem("streamlabs-token");
  if (saved) {
    $<HTMLInputElement>("token").value = saved;
    connect(saved);
  }
})();
