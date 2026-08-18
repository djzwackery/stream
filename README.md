# Stream Overlays

Browser-source overlays for OBS, Streamlabs, and similar broadcast software, written in TypeScript
and compiled to plain `<script>`s so each page stays a drop-in file with no build step for the
browser source itself. Setting up OBS and wiring up real events? See [SETUP.md](SETUP.md) for the
step-by-step walkthrough; this file is the reference.

```
public/                 everything your broadcast software, GitHub Pages and the release zip actually need
  index.html               local dev hub, links to everything below
  alerts.html               the alert layer (follow, sub, tip, bits, raid), transparent background
  redemptions.html          point/loyalty redemptions with their own GIF, transparent background
  now-playing.html          the now-playing card, transparent background
  now-playing-theme.html    the same card as a Now Playing app custom theme, see below
  control.html              rehearsal panel: fires test alerts, generates the Streamlabs Alert Box code below
  status.html               live health of the Twitch relay Worker, see below
  js/                       compiled output of src/*.ts (incl. js/components/), gitignored, see ARCHITECTURE.md
  rewards.json              reward title to GIF, cost, tier, layout, accent
  media/                    your reward GIFs (see media/README.md)
  styles.css tokens/        the brand tokens
src/                     TypeScript sources for the drivers above, see ARCHITECTURE.md
worker/                  Cloudflare Worker relaying Twitch Channel Point redemptions, see worker/README.md
serve.json               local-dev-only config for `npm start` (kept out of public/), see ARCHITECTURE.md
```

## Local development

```bash
npm install
npm start
```

Opens a static server at `http://localhost:5500`. Visit it for a hub page linking to every
overlay, each pre-loaded with a test event so the (otherwise transparent, near-invisible outside
your broadcast software) pages actually show something.

Editing a driver's behaviour means editing TypeScript, not the compiled `.js`:

```bash
npm run watch       # tsc --watch, recompiles src/*.ts on save
npm run build       # one-off compile
npm run typecheck   # type-check without emitting
npm run lint        # eslint . (add --fix via npm run lint:fix)
npm run format      # prettier --write .
npm run check       # format:check + lint + typecheck, what CI runs
```

## Publish

Two things happen automatically on every push to `main`:

- **GitHub Pages** deploys `public/` via `.github/workflows/deploy.yml`. One-time setup:
  **Settings → Pages → Source = "GitHub Actions"**. Pages then serves at
  `https://djzwackery.com/stream/alerts.html` (and the rest), a custom domain in front of
  `djzwackery.github.io`.
- **A GitHub Release** is published with a zip of everything your broadcast software and the
  reward book need, no `src/`, no `node_modules/`, none of the dev tooling. See below.

`worker/` is a separate deployable project and isn't touched by either of those: it deploys via its
own `.github/workflows/deploy-worker.yml`, only when `worker/**` changes, and needs
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo secrets set once. See
[worker/README.md](worker/README.md) for the one-time setup.

## Downloading updates without git

Every push to `main` publishes a [GitHub Release](../../releases) via
`.github/workflows/release.yml`. The download link is always the same:

```
https://github.com/djzwackery/stream/releases/latest/download/dj-zwackery-overlays.zip
```

Bookmark that instead of a specific release, it always resolves to the newest build. Unzip over
the existing folder on disk and reload the browser sources.

Releases are tagged with a plain build counter, `0.0.1`, `0.0.2`, `0.0.3` and so on. There's no
semver here since there's no compatibility contract to signal, just "is this newer than what I
have on disk." Every push to `main` bumps it by one.

## OBS / Streamlabs

Streamlabs Desktop shares OBS Studio's source model, so the same steps apply in both:
**Sources → + → Browser** for each page:

| Source      | URL                  | Size        |
| ----------- | -------------------- | ----------- |
| Alerts      | `…/alerts.html`      | 1920 × 1080 |
| Redemptions | `…/redemptions.html` | 1920 × 1080 |
| Now playing | `…/now-playing.html` | 1920 × 1080 |

Redemptions get their own source on purpose: a redemption never waits behind a raid, and you can
position the two independently.

Both pages are transparent, so they sit straight over the cam, no chroma key, no custom CSS.
Position with the source transform, not by editing the page. Leave _Shutdown source when not
visible_ **off** so an alert can't arrive at a dead source.

Test without waiting for a real event: open the source's **Interact** window and press **1**-**6**
(follow / sub / tip / bits / raid / redeem). Hold **shift** for the big tier, **alt** for huge. Or
load `alerts.html?test=raid&tier=huge`. In `redemptions.html` the test key is **6**.

## Wiring real events

`alerts.html` listens on several inputs at once, use whichever you have. This stream runs
**Streamlabs**, so that's the primary path; StreamElements is documented further down as an
alternative for anyone forking this for a StreamElements-based setup instead.

**Streamlabs (follows, subs, bits, raids, tips).** No relay page or connection to maintain:
Streamlabs' own Alert Box widget has a native per-type "Custom HTML/CSS/JS" editor that can run
this repo's alert layout directly.
[`control.html`](control.html)'s **Streamlabs Alert Box code** section generates a copy-pasteable
HTML/CSS box per alert type ([`src/streamlabs-alertbox.ts`](src/streamlabs-alertbox.ts) is what
that HTML loads); paste both boxes into the matching Alert Box type in the Streamlabs dashboard,
once per type, see [SETUP.md](SETUP.md) for the click-by-click walkthrough. Streamlabs re-renders
the pasted HTML fresh for every alert and handles queueing/duration itself, so once it's pasted
there's nothing left running to reconnect, ever. Streamlabs' events don't reliably carry a profile
image for every alert type, so some real alerts render the placeholder glyph instead of a photo.

**Twitch (Channel Point redemptions).** Streamlabs' Alert Box has no type for these at all, so
`redemptions.html` gets them from a small Cloudflare Worker
([`worker/`](worker/README.md)) instead: Twitch's EventSub webhook posts a redemption to the
Worker, which fans it out over a WebSocket to every connected `redemptions.html`. The Worker holds
the Twitch access/refresh token itself and keeps it alive indefinitely, so there's no token to
enter into OBS and nothing to reconnect before a stream; see
[`worker/README.md`](worker/README.md) for deploying it (a one-time step for whoever maintains the
repo, not something a streamer using it needs to touch) and
[`status.html`](status.html) for checking it's healthy.

**Your own EventSub relay.** Any script on the page can call `window.ZW.fire({...})`, or another
window can `postMessage({zwAlert: {...}})`:

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

`type` is one of `follow` `sub` `tip` `bits` `raid` `redeem`. `value` is the amount, bits, months or
party size, the driver picks the tier from it and formats the copy. Pass `avatar` (a 300×300 Twitch
profile URL), `message`, `tier` or `variant` to override anything.

**StreamElements custom widget**, if you're using that instead of Streamlabs: in the SE overlay
editor add a _Custom Widget_, paste the contents of `alerts.html` into the HTML box and point the
script tag at your Pages URL (`<script type="module" src="https://djzwackery.com/stream/js/zw-alerts.js">`).
The driver already maps `follower-latest`, `subscriber-latest`, `tip-latest`, `cheer-latest` and
`raid-latest`, including gifted subs, months, bit counts and raid party size, and its events do
carry a profile picture, unlike Streamlabs'.

## Point redemptions

`rewards.json` is the reward book, the only file you edit when you add a reward:

```json
"Attempt anime save": {
  "media": "media/attempt-anime-save.gif",
  "cost": 25000, "tier": "huge", "variant": "sidecar", "tone": "--magenta"
}
```

- `media`: a GIF **you host** in `media/`. Search thumbnails and image-CDN links check the referrer
  and render empty in the browser source. Until the file exists the overlay shows a striped
  placeholder naming the reward, so a new reward is never broken on stream.
- `variant`: `sidecar` (square GIF beside the reward name), `frame` (16:9 GIF with the reward
  sticker over its corner), `reel` (thin bar for cheap spammy rewards)
- `tier`: `small` / `big` / `huge`; huge is the translucent takeover, for the big-ticket rewards
- `tone`: `--magenta` `--acid` `--cyan` `--sun`; group rewards into families rather than giving
  every one its own colour

The reward title is matched loosely (case and punctuation are ignored), so it just needs to match
what Twitch sends. Firing one by hand:

```js
ZW.fire({ type: "redeem", name: "ravemum74", reward: "Attempt anime save" });
```

**Rehearsal panel.** Open `control.html` in a normal browser tab on the same origin; every button
fires into the live browser source too, plus _Run all 18 in sequence_ to review the whole set.

## Tuning, all via query string

`alerts.html?duration=5000&top=96&tipBig=20&tipHuge=100&bitsBig=1000&bitsHuge=5000&raidBig=20&raidHuge=100&monthsBig=6&giftHuge=10&currency=AUD`

- `duration`: ms on screen including intro and outro (default 5000)
- `top`: banner offset from the top edge in px (default 96)
- `*Big` / `*Huge`: the tier thresholds above
- `follow=stamp` / `sub=card` / `tip=jar` / `bits=meter` / `raid=squad`: pin one layout instead of
  rotating through the three (`cycle` is the default)
- `accept=redeem`: which event types the page renders (`redemptions.html` sets this itself)
- `rewards=rewards.json`: path to the reward book

**Huge tier never blocks the stream**: the takeover scrim is a translucent void vignette and the
accent strobe is confined to thin top and bottom bands.

`now-playing.html?src=<url>&scale=1.6&swap=stutter&corner=bottom-right&poll=3000`

- `src`: a URL returning either JSON (`{title,artist,label,artwork,progress}`) or plain text
  (`Artist - Title`, as most DJ software exports). Polled every `poll` ms. A local file works if you
  serve it on the same origin; a `file://` path will be blocked by CORS.
- `swap`: `stutter` (default), `flip`, `glitch`: the track-change animation
- `corner`: `bottom-right` (default), `bottom-left`, `top-right`, `top-left`
- `scale`: 1.6 matches the live scene; `compact=0` for the full-size card
- Test statically with `?title=Raise Your Fist&artist=Darren Styles`

The card hides itself (plays the exit animation, shows nothing) whenever there's no title or
artist to show, rather than displaying a "nothing on the decks" placeholder.

### Wiring the Now Playing app

[Now Playing](https://www.nowplayingapp.com) doesn't expose a JSON/text endpoint for third-party
overlays, only its own pre-rendered widget. The way to get its live track data into _this_ card is
its Pro-only Custom HTML Theme feature, which calls `window.onTrackUpdate(track)` (and optionally
`onHide()` / `onShow()` for its "Hide After" setting) on whatever page it's told to serve.
`zw-nowplaying.js` already implements that contract, so:

1. In Now Playing: **Settings → Theme Editor → Custom HTML → Select HTML file** →
   [`now-playing-theme.html`](now-playing-theme.html).
2. In OBS/Streamlabs, point the browser source at Now Playing's own URL (e.g.
   `http://localhost:9000`, shown in the app), not at this repo's hosted `now-playing.html`. Same
   recommended size, 1920 × 1080.

`now-playing-theme.html` is otherwise identical to `now-playing.html`, just with absolute script
URLs instead of relative ones (Now Playing serves it from its own local server, which has no `js/`
folder of its own to resolve a relative path against).
