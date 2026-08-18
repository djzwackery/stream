/**
 * Square profile-image slot shared by most alert layouts. Shows a dotted
 * placeholder with a diamond glyph when there's no image.
 */
import { el } from "./dom.js";
import type { AvatarProps } from "./types.js";

/**
 * Builds an `Avatar` element.
 */
export function Avatar({
  src,
  size,
  ring = "--white",
  s = 1,
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
        backgroundImage: src
          ? undefined
          : "radial-gradient(color-mix(in oklch, var(--acid) 16%, transparent) 1px, transparent 1px)",
        backgroundSize: src ? undefined : "13px 13px",
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
