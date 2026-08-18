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
export function MediaBox({
  src,
  width,
  height,
  name,
  s,
}: MediaBoxProps): HTMLElement {
  return el(
    "span",
    {
      style: {
        width,
        height,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "var(--void-3)",
        backgroundImage: src
          ? undefined
          : "repeating-linear-gradient(45deg, color-mix(in oklch, var(--acid) 14%, transparent) 0 8px, transparent 8px 16px)",
      },
    },
    src
      ? el("img", {
          src,
          style: {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          },
        })
      : el(
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
