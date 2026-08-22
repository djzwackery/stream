/**
 * Thin ticket-style bar for cheap, spammy rewards, redeem layout.
 */
import { el } from "../dom.js";
import { MediaBox } from "../MediaBox.js";
import { Scanlines } from "../Scanlines.js";
import { display, label } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Reel` layout element.
 */
export function Reel({ e, s, tone, t, hideEyebrow }: LayoutProps): HTMLElement {
  const size = 120 * s;
  return el(
    "div",
    {
      style: {
        width: 440 * s,
        background: `var(${tone})`,
        color: "var(--void)",
        borderBlock: `${Math.round(5 * s)}px solid var(--void)`,
        display: "flex",
        alignItems: "center",
        gap: `${1 * s}rem`,
        padding: `${0.5 * s}rem ${1 * s}rem`,
        position: "relative",
      },
    },
    MediaBox({
      src: e.media,
      width: size,
      height: size,
      name: e.reward || e.detail,
      s,
    }),
    el(
      "div",
      null,
      !hideEyebrow &&
        el("div", { style: label(s * 0.8) }, e.headline || t.eyebrow),
      el("div", { style: display(s, 1.8) }, e.name),
    ),
    Scanlines(),
  );
}
