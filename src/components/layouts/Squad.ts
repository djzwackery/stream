/**
 * Raiding-party avatar stack layout: raid's "squad".
 */
import { el } from "../dom.js";
import { Avatar } from "../Avatar.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Squad` layout element.
 */
export function Squad({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  // Real raids only ever give a leader; extra tiles fall back to Avatar's
  // placeholder glyph, approximating a crowd without faking identities.
  const avatars = e.party_avatars?.length ? e.party_avatars : [e.avatar];
  const n = Math.min(e.party || 6, 6);
  const tile = 58 * s;
  return el(
    "div",
    {
      style: {
        ...panel(tone, s),
        padding: `${1.2 * s}rem ${1.7 * s}rem`,
        position: "relative",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: `${1.8 * s}rem`,
        rotate: "1deg",
        overflow: "hidden",
      },
    },
    el(
      "div",
      { style: { minWidth: 0 } },
      !hideEyebrow &&
        el("div", { style: label(s * 0.95) }, e.headline || t.eyebrow),
      el(
        "div",
        { style: { ...display(s, 3.2), marginTop: `${0.5 * s}rem` } },
        e.name,
      ),
      el(
        "div",
        { style: { ...label(s * 0.95), marginTop: `${0.55 * s}rem` } },
        e.detail || `${e.party} mates in tow`,
      ),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          height: tile + 14 * s,
          paddingInlineEnd: 8 * s,
        },
      },
      ...Array.from({ length: n }, (_, i) =>
        el(
          "span",
          {
            style: {
              display: "block",
              marginInlineStart: i ? -14 * s : 0,
              animation: `zwa-drop-in .5s steps(3,end) ${0.12 + i * 0.06}s both`,
            },
          },
          Avatar({
            src: avatars[i],
            size: tile,
            ring: "--void",
            s: s * 0.8,
            placeholder: "person",
          }),
        ),
      ),
      (e.party || 0) > n &&
        el(
          "span",
          { style: { ...display(s, 1.5), marginInlineStart: 12 * s } },
          `+${e.party! - n}`,
        ),
    ),
    e.message &&
      el(
        "p",
        {
          style: {
            width: "100%",
            margin: `${0.9 * s}rem 0 0`,
            fontSize: `${1.35 * s}rem`,
            color: "var(--white)",
            maxWidth: "48ch",
            textWrap: "pretty",
          },
        },
        `“${e.message}”`,
      ),
    Scanlines(),
  );
}
