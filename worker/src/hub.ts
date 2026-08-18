import { DurableObject } from "cloudflare:workers";

/**
 * Status snapshot exposed via `GET /status`, polled by `status.html`.
 */
export interface HubStatus {
  /**
   * Number of WebSocket clients (OBS browser sources) currently connected.
   */
  connectedClients: number;
  /**
   * When the most recent event was broadcast, or null if none yet this session.
   */
  lastBroadcastAt: number | null;
}

/**
 * A single global Durable Object holding every connected OBS client's
 * WebSocket and fanning out whatever `index.ts` broadcasts to it. Uses the
 * WebSocket Hibernation API (`acceptWebSocket`, not a plain `addEventListener`)
 * so an idle connection, which is most of the time, isn't billed.
 */
export class Hub extends DurableObject {
  private lastBroadcastAt: number | null = null;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(): void {
    // Clients don't send anything meaningful, this hub only broadcasts outward.
  }

  webSocketClose(ws: WebSocket): void {
    ws.close();
  }

  webSocketError(ws: WebSocket): void {
    ws.close();
  }

  broadcast(payloadJson: string): void {
    this.lastBroadcastAt = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(payloadJson);
    }
  }

  getStatus(): HubStatus {
    return {
      connectedClients: this.ctx.getWebSockets().length,
      lastBroadcastAt: this.lastBroadcastAt,
    };
  }
}
