/**
 * Full-width scrolling marquee layout: follow's "ticker", tip's "banner", raid's "band".
 */
import { el } from "../dom.js";
import { Scanlines } from "../Scanlines.js";
import { display } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Strip` layout element.
 */
export function Strip({ e, s, tone, t }: LayoutProps): HTMLElement {
  const words = [
    e.name,
    t.verb.toUpperCase(),
    (e.detail || t.eyebrow).toUpperCase(),
  ].filter(Boolean);
  const run = Array.from({ length: 6 }, () => words).flat();
  return el(
    "div",
    {
      style: {
        width: "100%",
        background: `var(${tone})`,
        color: "var(--void)",
        borderBlock: `${Math.round(5 * s)}px solid var(--void)`,
        overflow: "hidden",
        position: "relative",
      },
    },
    el(
      "div",
      {
        style: {
          display: "flex",
          width: "max-content",
          animation: "zwa-crawl 9s linear infinite",
        },
      },
      ...[0, 1].map((_half) =>
        el(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: `${1.6 * s}rem`,
              padding: `${0.9 * s}rem ${0.8 * s}rem`,
            },
          },
          ...run.flatMap((w) => [
            el("span", { style: display(s, 2.2) }, w),
            el(
              "span",
              { ariaHidden: true, style: { fontSize: `${1.5 * s}rem` } },
              "◆",
            ),
          ]),
        ),
      ),
    ),
    Scanlines(),
  );
}
