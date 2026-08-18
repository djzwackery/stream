/**
 * Static data tables shared across the alert layer and now-playing card:
 * keyframes, per-type copy, tier scaling, and motion/swap animation pairs.
 */
import type { SwapAnimations, TypeMeta } from "./types.js";

/**
 * Alert layer keyframes: stamp, VHS stutter, RGB glitch, wipe, drop, shake,
 * strobe, confetti fall/pop, and the goal-bar fill. Injected once into
 * `<head>` by `AlertStage`.
 */
export const KEYFRAMES = `
@keyframes zwa-stamp-in {
  0% { transform: scale(2.2) rotate(-6deg); opacity: 0; }
  40% { opacity: 1; }
  60% { transform: scale(0.94) rotate(1deg); }
  80% { transform: scale(1.04) rotate(-1deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes zwa-stamp-out {
  0% { transform: scale(1); opacity: 1; }
  30% { transform: scale(1.07); }
  100% { transform: scale(0.6) translateY(-40px); opacity: 0; }
}
@keyframes zwa-stutter-in {
  0% { transform: translateX(-140%); opacity: 0; }
  20% { opacity: 1; }
  25% { transform: translateX(6%); }
  45% { transform: translateX(-10%); }
  65% { transform: translateX(3%); }
  85% { transform: translateX(-2%); }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes zwa-stutter-out {
  0% { transform: translateX(0); opacity: 1; }
  25% { transform: translateX(-4%); }
  100% { transform: translateX(140%); opacity: 0; }
}
@keyframes zwa-glitch-in {
  0% { opacity: 0; clip-path: inset(45% 0 45% 0); }
  15% { opacity: 1; clip-path: inset(0 0 62% 0); transform: translateX(-18px); }
  30% { clip-path: inset(58% 0 12% 0); transform: translateX(14px); }
  45% { clip-path: inset(10% 0 40% 0); transform: translateX(-8px); }
  60% { clip-path: inset(0 0 0 0); transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  100% { clip-path: inset(0 0 0 0); transform: translateX(0); }
}
@keyframes zwa-glitch-out {
  0% { clip-path: inset(0 0 0 0); opacity: 1; }
  25% { clip-path: inset(0 0 55% 0); transform: translateX(16px); }
  50% { clip-path: inset(48% 0 0 0); transform: translateX(-20px); }
  75% { clip-path: inset(40% 0 40% 0); }
  100% { clip-path: inset(50% 0 50% 0); opacity: 0; }
}
@keyframes zwa-wipe-in {
  0% { clip-path: inset(0 100% 0 0); opacity: 1; }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes zwa-wipe-out {
  0% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(0 0 0 100%); }
}
@keyframes zwa-drop-in {
  0% { transform: translateY(-160%) rotate(-3deg); opacity: 0; }
  55% { transform: translateY(9%) rotate(1deg); opacity: 1; }
  75% { transform: translateY(-4%); }
  100% { transform: translateY(0) rotate(0); }
}
@keyframes zwa-drop-out {
  0% { transform: translateY(0); opacity: 1; }
  20% { transform: translateY(7%); }
  100% { transform: translateY(-170%); opacity: 0; }
}
@keyframes zwa-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-7px, 4px); }
  40% { transform: translate(6px, -5px); }
  60% { transform: translate(-4px, -3px); }
  80% { transform: translate(5px, 3px); }
}
@keyframes zwa-crawl {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@keyframes zwa-blink {
  50% { opacity: 0.2; }
}
@keyframes zwa-strobe {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.32; }
}
@keyframes zwa-rgb {
  0%, 100% { text-shadow: 6px 0 0 var(--cyan), -6px 0 0 var(--magenta); }
  33% { text-shadow: -9px 0 0 var(--cyan), 9px 0 0 var(--magenta); }
  66% { text-shadow: 3px 0 0 var(--magenta), -3px 0 0 var(--cyan); }
}
@keyframes zwa-fall {
  0% { transform: translate(0, -120px) rotate(0); opacity: 1; }
  100% { transform: translate(var(--dx), 980px) rotate(var(--dr)); opacity: 0; }
}
@keyframes zwa-pop {
  0% { transform: scale(0) rotate(0); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--dr)); opacity: 0; }
}
@keyframes zwa-bar {
  from { width: var(--from); }
  to { width: var(--to); }
}
`;

/**
 * Now-playing keyframes: the swap-in/out for the whole card, plus per-piece
 * artwork/title/artist swap animations and the fresh-track flash. Injected
 * once into `<head>` by `NowPlaying`.
 */
export const NP_KEYFRAMES = `
@keyframes zw-np {
  50% { opacity: 0.25; }
}
@keyframes zw-np-card {
  0% { transform: translateX(0); }
  12% { transform: translateX(-6px); }
  24% { transform: translateX(4px); }
  40% { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}
@keyframes zw-np-art {
  0% { clip-path: inset(0 100% 0 0); }
  30% { clip-path: inset(0 55% 0 0); }
  55% { clip-path: inset(0 34% 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}
@keyframes zw-np-artflip {
  0% { transform: rotateY(90deg) scale(0.9); }
  55% { transform: rotateY(-12deg) scale(1.02); }
  100% { transform: rotateY(0) scale(1); }
}
@keyframes zw-np-line {
  0% { opacity: 0; transform: translateX(26px); clip-path: inset(0 0 0 100%); }
  25% { opacity: 1; transform: translateX(-6px); }
  45% { transform: translateX(3px); clip-path: inset(0 0 0 12%); }
  70% { transform: translateX(-2px); }
  100% { opacity: 1; transform: translateX(0); clip-path: inset(0 0 0 0); }
}
@keyframes zw-np-rgb {
  0%, 100% { text-shadow: none; }
  20% { text-shadow: 5px 0 0 var(--cyan), -5px 0 0 var(--magenta); }
  40% { text-shadow: -7px 0 0 var(--cyan), 7px 0 0 var(--magenta); }
  70% { text-shadow: 2px 0 0 var(--magenta), -2px 0 0 var(--cyan); }
}
@keyframes zw-np-flash {
  0%, 100% { background: transparent; }
  25% { background: color-mix(in oklch, var(--acid) 55%, transparent); }
  60% { background: transparent; }
  80% { background: color-mix(in oklch, var(--acid) 30%, transparent); }
}
@keyframes zw-np-bar {
  from { width: 0; }
}
@keyframes zw-np-in {
  0% { opacity: 0; transform: translateY(30px); }
  45% { opacity: 1; transform: translateY(-6px); }
  70% { transform: translateY(3px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes zw-np-out {
  0% { opacity: 1; transform: translateY(0); clip-path: inset(0 0 0 0); }
  40% { transform: translateY(6px); }
  100% { opacity: 0; transform: translateY(22px); clip-path: inset(0 0 100% 0); }
}
`;

/**
 * Default accent colour, eyebrow and verb per alert type.
 */
export const TYPE: Record<AlertType, TypeMeta> = {
  follow: { tone: "--cyan", eyebrow: "New follower", verb: "just followed" },
  sub: { tone: "--magenta", eyebrow: "Subscriber", verb: "just subscribed" },
  tip: { tone: "--sun", eyebrow: "Tip jar", verb: "chucked in" },
  bits: { tone: "--acid", eyebrow: "Bits", verb: "cheered" },
  raid: {
    tone: "--magenta",
    eyebrow: "Incoming raid",
    verb: "is raiding with",
  },
  redeem: { tone: "--acid", eyebrow: "Redeemed", verb: "redeemed" },
};

/**
 * Size multiplier per alert tier.
 */
export const TIER: Record<AlertTier, number> = {
  small: 0.82,
  big: 1,
  huge: 1.3,
};

/**
 * Confetti piece colours, cycled through when an event has no specific tone.
 */
export const CONFETTI_TONES = [
  "--magenta",
  "--acid",
  "--cyan",
  "--sun",
  "--white",
];

/**
 * Intro/outro keyframe animation pair per motion style.
 */
export const MOTION: Record<string, [string, string]> = {
  stamp: [
    "zwa-stamp-in 0.5s steps(4, end) both",
    "zwa-stamp-out 0.42s steps(3, end) both",
  ],
  stutter: [
    "zwa-stutter-in 0.55s steps(5, end) both",
    "zwa-stutter-out 0.4s steps(4, end) both",
  ],
  glitch: [
    "zwa-glitch-in 0.55s steps(6, end) both",
    "zwa-glitch-out 0.4s steps(5, end) both",
  ],
  wipe: [
    "zwa-wipe-in 0.4s steps(8, end) both",
    "zwa-wipe-out 0.35s steps(6, end) both",
  ],
  drop: [
    "zwa-drop-in 0.5s cubic-bezier(0.2,0.9,0.25,1) both",
    "zwa-drop-out 0.4s cubic-bezier(0.4,0,1,1) both",
  ],
};

/**
 * Which animations play together for each now-playing track-change swap style.
 */
export const SWAP: Record<string, SwapAnimations> = {
  stutter: {
    art: "zw-np-art 0.42s steps(4, end) both",
    line: "zw-np-line 0.42s steps(4, end) both",
    card: "zw-np-card 0.32s steps(3, end) both",
  },
  flip: {
    art: "zw-np-artflip 0.5s cubic-bezier(0.2,0.9,0.25,1) both",
    line: "zw-np-line 0.42s steps(3, end) both",
    card: undefined,
  },
  glitch: {
    art: "zw-np-art 0.4s steps(6, end) both",
    line: "zw-np-line 0.4s steps(5, end) both, zw-np-rgb 0.45s steps(3, end) both",
    card: "zw-np-card 0.36s steps(4, end) both",
  },
};
