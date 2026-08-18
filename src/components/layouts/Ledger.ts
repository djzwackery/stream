/**
 * Avatar-plus-detail-column layout with an optional message and goal bar:
 * sub's "card", tip's "receipt".
 */
import { el } from "../dom.js";
import { Avatar } from "../Avatar.js";
import { GoalBar } from "../GoalBar.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Ledger` layout element.
 */
export function Ledger({
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
        ...panel("--void-2", s),
        color: "var(--white)",
        borderColor: `var(${tone})`,
        boxShadow: `${12 * s}px ${12 * s}px 0 var(${tone})`,
        padding: `${1.3 * s}rem ${1.7 * s}rem`,
        position: "relative",
        minWidth: 620 * s,
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: `${1.3 * s}rem`,
        },
      },
      Avatar({ src: e.avatar, size: 104 * s, ring: tone, s }),
      el(
        "div",
        { style: { flex: 1, minWidth: 0 } },
        !hideEyebrow &&
          el(
            "div",
            { style: { ...label(s * 0.9), color: `var(${tone})` } },
            t.eyebrow,
          ),
        el(
          "div",
          { style: { ...display(s, 2.5), marginTop: `${0.45 * s}rem` } },
          e.name,
        ),
        el(
          "div",
          {
            style: {
              ...label(s * 0.9),
              marginTop: `${0.5 * s}rem`,
              color: "var(--ink-dim)",
            },
          },
          e.detail || t.verb,
        ),
      ),
      e.amount &&
        el(
          "div",
          {
            style: {
              ...display(s, 3.4),
              color: `var(${tone})`,
              textShadow: `${5 * s}px ${5 * s}px 0 var(--void)`,
              whiteSpace: "nowrap",
            },
          },
          e.amount,
        ),
    ),
    e.message &&
      el(
        "p",
        {
          style: {
            margin: `${0.9 * s}rem 0 0`,
            fontSize: `${1.35 * s}rem`,
            color: "var(--white)",
            maxWidth: "48ch",
            textWrap: "pretty",
          },
        },
        `“${e.message}”`,
      ),
    GoalBar({ goal: e.goal, tone, s }),
    Scanlines(),
  );
}
