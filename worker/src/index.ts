/**
 * Entry point: routes Twitch's EventSub webhook, the browser-facing
 * WebSocket hub, and the status endpoint, plus the Cron-triggered token
 * refresh. See ARCHITECTURE.md and worker/README.md for the full picture.
 */
import { Hub } from "./hub.js";
import {
  loadTokens,
  mapRedemptionEvent,
  refreshAccessToken,
  verifyWebhookSignature,
} from "./twitch.js";

export { Hub };

/**
 * Bindings and secrets configured for this Worker (`wrangler.toml` plus `wrangler secret put`).
 */
export interface Env {
  /**
   * The single global Hub Durable Object, fanning events out to connected OBS clients.
   */
  HUB: DurableObjectNamespace<Hub>;
  /**
   * KV namespace storing the current, rotating Twitch access/refresh token pair.
   */
  TOKENS: KVNamespace;
  /**
   * Twitch application Client ID.
   */
  TWITCH_CLIENT_ID: string;
  /**
   * Twitch application Client Secret, used only in this Worker's own calls to Twitch.
   */
  TWITCH_CLIENT_SECRET: string;
  /**
   * Seed refresh token from the one-time setup script; only read if KV has no stored pair yet.
   */
  TWITCH_REFRESH_TOKEN: string;
  /**
   * Shared secret configured on the EventSub subscription, verifies webhook signatures.
   */
  TWITCH_WEBHOOK_SECRET: string;
}

/**
 * Not real access control, GitHub Pages serves plain JS anyone can read, see
 * the Security model section of worker/README.md. This just stops casual
 * drive-by discovery of the endpoint from other sites.
 */
function originAllowed(request: Request): boolean {
  const origin =
    request.headers.get("Origin") ?? request.headers.get("Referer") ?? "";
  return origin.includes("djzwackery.com") || origin.includes("localhost");
}

function hub(env: Env): DurableObjectStub<Hub> {
  return env.HUB.get(env.HUB.idFromName("hub"));
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const messageId = request.headers.get("Twitch-Eventsub-Message-Id") ?? "";
  const timestamp =
    request.headers.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const signature =
    request.headers.get("Twitch-Eventsub-Message-Signature") ?? "";
  const messageType = request.headers.get("Twitch-Eventsub-Message-Type") ?? "";
  const body = await request.text();

  const valid = await verifyWebhookSignature(
    env.TWITCH_WEBHOOK_SECRET,
    messageId,
    timestamp,
    body,
    signature,
  );
  if (!valid) {
    return new Response("Invalid signature", { status: 403 });
  }

  const data = JSON.parse(body) as Record<string, unknown>;
  if (messageType === "webhook_callback_verification") {
    const challenge = data.challenge;
    return new Response(typeof challenge === "string" ? challenge : "", {
      status: 200,
    });
  }
  if (messageType === "notification") {
    const event = data.event as Record<string, unknown> | undefined;
    if (event) {
      await hub(env).broadcast(JSON.stringify(mapRedemptionEvent(event)));
    }
  }
  return new Response("", { status: 200 });
}

async function handleStatus(request: Request, env: Env): Promise<Response> {
  if (!originAllowed(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  const [tokens, hubStatus] = await Promise.all([
    loadTokens(env.TOKENS),
    hub(env).getStatus(),
  ]);
  return Response.json({
    twitch: { lastRefreshedAt: tokens?.refreshedAt ?? null },
    hub: hubStatus,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/twitch/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }
    if (url.pathname === "/ws") {
      if (!originAllowed(request)) {
        return new Response("Forbidden", { status: 403 });
      }
      return hub(env).fetch(request);
    }
    if (url.pathname === "/status") {
      return handleStatus(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await refreshAccessToken(
      env.TOKENS,
      env.TWITCH_CLIENT_ID,
      env.TWITCH_CLIENT_SECRET,
      env.TWITCH_REFRESH_TOKEN,
    );
  },
} satisfies ExportedHandler<Env>;
