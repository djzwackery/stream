/**
 * Two-tier eyebrow-bar-plus-body layout: sub/bits' "slab".
 */
import { el } from "../dom.js";
import { Avatar } from "../Avatar.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Slab` layout element.
 */
export function Slab({ e, s, tone, t, hideEyebrow }: LayoutProps): HTMLElement {
  return el(
    "div",
    {
      style: { display: "grid", gap: 0, position: "relative", width: 980 * s },
    },
    el(
      "div",
      {
        style: {
          ...panel(tone, s),
          padding: `${0.7 * s}rem ${1.4 * s}rem`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          ...label(s),
        },
      },
      el("span", null, hideEyebrow ? t.verb : e.headline || t.eyebrow),
      el("span", null, e.detail || t.verb),
    ),
    el(
      "div",
      {
        style: {
          background: "var(--void-2)",
          border: `${Math.round(4 * s)}px solid var(--void)`,
          borderBlockStart: 0,
          boxShadow: `${12 * s}px ${12 * s}px 0 var(--void)`,
          padding: `${1.2 * s}rem ${1.4 * s}rem`,
          display: "flex",
          alignItems: "center",
          gap: `${1.2 * s}rem`,
        },
      },
      Avatar({ src: e.avatar, size: 96 * s, ring: tone, s }),
      el(
        "div",
        { style: { minWidth: 0, flex: 1 } },
        el(
          "div",
          { style: { ...display(s, 2.9), color: "var(--white)" } },
          e.name,
        ),
        e.message &&
          el(
            "p",
            {
              style: {
                margin: `${0.5 * s}rem 0 0`,
                fontSize: `${1.3 * s}rem`,
                color: "var(--ink-dim)",
                maxWidth: "44ch",
                textWrap: "pretty",
              },
            },
            `“${e.message}”`,
          ),
      ),
      e.amount &&
        el(
          "div",
          {
            style: {
              ...display(s, 3.2),
              color: `var(${tone})`,
              textShadow: `${5 * s}px ${5 * s}px 0 var(--void)`,
            },
          },
          e.amount,
        ),
    ),
    Scanlines(),
  );
}
