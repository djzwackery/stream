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
    throw new Error(`Twitch token refresh failed (${res.status})`);
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

function timingSafeEqual(a: string, b: string): boolean {
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
