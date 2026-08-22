/**
 * Reward GIF slot shared by the redeem layouts (Sidecar, Frame, Reel). Shows
 * a striped placeholder naming the reward when there's no image yet.
 */
import { el } from "./dom.js";
import { label } from "./style-helpers.js";
import type { MediaBoxProps } from "./types.js";

/**
 * Builds a `MediaBox` element.
 */
const PLACEHOLDER_STRIPES =
  "repeating-linear-gradient(45deg, color-mix(in oklch, var(--acid) 14%, transparent) 0 8px, transparent 8px 16px)";

export function MediaBox({
  src,
  width,
  height,
  name,
  s,
}: MediaBoxProps): HTMLElement {
  const wrap = el("span", {
    style: {
      width,
      height,
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      background: "var(--void-3)",
    },
  });

  // Also the fallback if `src` 404s or otherwise fails to load, not just
  // when it's absent to begin with: the browser already tried and failed,
  // no point leaving a broken-image icon up in its place.
  function showPlaceholder(): void {
    wrap.style.backgroundImage = PLACEHOLDER_STRIPES;
    wrap.replaceChildren(
      el(
        "span",
        {
          style: {
            ...label(s * 0.75),
            color: "var(--ink-dim)",
            textAlign: "center",
            padding: `0 ${0.5 * s}rem`,
          },
        },
        name,
      ),
    );
  }

  if (src) {
    wrap.append(
      el("img", {
        src,
        onError: showPlaceholder,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        },
      }),
    );
  } else {
    showPlaceholder();
  }

  return wrap;
}
