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
function diamondPlaceholder(size: number): HTMLElement {
  return el(
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
  );
}

export function Avatar({
  src,
  size,
  ring = "--white",
  s = 1,
  placeholder = "diamond",
}: AvatarProps): HTMLElement {
  const wrap = el("span", {
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
    },
  });

  // Also the fallback if `src` 404s or otherwise fails to load, not just
  // when it's absent to begin with: the browser already tried and failed,
  // no point leaving a broken-image icon up in its place.
  function showPlaceholder(): void {
    Object.assign(wrap.style, {
      backgroundImage:
        placeholder === "person"
          ? ""
          : "radial-gradient(color-mix(in oklch, var(--acid) 16%, transparent) 1px, transparent 1px)",
      backgroundSize: placeholder === "person" ? "" : "13px 13px",
    });
    wrap.replaceChildren(
      placeholder === "person" ? personPlaceholder() : diamondPlaceholder(size),
    );
  }

  if (src) {
    wrap.append(
      el("img", {
        src,
        onError: showPlaceholder,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        },
      }),
    );
  } else {
    showPlaceholder();
  }

  return wrap;
}
