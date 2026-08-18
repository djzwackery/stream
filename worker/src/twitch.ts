/**
 * Twitch-specific helpers: verifying EventSub webhook signatures, mapping a
 * verified redemption notification into the JSON this repo's alert drivers
 * expect, and refreshing the access token via its refresh token. The
 * rotated pair lives in KV, not in a Worker secret: secrets set via
 * `wrangler secret put` are immutable at runtime, but a refresh token has
 * to be re-stored after every use since Twitch rotates it each time. The
 * secret only ever seeds the very first refresh.
 */

/**
 * The Twitch access/refresh token pair currently in use.
 */
export interface StoredTwitchTokens {
  /**
   * Current user access token, used to authenticate Helix API calls.
   */
  accessToken: string;
  /**
   * Current refresh token, exchanged for the next access/refresh pair.
   */
  refreshToken: string;
  /**
   * When this pair was obtained, as a `Date.now()`-comparable timestamp.
   */
  refreshedAt: number;
}

const KV_KEY = "twitch-tokens";

export async function loadTokens(
  kv: KVNamespace,
): Promise<StoredTwitchTokens | null> {
  const raw = await kv.get(KV_KEY);
  return raw ? (JSON.parse(raw) as StoredTwitchTokens) : null;
}

async function saveTokens(
  kv: KVNamespace,
  tokens: StoredTwitchTokens,
): Promise<void> {
  await kv.put(KV_KEY, JSON.stringify(tokens));
}

/**
 * The subset of Twitch's `/oauth2/token` refresh response this repo reads.
 */
interface TwitchTokenResponse {
  /**
   * The new access token.
   */
  access_token: string;
  /**
   * The new refresh token; Twitch rotates this on every use, so the old one stops working.
   */
  refresh_token: string;
}

export async function refreshAccessToken(
  kv: KVNamespace,
  clientId: string,
  clientSecret: string,
  seedRefreshToken: string,
): Promise<StoredTwitchTokens> {
  const current = await loadTokens(kv);
  const refreshToken = current?.refreshToken ?? seedRefreshToken;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Twitch token refresh failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as TwitchTokenResponse;
  const tokens: StoredTwitchTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    refreshedAt: Date.now(),
  };
  await saveTokens(kv, tokens);
  return tokens;
}

/**
 * Constant-time string comparison, so a mismatch's response timing can't
 * leak how many leading characters of a secret were guessed correctly.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies Twitch's `Twitch-Eventsub-Message-Signature` header: HMAC-SHA256
 * over the message id, timestamp, and raw body, keyed by the subscription's
 * configured secret. See dev.twitch.tv/docs/eventsub/handling-webhook-events.
 */
export async function verifyWebhookSignature(
  secret: string,
  messageId: string,
  timestamp: string,
  body: string,
  signature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(messageId + timestamp + body),
  );
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(`sha256=${hex}`, signature);
}

/**
 * The subset of a Helix `/users` response this repo reads.
 */
interface TwitchUserResponse {
  /**
   * One entry per requested login; empty if the login doesn't exist.
   */
  data: { profile_image_url?: string }[];
}

const AVATAR_CACHE_TTL_SECONDS = 60 * 60 * 24;
// Bump this to invalidate every cached avatar at once (e.g. after a bad
// batch got cached before a bug fix): old entries become unreachable under
// the new prefix and just expire off their own TTL, no KV cleanup needed.
const AVATAR_CACHE_VERSION = "v2";

/**
 * Looks up a Twitch user's current profile image by login name, so the
 * Streamlabs Alert Box driver (which gets no reliable avatar token from
 * Streamlabs itself) can show a real photo. Caches a real result in KV
 * (including a genuine "not found", as an empty string) since the same
 * regulars redeem/follow repeatedly and avatars rarely change: a cache hit
 * costs one KV read instead of a Helix round trip. A failed request (an
 * expired access token, a Helix hiccup) isn't cached: caching that would
 * turn one transient failure into a full day of false "no avatar" for that
 * login, long after the underlying problem is gone.
 */
export async function getUserAvatar(
  kv: KVNamespace,
  clientId: string,
  accessToken: string,
  login: string,
): Promise<string | null> {
  const cacheKey = `avatar:${AVATAR_CACHE_VERSION}:${login.toLowerCase()}`;
  const cached = await kv.get(cacheKey);
  if (cached !== null) {
    return cached || null;
  }
  const res = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": clientId,
      },
    },
  );
  if (!res.ok) {
    return null;
  }
  const avatarUrl = ((await res.json()) as TwitchUserResponse).data[0]
    ?.profile_image_url;
  await kv.put(cacheKey, avatarUrl ?? "", {
    expirationTtl: AVATAR_CACHE_TTL_SECONDS,
  });
  return avatarUrl ?? null;
}

/**
 * The fields this repo reads from a `channel.channel_points_custom_reward_redemption.add`
 * EventSub notification's `event` object.
 */
export interface TwitchRedemptionEvent {
  /**
   * The redeeming viewer's Twitch display name.
   */
  user_name?: string;
  /**
   * Free-text input the viewer typed when redeeming, if the reward asks for one.
   */
  user_input?: string;
  /**
   * The redeemed reward's details.
   */
  reward?: {
    /**
     * The reward's configured title, matched against `rewards.json` by `zw-alerts.ts`.
     */
    title?: string;
    /**
     * The reward's point cost.
     */
    cost?: number;
  };
}

/**
 * Maps a verified redemption notification into the JSON shape this repo's
 * `RawAlertPayload` (`src/types/global.d.ts`) expects for a `redeem` event.
 * Kept as a plain object rather than importing that type: this Worker is a
 * separate TypeScript project from the browser code, they only share JSON
 * over the wire, not types.
 */
export function mapRedemptionEvent(
  event: TwitchRedemptionEvent,
): Record<string, unknown> {
  return {
    type: "redeem",
    name: event.user_name || "someone",
    reward: event.reward?.title,
    cost: event.reward?.cost,
    message: event.user_input || undefined,
    at: Date.now(),
  };
}
