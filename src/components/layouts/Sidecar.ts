/**
 * Square-GIF-beside-name redeem layout.
 */
import { el } from "../dom.js";
import { MediaBox } from "../MediaBox.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Sidecar` layout element.
 */
export function Sidecar({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  const size = 220 * s;
  return el(
    "div",
    {
      style: {
        ...panel(tone, s),
        display: "flex",
        alignItems: "center",
        gap: `${1.4 * s}rem`,
        padding: `${1.2 * s}rem ${1.8 * s}rem`,
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
        el("div", { style: label(s * 0.95) }, e.headline || t.eyebrow),
      el(
        "div",
        { style: { ...display(s, 2.6), marginTop: `${0.5 * s}rem` } },
        e.name,
      ),
      el(
        "div",
        { style: { ...label(s * 0.95), marginTop: `${0.55 * s}rem` } },
        e.detail,
      ),
    ),
    Scanlines(),
  );
}
