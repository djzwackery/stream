/**
 * Segmented fill-bar layout: bits' "meter", tip's "jar".
 */
import { el } from "../dom.js";
import { Avatar } from "../Avatar.js";
import { GoalBar } from "../GoalBar.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Meter` layout element.
 */
export function Meter({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  const seg = 14;
  const filled = Math.round((e.fill ?? 0.6) * seg);
  return el(
    "div",
    {
      style: {
        ...panel("--void-2", s),
        color: "var(--white)",
        borderColor: "var(--void)",
        boxShadow: `${12 * s}px ${12 * s}px 0 var(${tone})`,
        padding: `${1.2 * s}rem ${1.6 * s}rem`,
        position: "relative",
        minWidth: 700 * s,
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: `${1.2 * s}rem`,
        },
      },
      el(
        "div",
        {
          style: { display: "flex", alignItems: "center", gap: `${1 * s}rem` },
        },
        Avatar({ src: e.avatar, size: 78 * s, ring: tone, s }),
        el(
          "div",
          null,
          !hideEyebrow &&
            el(
              "div",
              { style: { ...label(s * 0.85), color: `var(${tone})` } },
              e.headline || t.eyebrow,
            ),
          el(
            "div",
            { style: { ...display(s, 2.2), marginTop: `${0.4 * s}rem` } },
            e.name,
          ),
        ),
      ),
      el(
        "div",
        {
          style: {
            ...display(s, 3.6),
            color: `var(${tone})`,
            textShadow: `${5 * s}px ${5 * s}px 0 var(--void)`,
          },
        },
        e.amount || e.detail,
      ),
    ),
    el(
      "div",
      { style: { display: "flex", gap: 4 * s, marginTop: `${0.9 * s}rem` } },
      ...Array.from({ length: seg }, (_, i) =>
        el("span", {
          style: {
            flex: 1,
            height: 18 * s,
            background: i < filled ? `var(${tone})` : "var(--void)",
            border: `${Math.round(2 * s)}px solid var(${i < filled ? tone : "--void-3"})`,
            animation:
              i < filled
                ? `zwa-blink 0.5s steps(2,jump-none) ${i * 0.05}s 2`
                : undefined,
          },
        }),
      ),
    ),
    e.message &&
      el(
        "p",
        {
          style: {
            margin: `${0.8 * s}rem 0 0`,
            fontSize: `${1.3 * s}rem`,
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
