/**
 * Entry point: routes Twitch's EventSub webhook, the browser-facing
 * WebSocket hub, and the avatar lookup, plus the Cron-triggered token
 * refresh. See ARCHITECTURE.md and worker/README.md for the full picture.
 */
import { Hub } from "./hub.js";
import {
  getUserAvatar,
  loadTokens,
  mapRedemptionEvent,
  refreshAccessToken,
  timingSafeEqual,
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
  /**
   * Caps `/twitch/avatar` requests per IP, the one endpoint with no origin check.
   */
  AVATAR_RATE_LIMITER: RateLimit;
  /**
   * Bearer token gating `/twitch/avatar` and `/twitch/refresh`, see the Security model
   * section of worker/README.md.
   */
  API_TOKEN: string;
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

const LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,25}$/;

// Token-gated endpoints rely on the token, not the origin, so this is open
// to any origin; without it a rejected request fails as an opaque network
// error client-side instead of a readable status the caller can branch on.
const API_CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

/**
 * Shared bearer-token gate for `/twitch/avatar` and `/twitch/refresh`, see
 * the Security model section of worker/README.md for why `/ws` and
 * `/twitch/webhook` use different mechanisms instead.
 */
function requireApiToken(request: Request, env: Env): Response | null {
  const auth = request.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(auth, `Bearer ${env.API_TOKEN}`)) {
    return new Response("Forbidden", {
      status: 403,
      headers: API_CORS_HEADERS,
    });
  }
  return null;
}

/**
 * Answers a token-gated endpoint's CORS preflight: a preflight never carries
 * the real `Authorization` header it's asking permission to send, so it has
 * to pass before the real handler's own token check ever runs.
 */
function corsPreflight(methods: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...API_CORS_HEADERS,
      "Access-Control-Allow-Headers": "Authorization",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Resolves a Twitch login to their avatar URL for the Streamlabs Alert Box
 * driver, which gets no reliable avatar token from Streamlabs itself. See
 * the Security model section of worker/README.md for why this skips the
 * origin check and relies on `API_TOKEN` plus `AVATAR_RATE_LIMITER` instead.
 */
async function handleAvatar(request: Request, env: Env): Promise<Response> {
  const denied = requireApiToken(request, env);
  if (denied) {
    return denied;
  }
  const login = new URL(request.url).searchParams.get("login") ?? "";
  if (!LOGIN_PATTERN.test(login)) {
    return new Response("Invalid login", {
      status: 400,
      headers: API_CORS_HEADERS,
    });
  }
  // No origin to key a rate limit off, so this uses the caller's IP instead.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.AVATAR_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return new Response("Too many requests", {
      status: 429,
      headers: API_CORS_HEADERS,
    });
  }
  const tokens = await loadTokens(env.TOKENS);
  const avatarUrl = tokens
    ? await getUserAvatar(
        env.TOKENS,
        env.TWITCH_CLIENT_ID,
        tokens.accessToken,
        login,
      )
    : null;
  return Response.json(
    { avatarUrl },
    {
      headers: {
        ...API_CORS_HEADERS,
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

/**
 * Forces the token refresh the Cron otherwise only runs every 3 hours:
 * useful right after setup, before KV has anything in it yet, or any time
 * a refresh gets stuck and needs retrying without waiting. Meant to be
 * curled from a terminal.
 */
async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const denied = requireApiToken(request, env);
  if (denied) {
    return denied;
  }
  try {
    const tokens = await refreshAccessToken(
      env.TOKENS,
      env.TWITCH_CLIENT_ID,
      env.TWITCH_CLIENT_SECRET,
      env.TWITCH_REFRESH_TOKEN,
    );
    return Response.json({ refreshedAt: tokens.refreshedAt });
  } catch (err) {
    return new Response(
      `Refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }
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
    if (url.pathname === "/twitch/avatar") {
      if (request.method === "OPTIONS") {
        return corsPreflight("GET");
      }
      return handleAvatar(request, env);
    }
    if (url.pathname === "/twitch/refresh" && request.method === "POST") {
      return handleRefresh(request, env);
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
