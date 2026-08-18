/**
 * RGB-glitch centred-text layout: follow's "glitch", raid's "siren".
 */
import { el } from "../dom.js";
import { display, label } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `GlitchName` layout element.
 */
export function GlitchName({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  return el(
    "div",
    { style: { textAlign: "center", position: "relative" } },
    !hideEyebrow &&
      el(
        "div",
        {
          style: {
            ...label(s),
            color: `var(${tone})`,
            textShadow: "3px 3px 0 var(--void)",
          },
        },
        t.eyebrow,
      ),
    el(
      "div",
      {
        style: {
          ...display(s, 5.2),
          color: "var(--white)",
          marginTop: `${0.5 * s}rem`,
          animation: "zwa-rgb 0.5s steps(2, end) infinite",
        },
      },
      e.name,
    ),
    el(
      "div",
      {
        style: {
          ...label(s),
          marginTop: `${0.7 * s}rem`,
          color: "var(--white)",
          background: "var(--void)",
          border: `${Math.round(3 * s)}px solid var(${tone})`,
          display: "inline-block",
          padding: `${0.45 * s}rem ${0.9 * s}rem`,
        },
      },
      e.detail || t.verb,
    ),
  );
}
