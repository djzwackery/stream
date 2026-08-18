/**
 * Square profile-image slot shared by most alert layouts. Shows a dotted
 * placeholder with a diamond glyph when there's no image, or (opt-in via
 * `placeholder: "person"`) a generic silhouette on a random brand tone.
 */
import { el } from "./dom.js";
import type { AvatarProps } from "./types.js";

const TONES = ["--magenta", "--acid", "--cyan", "--sun"];

const PERSON_SVG = `<svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8.5" r="4"/><path d="M4 20c0-3.8 3.6-6.5 8-6.5s8 2.7 8 6.5"/></svg>`;

function personPlaceholder(): HTMLElement {
  const tone = TONES[Math.floor(Math.random() * TONES.length)]!;
  const wrap = el("span", {
    ariaHidden: true,
    style: {
      width: "100%",
      height: "100%",
      display: "grid",
      placeItems: "center",
      background: `var(${tone})`,
      color: "var(--void)",
    },
  });
  wrap.innerHTML = PERSON_SVG;
  return wrap;
}

/**
 * Builds an `Avatar` element.
 */
export function Avatar({
  src,
  size,
  ring = "--white",
  s = 1,
  placeholder = "diamond",
}: AvatarProps): HTMLElement {
  return el(
    "span",
    {
      style: {
        width: size,
        height: size,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: "var(--void-3)",
        border: `${Math.round(4 * s)}px solid var(${ring})`,
        boxShadow: `${7 * s}px ${7 * s}px 0 var(--void)`,
        overflow: "hidden",
        backgroundImage:
          src || placeholder === "person"
            ? undefined
            : "radial-gradient(color-mix(in oklch, var(--acid) 16%, transparent) 1px, transparent 1px)",
        backgroundSize:
          src || placeholder === "person" ? undefined : "13px 13px",
      },
    },
    src
      ? el("img", {
          src,
          style: {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          },
        })
      : placeholder === "person"
        ? personPlaceholder()
        : el(
            "span",
            {
              ariaHidden: true,
              style: {
                color: "var(--magenta)",
                fontSize: size * 0.44,
                lineHeight: 1,
                textShadow: `3px 3px 0 var(--void)`,
              },
            },
            "◆",
          ),
  );
}
