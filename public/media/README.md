# Reward GIFs

One file per reward, named after the reward in `../rewards.json`. If a reward's file is ever
missing, the overlay shows a striped placeholder with the reward's name instead of breaking.

```
attempt-anime-save.gif        square-ish, for the `sidecar` layout
hydrate-the-dj.gif            square-ish, `sidecar`
weights.gif                   16:9, `frame`
```

**Host the files here, don't hotlink.** Search-result thumbnails and image-CDN URLs check the
referrer and will render empty in the browser source; a file committed next to the overlay always
loads.

Sizes: `sidecar` crops to a square ~190–275px, `reel` to ~104–135px, `frame` to 16:9 at ~620–713px
wide. Everything is `object-fit: cover`, so keep the subject centred. 2–4s loops at ≤2MB keep the
browser source light. A 10MB GIF will stutter the whole scene.

Use art you have the rights to. Anything cut from a film or series is the rights-holder's, which is
fine for a private test and a risk on a monetised public stream.
