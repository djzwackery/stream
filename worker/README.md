# Twitch relay Worker 📡

A small Cloudflare Worker that relays Twitch Channel Point redemptions to `redemptions.html` and
looks up real Twitch avatars for the Streamlabs Alert Box driver, so a streamer never has to hold
a Twitch token or reconnect anything before going live. See the root
[README.md](../README.md#-wiring-real-events) for how this fits in; this file is the
deploy-it-once checklist and the security write-up.

```
Twitch  --(EventSub webhook, HMAC-signed POST)-->  Worker  --(broadcast)-->  Hub (Durable Object)  --(WebSocket)-->  redemptions.html
Twitch  --(refresh_token grant, via Cron every 3h)-->  Worker  (keeps the access token alive forever, never touches the browser)
Twitch  <--(GET /helix/users, cached in KV)--  Worker  <--(GET /twitch/avatar?login=X)--  streamlabs-alertbox.ts (in Streamlabs' widget)
```

A separate deployable project: its own `package.json`, `tsconfig.json`, and `wrangler.toml`,
deployed independently by
[`.github/workflows/deploy-worker.yml`](../.github/workflows/deploy-worker.yml), not touched by
the root `npm run build`/`deploy.yml`. Root `npm run check`/`format` still sweep `worker/**/*.ts`
for Prettier, but nothing here is linted by the root `eslint.config.js`.

## ⚙️ One-time setup

Only needs doing once per deployment, not per stream.

1. **Install dependencies.**

   ```bash
   cd worker
   npm install
   ```

2. **Register a Twitch application** at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
   if you don't have one. Any name; category "Application Integration" is fine. Add
   `http://localhost:3939/callback` to its **OAuth Redirect URLs** (used by the auth script in step
   4, removable afterwards). Note the **Client ID** and **Client Secret**.

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

   Runs [`scripts/twitch-onetime-auth.mjs`](../scripts/twitch-onetime-auth.mjs): prompts for the
   Client ID/Secret from step 2, opens a Twitch authorization URL to approve, catches the redirect
   on a local server, and exchanges the code for the first token pair (your Client Secret goes
   straight to Twitch's own endpoint, nowhere else). Prints the `wrangler secret put` commands for
   the next step, pre-filled.

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

   `TWITCH_WEBHOOK_SECRET` is reused in step 7: Twitch signs every webhook delivery with it so the
   Worker can tell a real notification from a forged one. `API_TOKEN` gates `/twitch/avatar` and
   `/twitch/refresh` (see Security model below): give it to whoever's pasting the Streamlabs Alert
   Box code, `control.html`'s own **API Token** field bakes it into the generated loader for you,
   and keep it yourself for curling `/twitch/refresh` directly if you ever need to.

6. **Deploy:**

   > [!IMPORTANT]
   > First deploy ever on this Cloudflare account: do this interactively, from your own terminal,
   > once, before wiring up CI. `npx wrangler login` (opens a browser), then `npx wrangler deploy`.
   > It asks to register a `workers.dev` subdomain, a permanent, one-time choice CI can't make
   > unattended (a non-interactive deploy just fails until this happens). Every deploy after that,
   > interactive or not, just works.

   ```bash
   npm run deploy
   ```

   Note the `*.workers.dev` URL it prints (also on the Cloudflare dashboard). Update it in two
   places at the repo root: `REDEMPTION_HUB_URL` in [`src/zw-alerts.ts`](../src/zw-alerts.ts) and
   `AVATAR_LOOKUP_URL` in [`src/streamlabs-alertbox.ts`](../src/streamlabs-alertbox.ts), replacing
   `YOUR_SUBDOMAIN`. Then `npm run build` and push.

   For automatic redeploys on every `worker/**` push, add
   `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` as repo secrets (**Settings → Secrets and
   variables → Actions**). The "Edit Cloudflare Workers" API token template is enough; the account
   ID is on the Cloudflare dashboard's sidebar.

7. **Create the EventSub subscription**, pointing Twitch at the deployed webhook. Needs an
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
   the URL; it answers automatically (`handleWebhook` in [`src/index.ts`](src/index.ts)). The
   subscription response shows `"status": "webhook_callback_verification_pending"`, flipping to
   `"enabled"` within a second or two.

That's the whole one-time setup. From here, the Worker refreshes its own Twitch token forever (a
Cron Trigger every 3 hours, see `wrangler.toml`), and nothing above needs repeating unless you
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
- `GET /ws`: origin-checked against `djzwackery.com`/`localhost` only, spoofable and not real auth,
  but good enough since it only gates read-only redemption events viewers already see.
- `POST /twitch/webhook`: real auth, HMAC-SHA256 verified against `TWITCH_WEBHOOK_SECRET`
  (`verifyWebhookSignature` in `src/twitch.ts`), constant-time compared.
- `GET /twitch/avatar` / `POST /twitch/refresh`: no origin check (avatar is called from
  Streamlabs' own origin), gated on `API_TOKEN` instead (`timingSafeEqual` compared). Real access
  control against a stranger, not a secret once it's pasted into Streamlabs, since view-source
  reveals it like any client code. `AVATAR_RATE_LIMITER` caps `/twitch/avatar` at 20/min/IP on top.
- Every `API_TOKEN`-gated endpoint sends `Access-Control-Allow-Origin: *` and answers its own
  `OPTIONS` preflight before the token check runs, since a preflight never carries the real
  `Authorization` header.
