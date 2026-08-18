# Twitch relay Worker 📡

A small Cloudflare Worker that relays Twitch Channel Point redemptions to `redemptions.html` and
looks up real Twitch avatars for the Streamlabs Alert Box driver, so a streamer using this repo
never has to hold a Twitch token themselves or reconnect anything before going live. See the root
[README.md](../README.md#-wiring-real-events) for how this fits into the rest of the repo; this
file is the deploy-it-once checklist and the security write-up.

```
Twitch  --(EventSub webhook, HMAC-signed POST)-->  Worker  --(broadcast)-->  Hub (Durable Object)  --(WebSocket)-->  redemptions.html
Twitch  --(refresh_token grant, via Cron every 3h)-->  Worker  (keeps the access token alive forever, never touches the browser)
Twitch  <--(GET /helix/users, cached in KV)--  Worker  <--(GET /twitch/avatar?login=X)--  streamlabs-alertbox.ts (in Streamlabs' widget)
```

This is a separate deployable project from the rest of the repo: its own `package.json`,
`tsconfig.json` and `wrangler.toml`, deployed independently by
[`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml), not touched by
`npm run build`/`deploy.yml` at the repo root. Root `npm run check`/`format` still sweep
`worker/**/*.ts` for Prettier, but nothing here is linted by the root `eslint.config.js`.

## ⚙️ One-time setup

Only needs doing once per deployment, not per stream.

1. **Install dependencies.**

   ```bash
   cd worker
   npm install
   ```

2. **Register a Twitch application**, if you don't already have one, at
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps). Any name; category
   "Application Integration" is fine. Add `http://localhost:3939/callback` to its **OAuth Redirect
   URLs**, that's what the one-time auth script in the next step uses; you can remove it again
   afterwards. Note the **Client ID** and **Client Secret**.

3. **Create the KV namespace** that stores the rotating Twitch token pair:

   ```bash
   npx wrangler kv namespace create TOKENS
   ```

   Paste the `id` it prints into `wrangler.toml`'s `[[kv_namespaces]]` block, replacing
   `REPLACE_WITH_KV_NAMESPACE_ID`.

4. **Get the first refresh token.** From the repo root:

   ```bash
   npm run twitch:auth
   ```

   This runs [`scripts/twitch-onetime-auth.mjs`](../scripts/twitch-onetime-auth.mjs): it prompts for
   the Client ID/Secret from step 2, opens a Twitch authorization URL for you to approve in a
   browser, catches the redirect on a temporary local server, and exchanges the code for the first
   access/refresh token pair. Your Client Secret is only ever sent directly to Twitch's own token
   endpoint from your machine here, never committed or transmitted anywhere else. It prints the
   `wrangler secret put` commands for the next step, pre-filled with the values you'll need.

5. **Set the Worker's secrets** (from `worker/`, values from the previous step):

   ```bash
   npx wrangler secret put TWITCH_CLIENT_ID
   npx wrangler secret put TWITCH_CLIENT_SECRET
   npx wrangler secret put TWITCH_REFRESH_TOKEN
   npx wrangler secret put TWITCH_WEBHOOK_SECRET
   npx wrangler secret put API_TOKEN
   ```

   | Secret                  | Where it comes from                              |
   | ----------------------- | ------------------------------------------------ |
   | `TWITCH_CLIENT_ID`      | The Twitch application (step 2).                 |
   | `TWITCH_CLIENT_SECRET`  | The Twitch application (step 2).                 |
   | `TWITCH_REFRESH_TOKEN`  | The auth script's output (step 4).               |
   | `TWITCH_WEBHOOK_SECRET` | Invent it yourself, e.g. `openssl rand -hex 32`. |
   | `API_TOKEN`             | Invent it yourself, e.g. `openssl rand -hex 32`. |

   `TWITCH_WEBHOOK_SECRET` is reused in step 7 below: Twitch signs every webhook delivery with it
   so the Worker can tell a real notification from a forged one. `API_TOKEN` gates two endpoints,
   `/twitch/avatar` and `/twitch/refresh` (see the Security model section below): give it to
   whoever's pasting the Streamlabs Alert Box code, they paste it into the JS box in place of the
   `PASTE_YOUR_API_TOKEN_HERE` placeholder ([`src/streamlabs-alertbox.ts`](../src/streamlabs-alertbox.ts))
   before it goes into Streamlabs (`control.html`'s own **API Token** field does this substitution
   for you and remembers it on that browser), and keep it yourself for curling `/twitch/refresh`
   directly if you ever need to.

6. **Deploy:**

   > [!IMPORTANT]
   > If this Cloudflare account has never deployed a Worker before, do this part interactively,
   > from your own terminal, once, before wiring up CI: `npx wrangler login` (opens a browser),
   > then `npx wrangler deploy`. It'll ask _"Would you like to register a workers.dev subdomain
   > now?"_, answer yes and pick one, that's a permanent, account-wide, one-time choice, which is
   > why it's a prompt rather than something `deploy-worker.yml` could do unattended in CI (a
   > non-interactive `wrangler deploy` just fails with "You need to register a workers.dev
   > subdomain" if this hasn't happened yet). Once it's registered, every deploy after this,
   > interactive or not, just works.

   ```bash
   npm run deploy
   ```

   Note the `*.workers.dev` URL it prints (or find it later on the Cloudflare dashboard). Update the
   fallback URL in two places at the repo root, [`src/zw-alerts.ts`](../src/zw-alerts.ts)'s
   `REDEMPTION_HUB_URL` and [`src/streamlabs-alertbox.ts`](../src/streamlabs-alertbox.ts)'s
   `AVATAR_LOOKUP_URL`, replacing `YOUR_SUBDOMAIN` with your actual one, then `npm run build` and
   push, so `redemptions.html` and the Streamlabs Alert Box code (avatar lookups) both connect to
   the right place without anyone needing to add a `?worker=` query string by hand.

   For automatic redeploys on every future `worker/**` push, add
   `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` as repo secrets (**Settings → Secrets and
   variables → Actions**): an API token with the "Edit Cloudflare Workers" template is enough, and
   the account ID is on the Cloudflare dashboard's right sidebar.

7. **Create the EventSub subscription**, pointing Twitch at the deployed webhook. This needs an
   [app access token](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)
   (not the user token from step 4) and your numeric broadcaster user ID:

   ```bash
   # App access token
   curl -s -X POST 'https://id.twitch.tv/oauth2/token' \
     -d "client_id=$TWITCH_CLIENT_ID" \
     -d "client_secret=$TWITCH_CLIENT_SECRET" \
     -d 'grant_type=client_credentials'
   # -> use the access_token below as $APP_TOKEN

   # Broadcaster user id, for your own channel login name
   curl -s 'https://api.twitch.tv/helix/users?login=YOUR_CHANNEL_NAME' \
     -H "Authorization: Bearer $APP_TOKEN" -H "Client-Id: $TWITCH_CLIENT_ID"
   # -> use the "id" field below as $BROADCASTER_ID

   curl -s -X POST 'https://api.twitch.tv/helix/eventsub/subscriptions' \
     -H "Authorization: Bearer $APP_TOKEN" -H "Client-Id: $TWITCH_CLIENT_ID" \
     -H 'Content-Type: application/json' \
     -d '{
       "type": "channel.channel_points_custom_reward_redemption.add",
       "version": "1",
       "condition": { "broadcaster_user_id": "'"$BROADCASTER_ID"'" },
       "transport": {
         "method": "webhook",
         "callback": "https://YOUR_SUBDOMAIN.workers.dev/twitch/webhook",
         "secret": "THE_SAME_TWITCH_WEBHOOK_SECRET_FROM_STEP_5"
       }
     }'
   ```

   Twitch immediately sends a `webhook_callback_verification` request to confirm the Worker owns
   that URL; the Worker answers it automatically (`handleWebhook` in
   [`src/index.ts`](src/index.ts)). A successful response to the subscription request itself shows
   `"status": "webhook_callback_verification_pending"`, which flips to `"enabled"` once that
   verification lands, usually within a second or two.

That's the whole one-time setup. From here, the Worker refreshes its own Twitch token forever (a
Cron Trigger every 3 hours, see `wrangler.toml`) and nothing above needs repeating unless you
rotate the Twitch app's credentials.

## 💻 Local development

```bash
npm run dev         # wrangler dev, local simulated KV/Durable Object, on http://localhost:8787
npm run typecheck
```

`wrangler dev` reads secrets from a `.dev.vars` file (gitignored, not the real Cloudflare secrets)
if you create one:

```
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
TWITCH_REFRESH_TOKEN=...
TWITCH_WEBHOOK_SECRET=...
API_TOKEN=...
```

Scheduled Workers don't fire on a timer during local dev; trigger the Cron handler manually with
`curl http://localhost:8787/cdn-cgi/local/scheduled`.

## 🔒 Security model

- `TWITCH_CLIENT_SECRET`/`TWITCH_REFRESH_TOKEN` never leave the Worker and are never returned by
  any endpoint, so GitHub Pages being fully public doesn't expose them.
- `GET /ws`: origin-checked against `djzwackery.com`/`localhost` only, spoofable, not real auth.
  Good enough here since it only gates read-only redemption events already visible to viewers.
- `POST /twitch/webhook`: real auth, HMAC-SHA256 verified against `TWITCH_WEBHOOK_SECRET`
  (`verifyWebhookSignature` in `src/twitch.ts`), constant-time compared.
- `GET /twitch/avatar` / `POST /twitch/refresh`: no origin check (avatar is called from
  Streamlabs' own origin, not ours), gated on `API_TOKEN` instead (`timingSafeEqual` compared).
  Real access control against a stranger, not cryptographically secret once pasted into a
  streamer's own Streamlabs dashboard, since they can view-source it like any client code.
  `AVATAR_RATE_LIMITER` caps `/twitch/avatar` at 20/min/IP on top of that.
- Every `API_TOKEN`-gated endpoint sends `Access-Control-Allow-Origin: *` and answers its own
  `OPTIONS` preflight before the token check runs, since a preflight never carries the real
  `Authorization` header.
