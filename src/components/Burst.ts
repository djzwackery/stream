/**
 * Confetti burst played on entry for high-energy alerts and the huge-tier takeover.
 */
import { el } from "./dom.js";
import { CONFETTI_TONES } from "./tokens.js";
import type { BurstProps } from "./types.js";

/**
 * One confetti piece's computed position, colour and animation timing.
 */
interface BurstPiece {
  /**
   * This piece's index, also used as its DOM position.
   */
  k: number;
  /**
   * CSS custom property name for this piece's colour.
   */
  tone: string;
  /**
   * Horizontal travel distance in pixels, used as a CSS custom property by the fall/pop keyframes.
   */
  dx: number;
  /**
   * Vertical travel distance in pixels, used as a CSS custom property by the pop keyframe.
   */
  dy: number;
  /**
   * Rotation amount, e.g. "180deg", used as a CSS custom property by the fall/pop keyframes.
   */
  dr: string;
  /**
   * Width and height in pixels.
   */
  size: number;
  /**
   * Animation start delay in seconds, staggers the pieces.
   */
  delay: number;
  /**
   * Whether this piece renders as a diamond instead of a square.
   */
  diamond: boolean;
  /**
   * Starting horizontal position as a percentage, used by the "fall" mode.
   */
  left: string;
}

function computePieces(
  count: number,
  mode: "pop" | "fall",
  tone: string | undefined,
): BurstPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 3);
    const d = 220 + ((i * 47) % 320);
    return {
      k: i,
      tone:
        tone && i % 3 === 0 ? tone : CONFETTI_TONES[i % CONFETTI_TONES.length]!,
      dx: Math.round(Math.cos(a) * d),
      dy: Math.round(Math.sin(a) * d),
      dr: `${((i * 71) % 720) - 360}deg`,
      size: 14 + ((i * 13) % 22),
      delay: (i % 7) * 0.045,
      diamond: i % 4 === 0,
      left: `${(i * 97) % 100}%`,
    };
  });
}

/**
 * Builds a `Burst` element containing `count` animated confetti pieces.
 */
export function Burst({
  count = 26,
  mode = "pop",
  tone,
}: BurstProps): HTMLElement {
  const pieces = computePieces(count, mode, tone);
  return el(
    "div",
    {
      ariaHidden: true,
      style: {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        display: "grid",
        placeItems: "center",
      },
    },
    ...pieces.map((p) =>
      el("span", {
        style: {
          position: "absolute",
          ...(mode === "fall" ? { left: p.left, top: 0 } : {}),
          width: p.size,
          height: p.size,
          background: `var(${p.tone})`,
          border: "2px solid var(--void)",
          rotate: p.diamond ? "45deg" : "0deg",
          "--dx": `${p.dx}px`,
          "--dy": `${p.dy}px`,
          "--dr": p.dr,
          animation: `${mode === "fall" ? "zwa-fall 2.4s cubic-bezier(0.4,0,1,1)" : "zwa-pop 1.1s cubic-bezier(0.2,0.8,0.3,1)"} ${p.delay}s both`,
        },
      }),
    ),
  );
}
