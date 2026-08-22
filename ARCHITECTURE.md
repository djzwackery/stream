# Architecture

## Shape of the thing

Standalone HTML pages under `public/`, each a browser source for OBS, Streamlabs, or similar
broadcast software. No router, no shared page shell, no framework: every page loads the
alert/now-playing components it needs as native ES modules, plus one small driver script.

```
public/alerts.html            -> js/zw-alerts.js (module)
public/redemptions.html       -> js/redemptions.js + js/zw-alerts.js (module)
public/now-playing.html       -> js/zw-nowplaying.js (module)
public/now-playing-theme.html -> same driver, absolute script URL, see below
public/control.html           -> js/control.js (plain DOM, no components)
public/index.html             -> static, no driver: local dev hub linking to the pages above
worker/src/index.ts           -> separate Cloudflare Worker project, see below
```

`index.html` isn't a browser source at all. It's a nav page for `npm start` (and for anyone who opens
the GitHub Pages root) so the transparent, otherwise-blank-looking pages are reachable without
memorising their filenames or test query strings.

`now-playing-theme.html` isn't a second driver either, it loads the exact same `zw-nowplaying.js`
as `now-playing.html`. The only difference is its script URL is absolute (pointing at this repo's
real GitHub Pages deployment) instead of relative: it's meant to be copied into the Now Playing app
itself and served from _its_ local server, which has no `js/` folder of its own to resolve a
relative path against. Its internal `import`s inside `zw-nowplaying.js` still resolve fine
cross-origin: they're relative to the module's own URL, not the embedding page's, and GitHub Pages
sends `Access-Control-Allow-Origin: *` on everything it serves. See the Now Playing section of
README.md.

`redemptions.html` and `alerts.html` share the same driver (`zw-alerts.js`). `redemptions.js` runs
first and rewrites the URL to `?accept=redeem` before the driver reads its query string, so the
same driver renders a different slice of events depending on which page loaded it, instead of
maintaining two copies of the event-queueing logic.

Real events reach the two page families (Streamlabs alerts vs. Twitch redemptions) through two
unrelated mechanisms, not one shared relay:

- **Streamlabs' own Alert Box.** `src/streamlabs-alertbox.ts` isn't loaded by any page in
  `public/`, it's pasted (via the HTML `control.html` generates) directly into Streamlabs' Alert
  Box "Custom HTML/CSS/JS" editor, one alert type at a time. Streamlabs substitutes `{token}`
  placeholders into that HTML itself before rendering it, so this driver's only job is reading
  those substituted values off the DOM (`#zw-tokens [data-token]`) and calling `AlertStage.show()`
  once; Streamlabs already owns receiving the Twitch event, queueing it, and controlling how long
  it stays up, the jobs `zw-alerts.ts`'s own `fire`/`build`/`queue`/`pump` pipeline (see Event flow,
  below) handles for every other input. There's deliberately no relay or ongoing connection here to
  reconnect: Streamlabs re-renders the pasted HTML fresh for every alert.
- **The Twitch relay Worker (`worker/`), for Channel Point redemptions.** Streamlabs' Alert Box has
  no type for these at all, so they're not reachable through the mechanism above. `worker/` is a
  completely separate deployable TypeScript project (its own `package.json`/`tsconfig.json`, not
  compiled by this repo's `tsc`, not linted by this repo's `eslint.config.js`): a Cloudflare Worker
  that receives Twitch's EventSub webhook, keeps a Twitch access token alive indefinitely via a
  Cron-triggered refresh (see worker/README.md), and fans redemptions out over a WebSocket, hosted
  by a Durable Object hub, to every connected `redemptions.html`. `zw-alerts.ts` opens that
  WebSocket itself (see Event flow, below) whenever `CFG.accept` includes `redeem`, i.e. only on
  `redemptions.html`. The Worker and the browser code share no TypeScript types, only a plain JSON
  shape matching `RawAlertPayload`'s redeem fields, by deliberate design, since they're separate
  projects that only ever communicate over the wire.

## Why `public/`

Everything your broadcast software, GitHub Pages and the release zip need to serve lives together
in `public/`. The repo root is left for tooling: `package.json`, `tsconfig.json`, `src/`,
`.github/`, docs. This matters for the release zip in particular: it's built by zipping the
contents of `public/` directly, so what streamers download always matches what OBS/Streamlabs and
Pages are already serving. Two folders you shouldn't reach for instead:

- `dist/` implies a build output that nothing else depends on existing at a fixed path. Here, the
  path is load-bearing: `public/alerts.html` loads `public/js/zw-alerts.js` by a plain relative
  `<script src>`, so the pairing has to stay put.
- `docs/` is the other folder name GitHub Pages' plain "deploy from branch" setting supports, but
  this repo deploys via the [`deploy.yml`](.github/workflows/deploy.yml) Actions workflow instead
  (see Releases below), so nothing forces that specific name, and `docs/` reads as documentation
  content it isn't.

[`serve.json`](serve.json) sits at the repo root rather than in `public/` for the same reason:
it's config for `npm start`'s local server (it turns off `serve`'s default clean-URL redirect,
which otherwise strips query strings, e.g. `?test=sub&tier=huge`, breaking every test link in
this README and in `index.html`), not something the browser source, Pages, or the release zip
need.

## Build pipeline

Source lives in [`src/`](src/) as TypeScript; `npm run build` runs `tsc`, which compiles each
`src/*.ts` to a matching `.js` file under `public/js/` (`rootDir: src`, `outDir: public/js`, see
[`tsconfig.json`](tsconfig.json)). No bundler. `module: "ES2022"` with `moduleResolution:
"Bundler"` means real `import`/`export` statements survive into the compiled output, so
`src/components/*.ts` compiles to genuine ES modules that `zw-alerts.ts`/`zw-nowplaying.ts`/
`streamlabs-alertbox.ts` import directly (`import { AlertStage } from "./components/AlertStage.js"`,
resolved by the browser at `<script type="module">` load time, not bundled away). `control.ts` and
`redemptions.ts` have no imports and stay self-contained IIFEs, loaded as plain classic `<script>`s.

`worker/` is not part of this build: it's a separate npm project with its own `tsconfig.json` and
`wrangler deploy`/`wrangler dev` toolchain, since it runs on Cloudflare's platform, not compiled to
`public/js/`. Root `npm run check`/`format` still sweep `worker/**/*.ts` for Prettier (harmless,
same style), but this repo's `eslint.config.js` scopes its rules to `src/**/*.ts` specifically, so
nothing in `worker/` is linted by it, that project is expected to stand on its own. See
worker/README.md.

`public/js/**/*.js` is **gitignored**, not committed. Both places that actually ship this repo
build fresh before publishing, so there's nothing worth keeping in git:

- [`deploy.yml`](.github/workflows/deploy.yml) runs `npm run build` before uploading `public/` to
  GitHub Pages.
- [`release.yml`](.github/workflows/release.yml) runs `npm run build` before zipping `public/` for
  the downloadable release.

Run `npm run build` locally too, whenever you want to open the pages directly (`npm start`
already does this implicitly, since you'd otherwise be serving stale or missing output).

`styles.css` and `tokens/` are a different kind of artifact: copies from the DJ Zwackery design
system repo, not built here at all. See [AGENTS.md](AGENTS.md) for how those get refreshed. The
alert/now-playing components themselves (`src/components/`) are owned outright here, not copied,
see below.

## Event flow (`zw-alerts.js`)

```
StreamElements       -+
control.html          |
postMessage           |-> fire(raw) -> build(raw) -> queue -> pump() -> stage.show(event, duration)
?test= / keys 1-6     |                                 ^                        |
Twitch relay Worker -+                                  +---- onDone ------------+
```

- **`fire(raw)`** is the single entry point every input source calls. It drops the event if the
  page isn't configured to `accept` that type (`alerts.html` takes the five live events;
  `redemptions.html` takes `redeem`), otherwise normalises it with `build()` and pushes it onto
  `queue`. The Twitch relay Worker input (`connectRedemptionHub()`) only runs when `CFG.accept`
  includes `redeem`, i.e. only on `redemptions.html`: it opens a `WebSocket` to the Worker's `/ws`
  and calls `fire()` on every message, reconnecting after a fixed delay if the socket drops, the
  same shape as the `postMessage` listener just above it in the same file.
- **`build(raw)`** maps a loosely-shaped `RawAlertPayload` (whatever StreamElements, control.html,
  or a manual test sends) onto the fixed `AlertStageEvent` shape `AlertStage` renders, picking a
  tier from the configured thresholds, formatting the amount/detail copy, and rotating or
  resolving the variant.
- **`pump()`** is the only thing that dequeues. It's gated on `busy`, so a second event arriving
  mid-animation waits its turn instead of interrupting. `finished()` (`AlertStage`'s `onDone`
  callback) clears `busy` and re-triggers `pump()` after a short gap.
- `stage` is a single `AlertStage` instance constructed once at module load, over `#root`.
  `pump()` calls `stage.show(event, duration)` directly; there's no framework subscriber layer in
  between, `AlertStage.show()` owns the DOM diff (a full rebuild per event) and its own intro/hold/
  exit `setTimeout` chain internally.

`streamlabs-alertbox.ts` doesn't go through any of this pipeline, it's not `zw-alerts.ts` and isn't
loaded by `alerts.html`/`redemptions.html` at all. It builds one `AlertStageEvent` directly from
Streamlabs' substituted tokens and calls `stage.show()` once, since Streamlabs itself already owns
queueing and duration for the page this driver runs on. See "Shape of the thing", above.

`zw-nowplaying.js` is simpler, no queue, since a new track just replaces the currently displayed
one. `apply()` is the single entry point (called from the `?src=` poll, `window.ZWNP.set()`, or
`postMessage`), and it's a no-op if the incoming track is identical to what's already showing, so
a polling loop with an unchanged response doesn't retrigger the swap animation. A single
`NowPlayingCard` instance, also constructed once over `#root`, does the same "rebuild vs. patch"
split internally: `update(track, visible)` does a full swap-animated rebuild when the track key
(`title|artist`) changes, or just patches the progress-bar width when it hasn't.

## Components (`src/components/`)

No framework: everything renders through a small `el(tag, options, ...children)` helper
([`dom.ts`](src/components/dom.ts)) that builds real DOM nodes directly. These components are
mostly declarative with only a couple of transient, imperative pieces (the alert queue's timing,
the now-playing swap animation), all handled by rebuilding the affected DOM directly instead of
diffing it.

`AlertStage` ([`AlertStage.ts`](src/components/AlertStage.ts)) resolves an `AlertStageEvent` down
to a single layout function and a size multiplier, then builds and appends it:

- `TYPE[event.type]` gives the default accent colour, eyebrow and verb; `event.tone` overrides the
  colour for a specific reward (see rewards.json's `tone` field).
- `VARIANTS[event.type]` ([`variants.ts`](src/components/variants.ts)) lists that type's three
  `{id, layout, motion}` options; `event.variant` (or the rotation in `zw-alerts.ts`) picks one,
  `LAYOUTS[variant.layout]` ([`layouts/index.ts`](src/components/layouts/index.ts)) resolves it to
  the actual layout function (`Sticker`, `Ledger`, `Sidecar`, ...).
- `TIER[event.tier]` scales everything (`s`, the size multiplier every layout takes); `huge`
  additionally switches to the full-bleed takeover treatment.
- `MOTION[variant.motion]` gives the intro/outro keyframe pair. `show()` schedules three
  `setTimeout`s off `duration` (stop the entry shake, swap to the outro animation, then clear the
  container and call `onDone`) instead of a `phase` state machine, since there's only ever one
  event live at a time and nothing else needs to observe the phase mid-flight.

The eleven layout functions (`Sticker`, `Strip`, `GlitchName`, `Ledger`, `Meter`, `Squad`, `Slab`,
`Sidecar`, `Frame`, `Reel`, `PowerUp`, all under `src/components/layouts/`) take the same
`LayoutProps` shape and share a handful of style helpers (`label`, `display`, `panel`, in
[`style-helpers.ts`](src/components/style-helpers.ts)) and sub-components (`Avatar`, `GoalBar`,
`Scanlines`, `MediaBox`). `Sidecar`/`Frame`/`Reel`, plus `MediaBox`, are what render a reward's GIF
for `redeem` events; `PowerUp` reuses `MediaBox` too, for a Bits Power-Up's own image.

`NowPlayingCard` ([`NowPlaying.ts`](src/components/NowPlaying.ts)) is a small class instead of a
pure function, since it needs to remember the previous track key across calls to decide whether to
rebuild (swap animation) or patch (progress only). `SWAP[swap]` picks which animations (art,
title/artist text, and optionally a card shake) play together when the track changes; a
`lastTrackKey` field (not a hook, there's no render cycle to hook into) skips the swap on the very
first `update()` call so the card doesn't animate in on initial mount.

## Point redemptions (`rewards.json`)

`REWARDS` is a title to display-config map, loaded from `rewards.json` (or whatever `?rewards=`
points at) and re-keyed by a slugified title so lookups are case/punctuation-insensitive. A
`redeem` event's `reward` name is slugged and looked up at `build()` time; anything not in the
lookup still renders (`build()` falls back to `{}`) as a placeholder, because a stream should
never break because someone renamed a Twitch reward without updating this repo.

## Types (`src/types/global.d.ts`)

One ambient, import-free `.d.ts` shared by every file in `src/`: `AlertType`/`AlertTier`, and the
raw and normalised event shapes. Being ambient (no top-level `import`/`export`) means every file
sees these types automatically, including the real ES modules under `src/components/`, since
per-file module-ness doesn't affect ambient declaration visibility. Types used only within
`src/components/` (`LayoutProps`, `AvatarProps`, and the rest of its component props) are declared
locally there instead, in `src/components/types.ts`, since nothing outside that directory needs
them.

## Releases

Two workflows run on every push to `main`:

- [`deploy.yml`](.github/workflows/deploy.yml) publishes `public/` to GitHub Pages via
  `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [`release.yml`](.github/workflows/release.yml) rebuilds, zips the contents of `public/` plus
  `README.md`, and publishes it as a GitHub Release tagged with a plain build counter (`0.0.1`,
  `0.0.2`, ...), not semver, there's no compatibility contract here to signal. The number is read
  from the previous release and incremented by one, not from `package.json`; that file's `version`
  is dev-tooling metadata only, since nothing here is published to npm. The zip asset name is
  fixed, so `.../releases/latest/download/dj-zwackery-overlays.zip` always resolves to the newest
  build.
