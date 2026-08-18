/**
 * Prop shapes shared across the design system's components. `AlertType`,
 * `AlertStageEvent`, `AlertGoal` and friends come from `src/types/global.d.ts`
 * (ambient, ports the shared data shapes to every file); everything here is
 * specific to how these components render that data.
 */

/**
 * Static per-type styling and copy: accent colour, eyebrow label, past-tense verb.
 */
export interface TypeMeta {
  /**
   * CSS custom property name for this type's accent colour, e.g. "--cyan".
   */
  tone: string;
  /**
   * Default label shown above the name when no per-event headline overrides it.
   */
  eyebrow: string;
  /**
   * Past-tense verb used as the default detail line, e.g. "just followed".
   */
  verb: string;
}

/**
 * Props shared by every alert layout component (Sticker, Ledger, Sidecar, ...).
 */
export interface LayoutProps {
  /**
   * The alert event being rendered.
   */
  e: AlertStageEvent;
  /**
   * Size multiplier for this alert's tier.
   */
  s: number;
  /**
   * Resolved accent colour CSS variable for this alert.
   */
  tone: string;
  /**
   * Static copy/tone for this alert's type.
   */
  t: TypeMeta;
  /**
   * True during the huge-tier takeover, where the eyebrow is shown separately above the layout.
   */
  hideEyebrow: boolean;
}

/**
 * Props for the `Avatar` profile-image component.
 */
export interface AvatarProps {
  /**
   * Profile image URL; shows a placeholder glyph when absent.
   */
  src?: string;
  /**
   * Width and height in pixels.
   */
  size: number;
  /**
   * CSS custom property name for the ring colour.
   */
  ring?: string;
  /**
   * Size multiplier, scales the ring width and shadow offset.
   */
  s?: number;
}

/**
 * Props for the `GoalBar` subathon-progress component.
 */
export interface GoalBarProps {
  /**
   * The goal to show progress toward; the bar renders nothing when absent.
   */
  goal?: AlertGoal;
  /**
   * Accent colour CSS variable for the filled portion.
   */
  tone: string;
  /**
   * Size multiplier.
   */
  s: number;
}

/**
 * Props for the `Burst` confetti component.
 */
export interface BurstProps {
  /**
   * How many confetti pieces to spawn.
   */
  count?: number;
  /**
   * "pop" scatters from centre; "fall" rains from the top edge.
   */
  mode?: "pop" | "fall";
  /**
   * Accent colour worked into the confetti palette.
   */
  tone?: string;
}

/**
 * Props for the `MediaBox` reward-GIF component shared by the redeem layouts.
 */
export interface MediaBoxProps {
  /**
   * GIF/image URL; shows a striped placeholder naming the reward when absent.
   */
  src?: string;
  /**
   * Box width in pixels.
   */
  width: number;
  /**
   * Box height in pixels.
   */
  height: number;
  /**
   * Reward name shown in the placeholder when there's no image.
   */
  name?: string;
  /**
   * Size multiplier, scales the placeholder text.
   */
  s: number;
}

/**
 * The three animations that play together for one now-playing track-change swap style.
 */
export interface SwapAnimations {
  /**
   * Animation applied to the artwork on a track change.
   */
  art: string;
  /**
   * Animation applied to the title/artist text on a track change.
   */
  line: string;
  /**
   * Animation applied to the whole card on a track change, if this swap style shakes it.
   */
  card: string | undefined;
}
