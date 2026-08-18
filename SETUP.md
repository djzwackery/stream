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
https://djzwackery.com/stream/streamlabs-relay.html
https://djzwackery.com/stream/twitch-relay.html
```

Every push to `main` redeploys automatically, so these always serve the latest version.

**One thing that trips people up:** OBS and Streamlabs Desktop each run their own embedded browser,
completely separate from Chrome/Firefox/Safari on your desktop, with its own storage. The
Streamlabs and Twitch relay pages remember your token/Client ID with `localStorage`, so if you type
them into a regular desktop browser tab, OBS's browser source won't see them, it has to be entered
**inside OBS**. Right-click the source in OBS's Sources panel and choose **Interact**, that opens a
real interactive window you can click and type into, exactly like a normal browser tab. Do all the
setup below through that window for any source that needs input (Streamlabs relay, Twitch relay).

## 1. Add the overlay sources

**Sources → + → Browser** for each of these (Streamlabs Desktop uses the same steps):

| Source           | URL                                                   | Size        | Renders anything? |
| ---------------- | ----------------------------------------------------- | ----------- | ----------------- |
| Alerts           | `https://djzwackery.com/stream/alerts.html`           | 1920 × 1080 | Yes, transparent  |
| Redemptions      | `https://djzwackery.com/stream/redemptions.html`      | 1920 × 1080 | Yes, transparent  |
| Now playing      | `https://djzwackery.com/stream/now-playing.html`      | 1920 × 1080 | Yes, transparent  |
| Streamlabs relay | `https://djzwackery.com/stream/streamlabs-relay.html` | 100 × 100   | No                |
| Twitch relay     | `https://djzwackery.com/stream/twitch-relay.html`     | 100 × 100   | No                |

For every one of these, leave **Shutdown source when not visible** **off**. The two relay sources
need to stay connected even while off-screen or on a different scene, and an alert source that gets
shut down can miss an event that arrives while it's dead. Position and size don't matter for the
relay sources since they don't draw anything, just don't delete them.

Redemptions gets its own source (rather than sharing the Alerts one) so a redemption never has to
wait behind a raid in the queue, and you can position the two independently.

## 2. Connect Streamlabs (follows, subs, bits, raids, tips)

1. In the Streamlabs dashboard (not Streamlabs Desktop, the web dashboard at streamlabs.com): go to
   **Settings → API Settings → API Tokens** and copy **Your Socket API Token**.
2. In OBS, right-click the **Streamlabs relay** source → **Interact**.
3. Paste the token, click **Connect**. The status line should change to **Connected.**

That's it, it reconnects on its own from then on, including after restarting OBS. If it ever shows
**Disconnected, retrying…**, leave it, it retries on its own. Streamlabs' events don't include a
profile picture, so these alerts show the placeholder glyph instead of a photo, that's expected.

## 3. Connect Twitch (channel point redemptions)

Streamlabs doesn't relay Channel Point redemptions at all, so this is a separate connection direct
to Twitch.

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and register an
   application. Any name; category **Application Integration** is fine.
2. In OBS, right-click the **Twitch relay** source → **Interact**. It shows you the exact redirect
   URL to register, copy it.
3. Back on the Twitch console, add that URL to the app's **OAuth Redirect URLs** and save.
4. Copy the app's **Client ID** (not the Client Secret, this page never uses it).
5. Back in OBS's Interact window, paste the Client ID and click **Connect with Twitch**. Log in and
   approve the request. You'll land back on the relay page showing **Connected as
   <your channel>, listening for redemptions.**

This connection expires after a few hours (Twitch doesn't hand out a long-lived token for this kind
of flow), you'll see the status change to **Token expired**. Reconnecting is the same one click,
**Connect with Twitch** again, no need to redo steps 1-4.

## 4. Now Playing app (optional)

If you DJ with the [Now Playing](https://www.nowplayingapp.com) app and want live track info on
screen, that's a separate integration, see the "Wiring the Now Playing app" section of
[README.md](README.md#wiring-the-now-playing-app). Skip this if you're not using it, `now-playing.html`
just won't show anything.

## 5. Test everything

Open `https://djzwackery.com/stream/control.html` (a normal browser tab is fine for this one, it's
read-only test data, not a saved token). Every button fires straight into whatever alert sources
are open on the same origin, OBS's included:

- Click **follow** / **sub** / **tip** / **bits** / **raid** / **redeem** individually, tune tier,
  variant, name, value, message, or reward first.
- **Run all 18 in sequence** cycles every type × variant combination automatically, six minutes
  apart, good for a full run-through before going live.
- The **URL builder** section generates a tuned `alerts.html?...` URL, e.g. a longer `duration` or
  a different `top` offset, paste the result back into OBS's browser source URL field.

Or skip the control panel: open the Alerts source's own **Interact** window and press **1**-**6**
(follow / sub / tip / bits / raid / redeem), holding **shift** for the big tier or **alt** for huge.

## 6. Customize

- **Rewards:** edit `public/rewards.json` and drop a GIF in `public/media/`, see README's "Point
  redemptions" section.
- **Thresholds, duration, layout pinning:** all query-string flags on `alerts.html`, see README's
  "Tuning, all via query string" section, or build the URL with `control.html`'s URL builder.

## Troubleshooting

- **Nothing ever appears, even from `control.html`.** Check **Shutdown source when not visible** is
  off on the Alerts/Redemptions source, and that you're testing from the same origin the source is
  actually loading (`djzwackery.com` vs `localhost` won't talk to each other).
- **Streamlabs/Twitch relay says "Not connected" after you set it up.** You likely typed the
  token/Client ID into a regular desktop browser instead of the OBS source's own **Interact**
  window, see "Before you start" above.
- **Redemptions never fire for real, only from `control.html`.** Streamlabs doesn't relay Channel
  Point redemptions, that needs the separate Twitch relay (step 3).
- **Real alerts have no profile picture.** Expected for Streamlabs-sourced events, it doesn't send
  one. StreamElements-sourced events do include one, if you use that integration instead.
