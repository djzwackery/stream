/**
 * Entry point: routes Twitch's EventSub webhook, the browser-facing
 * WebSocket hub, and the status endpoint, plus the Cron-triggered token
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
   * Bearer token gating `/twitch/avatar`, shared out-of-band with whoever pastes the
   * Streamlabs Alert Box code (see worker/README.md), not something the public ever sees.
   */
  AVATAR_API_TOKEN: string;
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
  return Response.json(
    {
      twitch: { lastRefreshedAt: tokens?.refreshedAt ?? null },
      hub: hubStatus,
    },
    // Without this, status.html's cross-origin fetch (djzwackery.com calling
    // a *.workers.dev origin) gets rejected client-side before it can even
    // read the 200: the origin check above decides *whether* to answer,
    // this header is what lets a browser accept an answer it already
    // decided to give. Echoes the caller's own origin back rather than a
    // static value: it's only ever reached after passing originAllowed, so
    // this never widens who the origin check itself accepts.
    {
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "",
      },
    },
  );
}

const LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,25}$/;

// Open to any origin, matching handleAvatar's own lack of an origin check
// (see its doc below); every response here carries this, including the
// error paths, without it a rejected request (bad login, rate limited)
// fails as an opaque network error client-side instead of a readable
// status the caller can branch on.
const AVATAR_CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

/**
 * Resolves a Twitch login to their current avatar URL, for the Streamlabs
 * Alert Box driver, which gets no reliable avatar token from Streamlabs
 * itself. Not origin-gated like `/ws` and `/status`: the Alert Box widget
 * runs on a Streamlabs-controlled origin, not djzwackery.com, so
 * `Origin`/`Referer` checking against our own domain isn't meaningful
 * here. Gated instead on `AVATAR_API_TOKEN`, a bearer token shared
 * out-of-band with whoever pastes the Streamlabs code (never committed,
 * never present in the public bundle, see `AVATAR_API_TOKEN`'s doc in
 * `src/streamlabs-alertbox.ts`), plus an IP-keyed rate limit
 * (`AVATAR_RATE_LIMITER`, `wrangler.toml`) as a second layer, since even a
 * token that leaks out of one streamer's own Streamlabs setup shouldn't
 * turn this into an unmetered proxy to Twitch's API.
 */
async function handleAvatar(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  if (!timingSafeEqual(auth, `Bearer ${env.AVATAR_API_TOKEN}`)) {
    return new Response("Forbidden", {
      status: 403,
      headers: AVATAR_CORS_HEADERS,
    });
  }
  const login = new URL(request.url).searchParams.get("login") ?? "";
  if (!LOGIN_PATTERN.test(login)) {
    return new Response("Invalid login", {
      status: 400,
      headers: AVATAR_CORS_HEADERS,
    });
  }
  // No origin check to key a rate limit off, so this keys off the caller's
  // IP instead, the standard fallback for an endpoint anyone can call.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.AVATAR_RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return new Response("Too many requests", {
      status: 429,
      headers: AVATAR_CORS_HEADERS,
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
        ...AVATAR_CORS_HEADERS,
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

/**
 * Forces the token refresh the Cron would otherwise only run every 3
 * hours: `wrangler secret put` alone doesn't populate KV, only a
 * successful refresh does, so right after the one-time setup there's
 * nothing in KV yet for `/status`/`/twitch/avatar` to read until either
 * this runs once or the Cron eventually fires on its own. Also useful
 * later if a refresh ever gets stuck and needs retrying without waiting.
 * Gated on `TWITCH_WEBHOOK_SECRET` as a bearer token, not origin-checked:
 * this is meant to be curled from a terminal, which sends no Origin.
 */
async function handleRefresh(request: Request, env: Env): Promise<Response> {
  if (
    request.headers.get("Authorization") !==
    `Bearer ${env.TWITCH_WEBHOOK_SECRET}`
  ) {
    return new Response("Forbidden", { status: 403 });
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
    if (url.pathname === "/status") {
      return handleStatus(request, env);
    }
    if (url.pathname === "/twitch/avatar") {
      // The browser sends this itself, to ask permission before the real
      // GET, because that GET carries a custom `Authorization` header
      // (any non-"simple" header triggers a CORS preflight). A preflight
      // never carries the real header it's asking about, so it must be
      // answered here, before handleAvatar's own token check, or every
      // avatar lookup fails as a blocked preflight before the actual
      // request is ever sent, regardless of whether the token is right.
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            ...AVATAR_CORS_HEADERS,
            "Access-Control-Allow-Headers": "Authorization",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Max-Age": "86400",
          },
        });
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
