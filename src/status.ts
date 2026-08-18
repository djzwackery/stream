/**
 * Status dashboard driver for status.html. Polls the Twitch relay Worker's
 * `/status` endpoint and shows whether the token refresh Cron and the OBS
 * WebSocket hub both look healthy, so a dead refresh or a disconnected
 * source shows up here instead of silently failing mid-stream.
 */
(function () {
  const qs = new URLSearchParams(location.search);
  const WORKER_URL =
    qs.get("worker") || "https://zw-twitch-relay.YOUR_SUBDOMAIN.workers.dev";
  // Matches the Worker's own Cron schedule (wrangler.toml); flags the token
  // card as overdue once a refresh is later than that plus this margin.
  const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
  const STALE_MARGIN_MS = 30 * 60 * 1000;
  const POLL_MS = 15000;

  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function formatAgo(timestamp: number): string {
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    return `${Math.round(minutes / 60)}h ago`;
  }

  function setCard(
    id: string,
    state: string,
    value: string,
    detail?: string,
  ): void {
    $(`card-${id}`).dataset.state = state;
    $(`${id}-value`).textContent = value;
    const detailEl = document.getElementById(`${id}-detail`);
    if (detailEl) {
      detailEl.textContent = detail ?? "";
    }
  }

  function setUnreachable(): void {
    setCard("token", "error", "Unreachable", "Could not reach the Worker");
    setCard("redemption", "error", "Unreachable");
    setCard("clients", "error", "Unreachable");
  }

  function poll(): void {
    fetch(`${WORKER_URL}/status`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`status ${r.status}`);
        }
        return r.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!isRecord(data)) {
          throw new Error("unexpected response");
        }
        const twitch = data.twitch;
        const hub = data.hub;

        if (isRecord(twitch) && typeof twitch.lastRefreshedAt === "number") {
          const stale =
            Date.now() - twitch.lastRefreshedAt >
            REFRESH_INTERVAL_MS + STALE_MARGIN_MS;
          setCard(
            "token",
            stale ? "error" : "ok",
            stale ? "Overdue" : "Healthy",
            `Last refreshed ${formatAgo(twitch.lastRefreshedAt)}`,
          );
        } else {
          setCard(
            "token",
            "error",
            "Never refreshed",
            "No successful refresh yet",
          );
        }

        if (isRecord(hub) && typeof hub.lastBroadcastAt === "number") {
          setCard("redemption", "ok", formatAgo(hub.lastBroadcastAt));
        } else {
          setCard("redemption", "warn", "None yet this session");
        }

        if (isRecord(hub) && typeof hub.connectedClients === "number") {
          setCard(
            "clients",
            hub.connectedClients > 0 ? "ok" : "warn",
            String(hub.connectedClients),
          );
        } else {
          setCard("clients", "error", "Unknown");
        }
      })
      .catch(setUnreachable);
  }

  poll();
  setInterval(poll, POLL_MS);
})();
