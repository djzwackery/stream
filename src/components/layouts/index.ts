/**
 * Every alert layout, keyed by the name `AlertVariantDefinition.layout` uses to select one.
 */
import { Frame } from "./Frame.js";
import { GlitchName } from "./GlitchName.js";
import { Ledger } from "./Ledger.js";
import { Meter } from "./Meter.js";
import { PowerUp } from "./PowerUp.js";
import { Reel } from "./Reel.js";
import { Sidecar } from "./Sidecar.js";
import { Slab } from "./Slab.js";
import { Squad } from "./Squad.js";
import { Sticker } from "./Sticker.js";
import { Strip } from "./Strip.js";
import type { LayoutProps } from "../types.js";

export const LAYOUTS: Record<string, (props: LayoutProps) => HTMLElement> = {
  sticker: Sticker,
  strip: Strip,
  glitch: GlitchName,
  ledger: Ledger,
  meter: Meter,
  squad: Squad,
  slab: Slab,
  sidecar: Sidecar,
  frame: Frame,
  reel: Reel,
  powerup: PowerUp,
};
