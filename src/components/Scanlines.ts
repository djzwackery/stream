/**
 * CRT scanline overlay used as a decorative texture on most alert layouts.
 */
import { el } from "./dom.js";

/**
 * Builds a `Scanlines` element.
 */
export function Scanlines(): HTMLElement {
  return el("span", {
    ariaHidden: true,
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      backgroundImage:
        "repeating-linear-gradient(to bottom, color-mix(in oklch, var(--void) 22%, transparent) 0 2px, transparent 2px 5px)",
    },
  });
}
