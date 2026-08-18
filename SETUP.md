# Setup Guide

A step-by-step walkthrough for wiring these overlays into OBS or Streamlabs Desktop and connecting
real events. For query-string tuning, the reward book, or anything code-level, see
[README.md](README.md) and [AGENTS.md](AGENTS.md); this file is just the ordered checklist.

## Before you start

You don't need to install anything or run `npm start` to use these overlays, that's only for
editing the code. Point OBS/Streamlabs straight at the hosted pages:

```
https://djzwackery.com/stream/alerts.html
https://djzwackery.com/stream/redemptions.html
https://djzwackery.com/stream/now-playing.html
https://djzwackery.com/stream/control.html
https://djzwackery.com/stream/status.html
```

Every push to `main` redeploys automatically, so these always serve the latest version.

**The single most important thing to understand before any of this will make sense:** OBS and
Streamlabs Desktop each run their own embedded browser, a completely separate program from
Chrome/Firefox/Safari on your desktop, with its own storage. Even if both happen to be pointed at
the exact same `http://localhost:5500/...` URL, they do **not** share `localStorage` or
`BroadcastChannel` with each other, the same way Chrome and Firefox don't share cookies just
because you typed the same address into both. This is why **firing test alerts from `control.html`
doesn't reach OBS**: it sends events over `BroadcastChannel`/`localStorage`. Open `control.html` in
a regular desktop browser tab and click a button, nothing will happen in an OBS source, even one
pointed at the identical URL, because that source is running in a different browser entirely. This
is the thing to check first if "firing an event from the browser doesn't reach OBS": you're very
likely testing from the wrong browser, not looking at an actual bug.

The fix: do it **inside OBS**. Right-click the relevant source in OBS's Sources panel and choose
**Interact**, that opens a real interactive window you can click and type into, exactly like a
normal browser tab, except it's running in OBS's own browser, so anything it broadcasts reaches
OBS's other sources correctly. Do the test alert step below through an Interact window, not your
desktop browser.

Nothing else in this setup needs OBS's own browser: there's no token to type into a source anymore.
Streamlabs alerts are wired by pasting a code snippet into Streamlabs' own dashboard (step 2), and
Twitch Channel Point redemptions are already connected server-side once the Worker is deployed
(step 3), neither one lives in `localStorage` inside an OBS source.

## 1. Add the overlay sources

**Sources → + → Browser** for each of these (Streamlabs Desktop uses the same steps):

| Source        | URL                                              | Size        | Renders anything? |
| ------------- | ------------------------------------------------ | ----------- | ----------------- |
| Alerts        | `https://djzwackery.com/stream/alerts.html`      | 1920 × 1080 | Yes, transparent  |
| Redemptions   | `https://djzwackery.com/stream/redemptions.html` | 1920 × 1080 | Yes, transparent  |
| Now playing   | `https://djzwackery.com/stream/now-playing.html` | 1920 × 1080 | Yes, transparent  |
| Control panel | `https://djzwackery.com/stream/control.html`     | 100 × 100   | No                |

Add the **Control panel** source even though you don't need to see it, it's how you test that a
real alert reaches OBS, from inside OBS's own browser, see step 5.

For every one of these, leave **Shutdown source when not visible** **off**, so an alert source that
gets shut down can't miss an event that arrives while it's dead (this matters most for
Redemptions, which stays connected to the Worker over its own WebSocket in the background).

Redemptions gets its own source (rather than sharing the Alerts one) so a redemption never has to
wait behind a raid in the queue, and you can position the two independently.

## 2. Connect Streamlabs (follows, subs, bits, raids, tips)

Streamlabs' own Alert Box widget can run this repo's alert layout directly, no relay or ongoing
connection needed. Do this once per alert type:

1. Open [`control.html`](https://djzwackery.com/stream/control.html) and scroll to **Streamlabs
   Alert Box code**. Pick a type from the dropdown (Follow / Sub / Resub / Gift sub / Bits / Raid /
   Tip).
2. In the Streamlabs dashboard (not Streamlabs Desktop, the web dashboard at streamlabs.com): open
   the **Alert Box** widget, pick the matching alert type, and enable **Custom HTML/CSS/JS** under
   its Custom tab.
3. Copy the generated **HTML** box into Streamlabs' HTML field, and the **CSS** box into its CSS
   field. Leave the JS field empty, nothing to paste there.
4. Save, and trigger a test alert of that type from Streamlabs' own dashboard to confirm it renders.
5. Repeat for each of the other 6 types.

That's it, permanently. Streamlabs re-renders this HTML fresh for every alert and handles queueing
and duration itself, so there's no connection to keep alive, no token to expire, nothing to
reconnect after restarting OBS or Streamlabs. Streamlabs' events don't reliably include a profile
picture for every alert type, so some alerts may show the placeholder glyph instead of a photo,
that's expected.

## 3. Twitch (channel point redemptions)

Streamlabs doesn't relay Channel Point redemptions at all (its Alert Box has no type for them), so
these come from a small Cloudflare Worker instead, already deployed and running, nothing to set up
here. The **Redemptions** source added in step 1 connects to it automatically over a WebSocket and
stays connected in the background.

If you ever want to double check it's healthy, either your own or before going live, open
[`status.html`](https://djzwackery.com/stream/status.html) on a second monitor or in any regular
browser tab, no OBS needed: it shows the Twitch token's last refresh time and how many OBS sources
are currently connected. Green means healthy; if a card ever turns red, see
[worker/README.md](worker/README.md) or ping whoever deployed the Worker, this isn't something
fixable from inside OBS.

## 4. Now Playing app (optional)

If you DJ with the [Now Playing](https://www.nowplayingapp.com) app and want live track info on
screen, that's a separate integration, see the "Wiring the Now Playing app" section of
[README.md](README.md#wiring-the-now-playing-app). Skip this if you're not using it, `now-playing.html`
just won't show anything.

## 5. Test everything

Two different things you might want to check, and they need two different setups, because of the
separate-browser issue explained above:

**Does the alert look right?** Open `https://djzwackery.com/stream/control.html` in a normal
desktop browser tab, that's fine for this, nothing here needs a saved token. Every button fires
into `control.html`'s own built-in preview pane, right there on the page, no OBS required:

- Click **follow** / **sub** / **tip** / **bits** / **raid** / **redeem** individually, tune tier,
  variant, name, value, message, or reward first.
- **Run all 18 in sequence** cycles every type × variant combination automatically, six minutes
  apart, good for a full run-through before going live.
- The **URL builder** section generates a tuned `alerts.html?...` URL, e.g. a longer `duration` or
  a different `top` offset, paste the result back into OBS's browser source URL field.

**Does it actually reach OBS?** The desktop browser tab above can't answer this, it's a different
browser from OBS's, see "Before you start". To check the real source: right-click the **Control
panel** source you added in step 1 → **Interact**, and click the same buttons from there instead.
Now you're firing from inside OBS's own browser, so it reaches the real Alerts/Redemptions sources
too, watch them update live in the OBS preview.

Or skip the control panel entirely: open the Alerts source's own **Interact** window and press
**1**-**6** (follow / sub / tip / bits / raid / redeem), holding **shift** for the big tier or
**alt** for huge, that's also running in OBS's browser, so it works the same way.

**Are real events actually connected?** Open [`status.html`](https://djzwackery.com/stream/status.html)
in any regular browser tab (it's not an OBS source, and it doesn't need one). It shows the Twitch
Worker's token health and how many OBS sources are currently connected to it, a quick check before
going live that doesn't require triggering a real Twitch redemption to confirm the pipe works.

## 6. Customize

- **Rewards:** edit `public/rewards.json` and drop a GIF in `public/media/`, see README's "Point
  redemptions" section.
- **Thresholds, duration, layout pinning:** all query-string flags on `alerts.html`, see README's
  "Tuning, all via query string" section, or build the URL with `control.html`'s URL builder.

## Troubleshooting

- **Firing a test alert from `control.html` in my desktop browser doesn't reach OBS.** Expected,
  see "Before you start": OBS's browser is a separate program from your desktop browser and doesn't
  share `BroadcastChannel`/`localStorage` with it, even for the identical URL. Use the Control
  panel source's own **Interact** window instead (step 5).
- **Nothing ever appears, not even in `control.html`'s own preview pane.** Check **Shutdown source
  when not visible** is off on the Alerts/Redemptions source, and that everything's on the same
  origin (`djzwackery.com` vs `localhost` won't talk to each other either).
- **A Streamlabs alert type never fires for real.** Double-check Custom HTML/CSS/JS is actually
  enabled for that alert type in Streamlabs' Alert Box widget, and that you pasted both the HTML
  and CSS boxes (not just one), see step 2.
- **Redemptions never fire for real, only from `control.html`.** Check
  [`status.html`](https://djzwackery.com/stream/status.html): if the Redemptions card shows 0
  connected sources, the OBS source isn't reaching the Worker (check the URL and that **Shutdown
  source when not visible** is off); if the token card is red, see
  [worker/README.md](worker/README.md).
- **Real alerts have no profile picture.** Expected, Streamlabs' Alert Box doesn't reliably supply
  one for every alert type.
