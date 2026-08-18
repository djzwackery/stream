/**
 * Avatar-beside-name layout: follow's "stamp" variant, sub/bits' party/chip variants.
 */
import { el } from "../dom.js";
import { Avatar } from "../Avatar.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Sticker` layout element.
 */
export function Sticker({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  return el(
    "div",
    {
      style: {
        ...panel(tone, s),
        display: "flex",
        alignItems: "center",
        gap: `${1.4 * s}rem`,
        padding: `${1.2 * s}rem ${1.8 * s}rem`,
        rotate: "-2deg",
        position: "relative",
      },
    },
    Avatar({ src: e.avatar, size: 112 * s, ring: "--void", s }),
    el(
      "div",
      null,
      !hideEyebrow && el("div", { style: label(s * 0.95) }, t.eyebrow),
      el(
        "div",
        { style: { ...display(s, 3.1), marginTop: `${0.5 * s}rem` } },
        e.name,
      ),
      el(
        "div",
        { style: { ...label(s * 0.95), marginTop: `${0.55 * s}rem` } },
        e.detail || t.verb,
      ),
    ),
    Scanlines(),
  );
}
