/**
 * Shared ambient types for the overlay driver scripts. No imports/exports on
 * purpose: each driver compiles to a plain `<script>` (see AGENTS.md), and a
 * global .d.ts is visible to all of them without needing one.
 */

/**
 * The five live Twitch events plus point-reward redemptions.
 */
type AlertType = "follow" | "sub" | "tip" | "bits" | "raid" | "redeem";

/**
 * Escalation level for an alert or reward: small, big, or the full-screen takeover.
 */
type AlertTier = "small" | "big" | "huge";

/**
 * Progress toward a subathon-style goal, shown as a bar under the alert card.
 */
interface AlertGoal {
  /**
   * Current progress value.
   */
  current: number;
  /**
   * Value at which the goal is complete.
   */
  target: number;
  /**
   * Amount `current` increased by on the most recent update, used to animate the bar from its previous position.
   */
  step?: number;
  /**
   * Label shown above the progress numbers, e.g. "Subathon hours".
   */
  label: string;
}

/**
 * Everything a caller can pass to `ZW.fire()`: from StreamElements, from
 * control.html, or from a manual test. Every field beyond `type` is
 * optional because each event type only uses a subset.
 */
interface RawAlertPayload {
  /**
   * Which event this is.
   */
  type: AlertType;
  /**
   * Display name of whoever triggered it, defaults to "someone" if omitted.
   */
  name?: string;
  /**
   * The amount, bits, months, or raid party size, used to pick a tier.
   */
  value?: number;
  /**
   * Optional message or comment to show alongside the alert.
   */
  message?: string;
  /**
   * A square Twitch profile image URL.
   */
  avatar?: string;
  /**
   * Overrides the default tip currency for this one event.
   */
  currency?: string;
  /**
   * Number of subs gifted, if this is a gifted sub.
   */
  gifted?: number;
  /**
   * Twitch sub tier, e.g. 1000/2000/3000 or a plain 1/2/3.
   */
  plan?: string | number;
  /**
   * Forces the tier instead of deriving it from `value`.
   */
  tier?: AlertTier;
  /**
   * Forces a specific layout variant instead of rotating through the type's defaults.
   */
  variant?: string;
  /**
   * The Twitch reward title, for redeem events.
   */
  reward?: string;
  /**
   * Point cost of the reward, for redeem events.
   */
  cost?: number;
  /**
   * Overrides the type's default eyebrow text.
   */
  headline?: string;
  /**
   * Preformatted amount text, overrides the value-derived one.
   */
  amount?: string;
  /**
   * Raid party size, an alternative to `value`.
   */
  party?: number;
  /**
   * 0-1 fraction for the bits meter fill, overrides the value-derived one.
   */
  fill?: number;
  /**
   * Progress toward a subathon-style goal, if tracked.
   */
  goal?: AlertGoal;
  /**
   * Overrides the reward's configured GIF path, for redeem events.
   */
  media?: string;
  /**
   * Overrides the reward's configured accent colour, for redeem events.
   */
  tone?: string;
  /**
   * Set by control.html so the localStorage poll can ignore stale writes.
   */
  at?: number;
}

/**
 * The normalised shape `AlertStage` (in `components/AlertStage.ts`) actually renders.
 */
interface AlertStageEvent {
  /**
   * Which event this is.
   */
  type: AlertType;
  /**
   * Display name shown on the card.
   */
  name: string;
  /**
   * A square profile image URL.
   */
  avatar?: string;
  /**
   * Message or comment shown alongside the alert.
   */
  message?: string;
  /**
   * Progress toward a subathon-style goal, if tracked.
   */
  goal?: AlertGoal;
  /**
   * Which layout variant to render.
   */
  variant?: string;
  /**
   * Escalation level driving the card's size and takeover treatment.
   */
  tier: AlertTier;
  /**
   * Preformatted amount text, e.g. "$25 AUD" or "1,500 bits".
   */
  amount?: string;
  /**
   * Secondary line under the name, e.g. "chucked in" or the reward title.
   */
  detail?: string;
  /**
   * 0-1 fraction for the bits meter fill.
   */
  fill?: number;
  /**
   * Raid party size.
   */
  party?: number;
  /**
   * Profile image URLs for the raiding party, shown as a stack of avatars.
   */
  party_avatars?: string[];
  /**
   * Eyebrow text above the name.
   */
  headline?: string;
  /**
   * The reward title, for redeem events.
   */
  reward?: string;
  /**
   * GIF path to render, for redeem events.
   */
  media?: string;
  /**
   * Point cost of the reward, for redeem events.
   */
  cost?: number;
  /**
   * Accent colour CSS variable, e.g. "--magenta".
   */
  tone?: string;
}

/**
 * One entry from `rewards.json`, keyed by reward title.
 */
interface RewardConfig {
  /**
   * Path to the reward's GIF, relative to the page.
   */
  media?: string;
  /**
   * Point cost shown on the card.
   */
  cost?: number;
  /**
   * Escalation level for this reward's card.
   */
  tier?: AlertTier;
  /**
   * Which layout to render the reward in.
   */
  variant?: string;
  /**
   * Accent colour CSS variable for this reward.
   */
  tone?: string;
  /**
   * Overrides the default "Redeemed" eyebrow text.
   */
  headline?: string;
  /**
   * Overrides the display name, if it should differ from the JSON key.
   */
  reward?: string;
}

/**
 * Resolved `zw-alerts.js` configuration, read once from the query string at load.
 */
interface AlertsConfig {
  /**
   * Milliseconds an alert stays on screen, intro and outro included.
   */
  duration: number;
  /**
   * Offset from the top edge of the canvas, in pixels.
   */
  top: number;
  /**
   * Tip amount at or above which the tier becomes "big".
   */
  tipBig: number;
  /**
   * Tip amount at or above which the tier becomes "huge".
   */
  tipHuge: number;
  /**
   * Bits count at or above which the tier becomes "big".
   */
  bitsBig: number;
  /**
   * Bits count at or above which the tier becomes "huge".
   */
  bitsHuge: number;
  /**
   * Raid party size at or above which the tier becomes "big".
   */
  raidBig: number;
  /**
   * Raid party size at or above which the tier becomes "huge".
   */
  raidHuge: number;
  /**
   * Sub months at or above which the tier becomes "big".
   */
  monthsBig: number;
  /**
   * Gifted sub count at or above which the tier becomes "huge".
   */
  giftHuge: number;
  /**
   * Default currency label for tips that don't specify their own.
   */
  currency: string;
  /**
   * Which event types this page renders; everything else is dropped.
   */
  accept: string[];
  /**
   * Path to the reward book JSON.
   */
  rewards: string;
}

/**
 * The `window.ZW` surface a page or relay script can call.
 */
interface ZwAlertsApi {
  /**
   * Queues and plays one alert.
   */
  fire: (raw: RawAlertPayload) => void;
  /**
   * The resolved configuration this page loaded with.
   */
  config: AlertsConfig;
  /**
   * Normalises a raw payload into the shape `AlertStage` renders, without queuing it.
   */
  build: (raw: RawAlertPayload) => AlertStageEvent;
}

/**
 * A now-playing track, as rendered by the `NowPlaying` component.
 */
interface TrackInfo {
  /**
   * Track title.
   */
  title: string;
  /**
   * Artist name.
   */
  artist: string;
  /**
   * Record label, if known.
   */
  label?: string;
  /**
   * Album art image URL.
   */
  artwork?: string;
  /**
   * 0-1 fraction of the track played so far.
   */
  progress: number;
}

/**
 * The `window.ZWNP` surface a page or relay script can call.
 */
interface ZwNowPlayingApi {
  /**
   * Updates the currently displayed track.
   */
  set: (track: Partial<TrackInfo>) => void;
}

/**
 * The track shape the Now Playing app (nowplayingapp.com) passes to
 * `window.onTrackUpdate` when it serves a custom HTML theme. Only `label`
 * and `artwork` overlap with what this driver renders; the rest depends on
 * the DJ software/hardware in use, so treat every optional field as absent.
 */
interface NowPlayingTrackId {
  /**
   * Unique ID for the track.
   */
  id: string;
  /**
   * Title of the track, including remix info.
   */
  title: string;
  /**
   * Artist of the track.
   */
  artist: string;
  /**
   * URL to the artwork; may be Now Playing's own default artwork.
   */
  artwork: string;
  /**
   * Record label.
   */
  label?: string;
  /**
   * Original BPM of the track.
   */
  bpm?: number;
  /**
   * Rating of the track.
   */
  rating?: number;
  /**
   * Length of the track in seconds.
   */
  length?: number;
  /**
   * User comment on the track.
   */
  comment?: string;
  /**
   * Key signature.
   */
  key?: string;
  /**
   * Current BPM, adjusted for the pitch fader.
   */
  currentBpm?: number;
  /**
   * Link to the track on Spotify.
   */
  spotifyUrl?: string;
  /**
   * Link to the track on Beatport.
   */
  beatportUrl?: string;
  /**
   * Beatport track ID.
   */
  beatportId?: number;
  /**
   * File path of the track on disk.
   */
  filePath?: string;
  /**
   * When the track started playing.
   */
  createdAt?: Date;
}

/**
 * One rotation option for a given `AlertType`, defined component-side.
 */
interface AlertVariantDefinition {
  /**
   * The variant's identifier, matched against `?follow=`/`?sub=`/etc. or `event.variant`.
   */
  id: string;
  /**
   * Which layout component renders this variant.
   */
  layout: string;
  /**
   * Which intro/outro animation pair plays for this variant.
   */
  motion: string;
  /**
   * Whether confetti fires on entry.
   */
  burst?: boolean;
  /**
   * Whether the layout spans the full canvas width instead of sizing to content.
   */
  full?: boolean;
  /**
   * Whether the card shakes on entry.
   */
  shake?: boolean;
  /**
   * Whether the top/bottom accent bands strobe on entry.
   */
  strobe?: boolean;
}

/**
 * Ambient augmentation exposing each driver's public API on `window`.
 */
interface Window {
  /**
   * The alert driver's public API, once `zw-alerts.js` has loaded.
   */
  ZW?: ZwAlertsApi;
  /**
   * The now-playing driver's public API, once `zw-nowplaying.js` has loaded.
   */
  ZWNP?: ZwNowPlayingApi;
  /**
   * Called by the Now Playing app when it's serving this page as a custom
   * HTML theme and the track changes.
   */
  onTrackUpdate?: (track: NowPlayingTrackId) => void;
  /**
   * Called by the Now Playing app's "Hide After" setting to hide the card.
   */
  onHide?: () => void;
  /**
   * Called by the Now Playing app's "Hide After" setting to show the card again.
   */
  onShow?: () => void;
}
