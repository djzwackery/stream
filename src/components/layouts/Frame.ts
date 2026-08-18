/**
 * 16:9 GIF with a reward sticker over its corner, redeem layout.
 */
import { el } from "../dom.js";
import { MediaBox } from "../MediaBox.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Frame` layout element.
 */
export function Frame({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  const width = 680 * s;
  const height = (width * 9) / 16;
  return el(
    "div",
    {
      style: {
        position: "relative",
        width,
        border: `${Math.round(4 * s)}px solid var(--void)`,
        boxShadow: `${12 * s}px ${12 * s}px 0 var(${tone})`,
      },
    },
    MediaBox({ src: e.media, width, height, name: e.reward || e.detail, s }),
    el(
      "div",
      {
        style: {
          position: "absolute",
          insetBlockEnd: 0,
          insetInlineStart: 0,
          ...panel(tone, s * 0.85),
          border: "none",
          boxShadow: "none",
          padding: `${0.6 * s}rem ${1 * s}rem`,
          maxWidth: "80%",
        },
      },
      !hideEyebrow &&
        el("div", { style: label(s * 0.7) }, e.headline || t.eyebrow),
      el("div", { style: display(s, 1.7) }, e.name),
    ),
  );
}
