/**
 * Stream now-playing driver.
 *
 * Track source, in priority order:
 * 1. `?src=<url>`: JSON `{title,artist,label,artwork,progress}` or plain
 *    text `Artist - Title` (Serato/VirtualDJ/Traktor text export, or
 *    anything your DJ software writes). Polled every 3s.
 * 2. `?title=&artist=&label=&artwork=`: static, for testing
 * 3. `window.ZWNP.set({title,artist,...})` / `postMessage({zwTrack:{...}})`
 * 4. `window.onTrackUpdate(track)` / `onHide()` / `onShow()`, called by the
 *    Now Playing app (nowplayingapp.com) when this page is loaded as its
 *    custom HTML theme, see now-playing-theme.html.
 */
import { NowPlayingCard } from "./components/NowPlaying.js";

const qs = new URLSearchParams(location.search);

function num(key: string, fallback: number): number {
  const v = parseFloat(qs.get(key) ?? "");
  return isNaN(v) ? fallback : v;
}

/**
 * Narrows an untrusted `postMessage` payload before reading fields off it.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const CFG = {
  src: qs.get("src"),
  poll: num("poll", 3000),
  scale: num("scale", 1.6),
  compact: qs.get("compact") !== "0",
  swap: (qs.get("swap") || "stutter") as "stutter" | "flip" | "glitch",
  corner: qs.get("corner") || "bottom-right",
};

let current: TrackInfo = {
  title: qs.get("title") || "",
  artist: qs.get("artist") || "",
  label: qs.get("label") || undefined,
  artwork: qs.get("artwork") || undefined,
  progress: num("progress", 0),
};
let hidden = false;

const root = document.getElementById("root")!;
root.setAttribute("data-corner", CFG.corner);
const card = new NowPlayingCard(root, {
  compact: CFG.compact,
  scale: CFG.scale,
  swap: CFG.swap,
});

function render(): void {
  card.update(current, Boolean(current.title || current.artist) && !hidden);
}
render();

/**
 * An empty title/artist is a real "nothing on the decks" signal, not noise
 * to ignore: it clears the card so `render()`'s `visible` check can hide it.
 * A poll that fails outright never reaches here (see poll()'s catch), so a
 * network blip doesn't flicker the card away mid-set.
 */
function apply(t: Partial<TrackInfo> | undefined): void {
  if (!t) {
    return;
  }
  const title = t.title?.trim() ?? "";
  const artist = t.artist?.trim() ?? "";
  if (!title && !artist) {
    if (current.title || current.artist) {
      current = {
        title: "",
        artist: "",
        label: undefined,
        artwork: undefined,
        progress: 0,
      };
      render();
    }
    return;
  }
  if (
    title === current.title &&
    artist === current.artist &&
    t.progress === current.progress
  ) {
    return;
  }
  current = { ...current, ...t, title, artist };
  render();
}
window.ZWNP = { set: apply };
window.addEventListener("message", (m: MessageEvent<unknown>) => {
  if (isRecord(m.data) && m.data.zwTrack) {
    apply(m.data.zwTrack);
  }
});
window.onTrackUpdate = (track: NowPlayingTrackId): void => {
  apply({
    title: track.title,
    artist: track.artist,
    label: track.label,
    artwork: track.artwork,
  });
};
window.onHide = (): void => {
  hidden = true;
  render();
};
window.onShow = (): void => {
  hidden = false;
  render();
};

function parseText(txt: string): Partial<TrackInfo> {
  const line = txt.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const bits = line.split(/\s+[-–]\s+/);
  return bits.length > 1
    ? { artist: bits[0]!.trim(), title: bits.slice(1).join(" - ").trim() }
    : { title: line.trim() };
}

function poll(): void {
  if (!CFG.src) {
    return;
  }
  fetch(CFG.src, { cache: "no-store" })
    .then((r) => r.text())
    .then((body) => {
      let t: Partial<TrackInfo>;
      try {
        t = JSON.parse(body) as Partial<TrackInfo>;
      } catch {
        t = parseText(body);
      }
      apply(t);
    })
    .catch(() => {
      // source unreachable this tick, the card just keeps showing the last track
    });
}
if (CFG.src) {
  poll();
  setInterval(poll, CFG.poll);
}
