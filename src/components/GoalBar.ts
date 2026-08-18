/**
 * Subathon-style progress bar, shown under an alert card when the event
 * carries a goal.
 */
import { el } from "./dom.js";
import { label } from "./style-helpers.js";
import type { GoalBarProps } from "./types.js";

/**
 * Builds a `GoalBar` element, or `null` when there's no goal to show.
 */
export function GoalBar({ goal, tone, s }: GoalBarProps): HTMLElement | null {
  if (!goal) {
    return null;
  }
  const pct = Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
  const from = Math.max(
    0,
    Math.min(100, ((goal.current - (goal.step ?? 0)) / goal.target) * 100),
  );
  return el(
    "div",
    { style: { marginTop: `${0.8 * s}rem`, minWidth: 320 * s } },
    el(
      "div",
      {
        style: {
          ...label(s * 0.78),
          display: "flex",
          justifyContent: "space-between",
          color: "inherit",
          opacity: 0.85,
        },
      },
      el("span", null, goal.label),
      el("span", null, `${goal.current} / ${goal.target}`),
    ),
    el(
      "span",
      {
        style: {
          display: "block",
          height: 12 * s,
          marginTop: `${0.35 * s}rem`,
          background: "var(--void)",
          border: `${Math.round(3 * s)}px solid var(--void)`,
        },
      },
      el("span", {
        style: {
          display: "block",
          height: "100%",
          background: `var(${tone})`,
          "--from": `${from}%`,
          "--to": `${pct}%`,
          width: `${pct}%`,
          animation: "zwa-bar 1.1s cubic-bezier(0.3,0.7,0.2,1) both",
        },
      }),
    ),
  );
}
