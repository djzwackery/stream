## What this is

Stream Overlays: browser-source overlays for OBS, Streamlabs, and similar broadcast software. Four
static HTML pages under `public/`, each loading the alert/now-playing components it needs
(`src/components/`, no framework) as native ES modules, plus one small TypeScript driver. Read
[ARCHITECTURE.md](ARCHITECTURE.md) before changing how events flow through `zw-alerts.ts` or how
`AlertStage` resolves an event to a layout; it covers both pipelines in more depth than is worth
repeating here.

Real events reach these pages two ways, neither of which is a page under `public/` in the usual
sense: `src/streamlabs-alertbox.ts` is pasted into Streamlabs' own Alert Box dashboard, one type at
a time, and `worker/` is a separate Cloudflare Worker project relaying Twitch Channel Point
redemptions, with its own `package.json`, its own conventions in `worker/README.md`, and none of
this file's TypeScript/lint rules applied to it (`eslint.config.js` only scopes to `src/**/*.ts`).
See ARCHITECTURE.md's "Shape of the thing" for how both fit together.

## Comments & JSDoc

**Every `interface`, every property within it, and every `type` alias needs its own multi-line
JSDoc block** (`/**\n * ...\n */`, never a single-line `/** ... */`). This is enforced by
`jsdoc/require-jsdoc` and `jsdoc/multiline-blocks` in `eslint.config.js`, scoped to interfaces and
type aliases specifically, not every function. One sentence describing what the field holds is
enough; see `src/types/global.d.ts` for the pattern.

Everywhere else, write no comments by default. Add one only when the **why** is non-obvious: a
hidden constraint, a workaround for a specific quirk, a subtle invariant, or behaviour that would
surprise a reader. If removing the comment wouldn't confuse a future reader, don't write it.
Ordinary function-level JSDoc still follows this rule (only where the signature alone doesn't
convey intent, one sentence max), it's just interfaces that get unconditional coverage.

**Inline comments** (`//`) are for single non-obvious lines. Keep them to one short line.

**Never write:**

- Section dividers or ASCII banners (`// ---- event sources ----`)
- Numbered headers (`// 1. INPUTS`)
- Descriptions of what the next line does (`// loop over rewards`)
- Stale or speculative notes (`// TODO: fix this later`)
- Multi-line comment blocks for anything that reads naturally from the code, outside interfaces
- Em dashes, in prose or code. Use a period, comma, colon or parentheses instead.

## TypeScript

Source lives in `src/*.ts`; `npm run build` (`tsc`) compiles each file to a matching `.js` file
under `public/js/` (see `tsconfig.json`: `outDir: public/js`, `rootDir: src`). No bundler.
`module: "ES2022"` with `moduleResolution: "Bundler"` means real `import`/`export` survives into
the output: `src/components/*.ts` compiles to genuine ES modules, and `zw-alerts.ts`/
`zw-nowplaying.ts` `import` them directly instead of reaching for a global. `control.ts` and
`redemptions.ts` have no imports and stay self-contained IIFEs, loaded as plain classic scripts;
`zw-alerts.ts`/`zw-nowplaying.ts` load as `<script type="module">`.

**Run `npm run build`** after editing anything under `src/` if you want to open the pages
directly, `public/js/**/*.js` is gitignored (see ARCHITECTURE.md), so there's nothing to commit;
`deploy.yml` and `release.yml` both build fresh before publishing. `npm run typecheck` is faster
for iterating without emitting; `npm run watch` recompiles on save.

Shared types live in `src/types/global.d.ts` as ambient declarations (no imports/exports), so
every file sees them automatically, ES modules included, ambient visibility doesn't depend on a
file's own import/export status. Types used only within `src/components/` live in
`src/components/types.ts` instead, as regular exported interfaces. `any` is an ESLint error
(`@typescript-eslint/no-explicit-any`); reach for `unknown` plus a narrowing check, or a generic,
instead.

Before considering a change done:

```bash
npm run check   # format:check + lint + typecheck
npm run build
```

Or individually: `npm run format` (Prettier, `--write`), `npm run lint` / `npm run lint:fix`
(ESLint, flat config in `eslint.config.js`), `npm run typecheck` (`tsc --noEmit`).

## Local development

```bash
npm install
npm start
```

Serves `public/` at `http://localhost:5500`; the root page links to every overlay pre-loaded with
a test event (the alert/redemption/now-playing pages are transparent and look empty without one).
There's no dev server needed beyond that, these are static files, not a framework app.

## Releases

Every push to `main` runs two workflows: `deploy.yml` publishes `public/` to GitHub Pages, and
`release.yml` publishes a GitHub Release (tag `0.0.N`, a plain build counter, no semver, zip of
`public/` plus `README.md`) bumped by one each push. Don't hand-edit `package.json`'s `version`,
it's unused (nothing here is published to npm); the release tag is computed from the previous
GitHub Release, not from that field.

## Pinning

`devDependencies` in `package.json` are pinned to exact versions, no `^`/`~` ranges: a floating
range can silently pull in a new major/minor on a fresh `npm install` (CI or a contributor's
machine) between when `package-lock.json` was generated and when it's actually installed from,
even though the lockfile alone would normally prevent that. Bump a version by editing the exact
string, not by relaxing the range.

Every `uses:` step in `.github/workflows/*.yml` is pinned to a full commit SHA, not a tag
(`actions/checkout@<sha> # v7`, not `actions/checkout@v7`): tags, including major-version tags like
`v7`, can be moved to point at a different commit, but a SHA can't. Resolve a tag to its SHA with
`git ls-remote --tags https://github.com/<owner>/<repo>.git refs/tags/<tag>` and keep the original
tag as a trailing comment so the pinned version is still readable at a glance.

## Keeping in sync with the design system

`public/styles.css` and `public/tokens/` are copies from the DJ Zwackery design system repo.
Re-copy them there when a token changes, don't hand-edit them here (that includes their internal
comments; they'll just be overwritten by the next copy).

`src/components/` (`AlertStage`, `NowPlayingCard`, and everything they render) is not copied from
anywhere, it's owned outright in this repo. It used to be a pre-compiled `_ds_bundle.js` bundle
copied from the design system repo, but that bundle never actually shipped redeem rendering even
though this repo's `rewards.json` and `redemptions.html` were built assuming it had. Treat
`src/components/` as regular source: edit it directly, no re-copy step, no patch markers to
preserve.

## Indexing

Every page in `public/*.html` carries `<meta name="robots" content="noindex, nofollow">`. These
are OBS/Streamlabs browser sources and dev-only tooling, not pages meant to show up in search
results; a `robots.txt` at the site root wouldn't cover this repo's own deploy, since it's served
under a path (`djzwackery.com/stream/...`) this repo doesn't own the root of. Add the tag to any
new page under `public/`.

## Adding a reward

Edit `public/rewards.json` (see README.md for the shape) and drop a hosted GIF in `public/media/`
named to match; don't hotlink search-result thumbnails or image-CDN URLs, they check the referrer
and render empty in the browser source.
