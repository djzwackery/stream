/**
 * High-voltage containment window for Bits Power-Ups: hazard-striped bars
 * bracket the triggered image, the power-up's own name billed bigger than
 * who spent the bits on it, that's the part worth hyping.
 */
import { el } from "../dom.js";
import { MediaBox } from "../MediaBox.js";
import { Scanlines } from "../Scanlines.js";
import { display, label } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

const HAZARD_STRIPES =
  "repeating-linear-gradient(45deg, var(--sun) 0, var(--sun) var(--stripe), var(--void) var(--stripe), var(--void) calc(var(--stripe) * 2))";

function hazardBar(s: number, position: "top" | "bottom"): HTMLElement {
  const innerEdge = position === "top" ? "borderBottom" : "borderTop";
  return el("span", {
    ariaHidden: true,
    style: {
      display: "block",
      height: 10 * s,
      backgroundImage: HAZARD_STRIPES,
      "--stripe": `${14 * s}px`,
      [innerEdge]: `${Math.round(3 * s)}px solid var(--void)`,
    },
  });
}

/**
 * Builds a `PowerUp` layout element.
 */
export function PowerUp({
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
        position: "relative",
        width: 700 * s,
        background: "var(--void-2)",
        border: `${Math.round(4 * s)}px solid var(--void)`,
        boxShadow: `${12 * s}px ${12 * s}px 0 var(${tone})`,
        overflow: "hidden",
      },
    },
    hazardBar(s, "top"),
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: `${1.6 * s}rem`,
          padding: `${1.3 * s}rem ${1.7 * s}rem`,
        },
      },
      el(
        "div",
        { style: { position: "relative", flexShrink: 0 } },
        MediaBox({
          src: e.avatar,
          width: 190 * s,
          height: 190 * s,
          name: e.reward || "power-up",
          s,
        }),
        el(
          "span",
          {
            ariaHidden: true,
            style: {
              position: "absolute",
              insetBlockStart: -10 * s,
              insetInlineEnd: -10 * s,
              ...display(s, 1.4),
              background: "var(--sun)",
              color: "var(--void)",
              width: 40 * s,
              height: 40 * s,
              display: "grid",
              placeItems: "center",
              border: `${Math.round(3 * s)}px solid var(--void)`,
              rotate: "8deg",
            },
          },
          "⚡",
        ),
      ),
      el(
        "div",
        { style: { minWidth: 0 } },
        !hideEyebrow &&
          el(
            "div",
            { style: { ...label(s * 0.9), color: "var(--sun)" } },
            e.headline || t.eyebrow,
          ),
        el(
          "div",
          {
            style: {
              ...display(s, 3.4),
              color: "var(--white)",
              marginTop: `${0.35 * s}rem`,
              textShadow: `${4 * s}px ${4 * s}px 0 var(--magenta)`,
              animation: "zwa-rgb 0.6s steps(2,end) infinite",
            },
          },
          e.reward || e.name,
        ),
        el(
          "div",
          {
            style: {
              ...label(s * 0.95),
              marginTop: `${0.6 * s}rem`,
              color: "var(--ink-dim)",
            },
          },
          e.amount ? `${e.name} · ${e.amount}` : e.name,
        ),
        e.message &&
          el(
            "p",
            {
              style: {
                margin: `${0.7 * s}rem 0 0`,
                fontSize: `${1.25 * s}rem`,
                color: "var(--white)",
                maxWidth: "38ch",
                textWrap: "pretty",
              },
            },
            `“${e.message}”`,
          ),
      ),
    ),
    hazardBar(s, "bottom"),
    Scanlines(),
  );
}
