# Stream Overlays 🎬

Browser-source overlays for OBS, Streamlabs, and similar broadcast software. TypeScript compiles to
plain `<script>`s, so each page is a drop-in file with no build step in the browser source itself.

```
public/                 what OBS/Streamlabs, GitHub Pages and the release zip need
  index.html               local dev hub, links to everything below
  alerts.html              the alert layer (follow, sub, tip, bits, raid), transparent background
  redemptions.html         point/loyalty redemptions with their own GIF, transparent background
  now-playing.html         the now-playing card, transparent background
  now-playing-theme.html   same card as a Now Playing app custom theme, see below
  control.html             rehearsal panel + Streamlabs Alert Box code generator
  js/                      compiled output of src/*.ts, gitignored, see ARCHITECTURE.md
  rewards.json             reward title to GIF, cost, tier, layout, accent
  media/                   your reward GIFs (see media/README.md)
  styles.css tokens/       the brand tokens
src/                     TypeScript sources for the drivers above, see ARCHITECTURE.md
worker/                  Cloudflare Worker relaying Twitch Channel Point redemptions, see worker/README.md
serve.json               local-dev-only config for `npm start`, see ARCHITECTURE.md
```

## 🚀 Local development

```bash
npm install
npm start
```

Opens `http://localhost:5500`, a hub page linking to every overlay. Each one loads with a test
event already firing, since the pages are transparent and otherwise look empty.

> [!NOTE]
> Node is pinned via `.node-version`. Run `fnm use` or `nvm use` first if you use either.

Edit the TypeScript under `src/`, not the compiled `.js`:

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run watch`     | Recompiles on save (`tsc --watch`).                  |
| `npm run build`     | One-off compile.                                     |
| `npm run typecheck` | Type-checks without emitting.                        |
| `npm run lint`      | Lints with ESLint (`npm run lint:fix` to auto-fix).  |
| `npm run format`    | Formats with Prettier.                               |
| `npm run check`     | `format:check` + `lint` + `typecheck`, what CI runs. |

## 🚢 Publish

Every push to `main`:

- Deploys `public/` to **GitHub Pages** via `deploy.yml`. One-time setup: **Settings → Pages →
  Source = "GitHub Actions"**. Serves at `https://djzwackery.com/stream/alerts.html` (and the
  rest), a custom domain in front of `djzwackery.github.io`.
- Publishes a **GitHub Release** zipping everything your broadcast software needs, no `src/`, no
  `node_modules/`.

`worker/` deploys separately, via its own `deploy-worker.yml`, only when `worker/**` changes. See
[worker/README.md](worker/README.md) for one-time setup, including the repo secrets it needs.

## 📦 Downloading updates without git

Every push publishes a [GitHub Release](../../releases). The download link never changes:

```
https://github.com/djzwackery/stream/releases/latest/download/dj-zwackery-overlays.zip
```

> [!TIP]
> Bookmark that link, not a specific release. Unzip over the existing folder and reload the
> browser sources.

Releases are tagged with a plain build counter (`0.0.1`, `0.0.2`, ...), not semver, there's no
compatibility contract to signal. Every push bumps it by one.

## 🎥 OBS / Streamlabs

Streamlabs Desktop shares OBS Studio's source model: **Sources → + → Browser** for each page.

| Source      | URL                  | Size        |
| ----------- | -------------------- | ----------- |
| Alerts      | `…/alerts.html`      | 1920 × 1080 |
| Redemptions | `…/redemptions.html` | 1920 × 1080 |
| Now playing | `…/now-playing.html` | 1920 × 1080 |

Redemptions get their own source so one never waits behind the other, and you can position them
independently.

Both pages are transparent, so they sit straight over the cam, no chroma key. Position with the
source transform, not by editing the page. Leave _Shutdown source when not visible_ **off** so an
alert can't arrive at a dead source.

Test without a real event: open the source's **Interact** window and press **1**-**6** (follow /
sub / tip / bits / raid / redeem). Hold **shift** for big, **alt** for huge. Or load
`alerts.html?test=raid&tier=huge`. In `redemptions.html` the test key is **6**, and `?test=redeem`
also takes `&reward=` and `&name=` to test a specific reward, e.g.
`redemptions.html?test=redeem&reward=Posture+Check!`.

## 🔌 Wiring real events

This stream runs **Streamlabs**; StreamElements is documented further down, for forks.

**Streamlabs (follows, subs, bits, raids, tips).** Its Alert Box widget has a native per-type
"Custom HTML/CSS/JS" editor that runs this repo's alert layout directly, no relay page to maintain.
[`control.html`](control.html) generates a copy-pasteable HTML/CSS/JS box per type/tier/variant;
paste all three into the matching Alert Box type in Streamlabs. The JS box is a small loader, not
[`src/streamlabs-alertbox.ts`](src/streamlabs-alertbox.ts) itself, so a fix there reaches every
pasted widget automatically, no re-pasting. Streamlabs owns queueing and duration for these, so
there's nothing left running to reconnect.

Streamlabs' events carry no real per-viewer avatar, so the driver looks one up live from Twitch
through the relay Worker ([`worker/`](worker/README.md)), falling back to a placeholder glyph if
that fails. The generator's "Prefer Streamlabs' image" checkbox flips that priority for types like
Power-Ups, whose `{img}` is the meaningful image.

**Twitch (Channel Point redemptions).** Streamlabs has no Alert Box type for these, so
`redemptions.html` gets them from a small Cloudflare Worker instead: Twitch's EventSub webhook
posts a redemption to the Worker, which fans it out over WebSocket to every connected
`redemptions.html`. The Worker holds the Twitch token itself and keeps it alive indefinitely, so
there's nothing to reconnect before a stream. See [`worker/README.md`](worker/README.md) to deploy
it.

**Your own relay.** Call `window.ZW.fire({...})`, or `postMessage({zwAlert: {...}})` from another
window:

```js
ZW.fire({
  type: "tip",
  name: "ravemum74",
  value: 25,
  message: "play something filthy",
});
ZW.fire({ type: "sub", name: "bigjimjimo", gifted: 25 });
ZW.fire({ type: "raid", name: "gabberqueen", value: 312 });
```

`type` is `follow` / `sub` / `tip` / `bits` / `raid` / `redeem`. `value` is the amount, bits,
months, or party size, the driver picks the tier and formats the copy from it. `avatar` (a 300×300
Twitch profile URL), `message`, `tier`, and `variant` override the defaults.

**StreamElements custom widget.** Add a _Custom Widget_ in the SE overlay editor, paste
`alerts.html`'s contents into the HTML box, and point the script tag at your Pages URL
(`<script type="module" src="https://djzwackery.com/stream/js/zw-alerts.js">`). The driver already
maps `follower-latest`, `subscriber-latest`, `tip-latest`, `cheer-latest`, and `raid-latest`,
gifted subs and party size included, and its events carry a profile picture, unlike Streamlabs'.

## 🎁 Point redemptions

`rewards.json` is the reward book, the only file you edit to add a reward:

```json
"Attempt anime save": {
  "media": "media/attempt-anime-save.gif",
  "cost": 25000, "tier": "huge", "variant": "sidecar", "tone": "--magenta"
}
```

- `media`: a GIF you host in `media/`. Search thumbnails and image-CDN links check the referrer and
  render empty in the browser source. Until the file exists, the overlay shows a striped
  placeholder naming the reward.
- `variant`: `sidecar` (square GIF beside the name), `frame` (16:9 GIF, reward sticker in the
  corner), `reel` (thin bar for cheap, spammy rewards)
- `tier`: `small` / `big` / `huge`
- `tone`: `--magenta` `--acid` `--cyan` `--sun`, group rewards into families rather than giving
  every one its own colour

The reward title is matched loosely (case and punctuation ignored), so it just needs to match what
Twitch sends:

```js
ZW.fire({ type: "redeem", name: "ravemum74", reward: "Attempt anime save" });
```

> [!TIP]
> Open `control.html` to rehearse: every button fires into the live browser source too, plus _Run
> all 18 in sequence_ to review the whole set.

## 🎛️ Tuning, all via query string

`alerts.html?duration=5000&top=96&tipBig=20&tipHuge=100&bitsBig=1000&bitsHuge=5000&raidBig=20&raidHuge=100&monthsBig=6&giftHuge=10&currency=AUD`

- `duration`: ms on screen including intro/outro (default 5000, 8000 for `redemptions.html`). `0`
  holds forever, no outro, no auto-clear, for eyeballing a layout's actual size.
- `top`: banner offset from the top edge in px (default 96)
- `*Big` / `*Huge`: the tier thresholds above
- `follow=stamp` / `sub=card` / `tip=jar` / `bits=meter` / `raid=squad`: pin one layout instead of
  rotating through the three (`cycle` is the default)
- `accept=redeem`: which event types the page renders (`redemptions.html` sets this itself)
- `rewards=rewards.json`: path to the reward book

> [!NOTE]
> Huge tier never blocks the stream: the takeover scrim is a translucent vignette, and the accent
> strobe is confined to thin top/bottom bands.

`now-playing.html?src=<url>&scale=1.6&swap=stutter&corner=bottom-right&poll=3000`

- `src`: a URL returning JSON (`{title,artist,label,artwork,progress}`) or plain text (`Artist -
Title`, as most DJ software exports). Polled every `poll` ms. A local file works if served on the
  same origin; `file://` is blocked by CORS.
- `swap`: `stutter` (default), `flip`, `glitch`
- `corner`: `bottom-right` (default), `bottom-left`, `top-right`, `top-left`
- `scale`: 1.6 matches the live scene; `compact=0` for the full-size card
- Test statically with `?title=Raise Your Fist&artist=Darren Styles`

The card hides itself (plays the exit animation) whenever there's no title or artist, rather than
showing a "nothing on the decks" placeholder.

### 🎵 Wiring the Now Playing app

[Now Playing](https://www.nowplayingapp.com) has no JSON/text endpoint for third-party overlays,
only its own widget. Its Pro-only Custom HTML Theme feature calls `window.onTrackUpdate(track)`
(and optionally `onHide()`/`onShow()`), which `zw-nowplaying.js` already implements:

1. In Now Playing: **Settings → Theme Editor → Custom HTML → Select HTML file** →
   [`now-playing-theme.html`](now-playing-theme.html).
2. In OBS/Streamlabs, point the browser source at Now Playing's own URL (e.g.
   `http://localhost:9000`, shown in the app), not this repo's hosted `now-playing.html`. Same
   recommended size, 1920 × 1080.

`now-playing-theme.html` is otherwise identical to `now-playing.html`, just with absolute script
URLs, since Now Playing serves it from its own local server with no `js/` folder to resolve a
relative path against.
