/**
 * Small style-object builders reused across layouts: uppercase labels,
 * display-face headings, and the flat "sticker" panel treatment.
 */
import type { ElStyle } from "./dom.js";

/**
 * Uppercase label styling (eyebrows, verbs) at a given size multiplier.
 */
export function label(s: number): ElStyle {
  return {
    fontFamily: "var(--font-label)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: `${1.15 * s}rem`,
    lineHeight: 1.1,
  };
}

/**
 * Display-face heading styling (names, amounts) at a given size and scale.
 */
export function display(s: number, size: number): ElStyle {
  return {
    fontFamily: "var(--font-display)",
    fontSize: `${size * s}rem`,
    lineHeight: 1.06,
    textTransform: "uppercase",
  };
}

/**
 * The flat, hard-bordered "sticker" panel treatment used by most layouts.
 */
export function panel(tone: string, s: number): ElStyle {
  return {
    background: `var(${tone})`,
    color: "var(--void)",
    border: `${Math.round(4 * s)}px solid var(--void)`,
    boxShadow: `${12 * s}px ${12 * s}px 0 var(--void)`,
  };
}
