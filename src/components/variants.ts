/**
 * Variant -> layout + motion, per alert type. Three distinct treatments
 * each, except bits: its 4th, "surge", is Bits Power-Ups' own dedicated
 * layout, not part of the streamer's rotation, forced by baking it in as
 * the only choice on the Streamlabs Power-Up widget rather than picked.
 */

export const VARIANTS: Record<AlertType, AlertVariantDefinition[]> = {
  follow: [
    { id: "stamp", layout: "sticker", motion: "stamp", burst: false },
    { id: "ticker", layout: "strip", motion: "wipe", full: true },
    { id: "glitch", layout: "glitch", motion: "glitch" },
  ],
  sub: [
    { id: "card", layout: "ledger", motion: "drop", shake: true },
    { id: "slab", layout: "slab", motion: "stutter" },
    { id: "party", layout: "sticker", motion: "stamp", burst: true },
  ],
  tip: [
    { id: "receipt", layout: "ledger", motion: "stamp" },
    { id: "jar", layout: "meter", motion: "drop", burst: true },
    { id: "banner", layout: "strip", motion: "wipe", full: true },
  ],
  bits: [
    { id: "meter", layout: "meter", motion: "stutter" },
    { id: "chip", layout: "sticker", motion: "glitch", burst: true },
    { id: "slab", layout: "slab", motion: "drop", shake: true },
    {
      id: "surge",
      layout: "powerup",
      motion: "glitch",
      burst: true,
      shake: true,
      strobe: true,
    },
  ],
  raid: [
    { id: "squad", layout: "squad", motion: "drop", shake: true, burst: true },
    { id: "siren", layout: "glitch", motion: "glitch", strobe: true },
    { id: "band", layout: "strip", motion: "stutter", full: true },
  ],
  redeem: [
    { id: "sidecar", layout: "sidecar", motion: "stamp" },
    { id: "frame", layout: "frame", motion: "drop", shake: true },
    { id: "reel", layout: "reel", motion: "wipe", full: true },
  ],
};
