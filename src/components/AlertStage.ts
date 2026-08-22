/**
 * The stream alert layer. Mount one over your scene, then call `show()`
 * per event; it plays intro -> hold -> exit and calls `onDone`. There's no
 * "hold" visual difference from "in" except that it's when the entry shake
 * animation stops, everything else about the phase is just bookkeeping for
 * knowing when to swap to the exit animation.
 */
import { Burst } from "./Burst.js";
import { el } from "./dom.js";
import { injectStylesheet } from "./dom.js";
import { LAYOUTS } from "./layouts/index.js";
import { display } from "./style-helpers.js";
import { KEYFRAMES, MOTION, TIER, TYPE } from "./tokens.js";
import { VARIANTS } from "./variants.js";

/**
 * Redemptions come from a separate, uncoordinated system from Streamlabs'
 * own Alert Box (see ARCHITECTURE.md's Event flow section), so there's no
 * way to know when a Streamlabs alert is already on screen. Rather than
 * risk landing on top of one, redemptions always render at this reduced
 * scale, tucked into the corner below, and never take the full-bleed
 * takeover treatment, regardless of tier.
 */
const REDEEM_SCALE = 0.8;

/**
 * Left and bottom inset, in pixels, for the redeem corner anchor.
 */
const REDEEM_INSET = 56;

/**
 * Constructor options for `AlertStage`.
 */
export interface AlertStageOptions {
  /**
   * Offset from the top edge of the canvas, in pixels, for non-takeover tiers.
   */
  top: number;
  /**
   * Called once the outro animation finishes and the canvas is clear again.
   */
  onDone: () => void;
}

/**
 * Manages the alert layer's DOM inside `container`, one event at a time.
 */
export class AlertStage {
  private readonly container: HTMLElement;
  private readonly top: number;
  private readonly onDone: () => void;
  private timers: number[] = [];

  constructor(container: HTMLElement, options: AlertStageOptions) {
    this.container = container;
    this.top = options.top;
    this.onDone = options.onDone;
    injectStylesheet("zwa-keyframes", KEYFRAMES);
  }

  /**
   * Plays one alert event, replacing whatever is currently shown.
   */
  show(event: AlertStageEvent, duration: number): void {
    // Everything here leans on CSS custom properties (var(--void), var(--font-display),
    // ...) defined in styles.css/tokens/*.css, not inline: if those haven't
    // finished loading yet, this renders as blank/colourless, not just
    // "unstyled" HTML. Streamlabs reloads this page fresh for every single
    // alert, re-fetching that CSS from scratch each time, not just once per
    // stream, so this is worth guarding rather than trusting timing. Once
    // `load` fires, re-entering with the same arguments proceeds normally.
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => this.show(event, duration), {
        once: true,
      });
      return;
    }
    this.clearTimers();
    this.container.replaceChildren();

    const t = TYPE[event.type] || TYPE.follow;
    const tone = event.tone || t.tone;
    const list = VARIANTS[event.type] ?? VARIANTS.follow;
    const v = list.find((x) => x.id === event.variant) ?? list[0]!;
    const tier = event.tier || "big";
    const isRedeem = event.type === "redeem";
    const takeover = tier === "huge" && !isRedeem;
    const s =
      TIER[tier] *
      (takeover ? (v.full ? 1.05 : 1.15) : 1) *
      (isRedeem ? REDEEM_SCALE : 1);
    const Layout = LAYOUTS[v.layout]!;
    const [inAnim, outAnim] = MOTION[v.motion]!;
    const burst = v.burst || takeover;

    const outer = el("div", {
      style: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 120,
        overflow: "hidden",
        display: "grid",
        placeItems: takeover
          ? "center"
          : isRedeem
            ? "end start"
            : "start center",
        paddingTop: takeover || isRedeem ? 0 : this.top,
        paddingInlineStart: isRedeem ? REDEEM_INSET : 0,
        paddingBlockEnd: isRedeem ? REDEEM_INSET : 0,
        gridTemplateColumns: v.full && !isRedeem ? "1fr" : "auto",
      },
    });

    const scrim = takeover
      ? el("span", {
          ariaHidden: true,
          style: {
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 45%, color-mix(in oklch, var(--void) 52%, transparent) 0%, color-mix(in oklch, var(--void) 34%, transparent) 55%, color-mix(in oklch, var(--void) 18%, transparent) 100%)",
            animation: "zwa-wipe-in .3s steps(6,end) both",
          },
        })
      : null;
    if (scrim) {
      outer.append(scrim);
    }

    let strobeTop: HTMLElement | null = null;
    let strobeBottom: HTMLElement | null = null;
    if (v.strobe || takeover) {
      strobeTop = el("span", {
        ariaHidden: true,
        style: {
          position: "absolute",
          insetInline: 0,
          insetBlockStart: 0,
          height: "13%",
          background: `linear-gradient(to bottom, var(${tone}), transparent)`,
          mixBlendMode: "screen",
          opacity: 0,
          animation: "zwa-strobe 0.26s steps(2, jump-none) 3 both",
        },
      });
      strobeBottom = el("span", {
        ariaHidden: true,
        style: {
          position: "absolute",
          insetInline: 0,
          insetBlockEnd: 0,
          height: "13%",
          background: `linear-gradient(to top, var(${tone}), transparent)`,
          mixBlendMode: "screen",
          opacity: 0,
          animation: "zwa-strobe 0.26s steps(2, jump-none) 3 both",
        },
      });
      outer.append(strobeTop, strobeBottom);
    }

    const animWrapper = el("div", {
      style: {
        position: "relative",
        justifySelf: isRedeem ? "start" : v.full ? "stretch" : "center",
        animation: inAnim,
        willChange: "transform, clip-path, opacity",
      },
    });
    const shakeWrapper = el("div", {
      style: {
        animation: v.shake ? "zwa-shake 0.4s steps(2, end) 2" : undefined,
        display: v.full ? "block" : "inline-block",
      },
    });

    if (takeover && !v.full) {
      shakeWrapper.append(
        el(
          "div",
          {
            style: {
              ...display(s, 4.2),
              color: `var(${tone})`,
              textAlign: "center",
              marginBottom: `${1.1 * s}rem`,
              textShadow: `${8 * s}px ${8 * s}px 0 var(--void)`,
              animation: "zwa-rgb 0.5s steps(2,end) infinite",
            },
          },
          event.headline || t.eyebrow,
        ),
      );
    }
    shakeWrapper.append(
      Layout({ e: event, s, tone, t, hideEyebrow: takeover }),
    );
    animWrapper.append(shakeWrapper);
    outer.append(animWrapper);

    const burstEl = burst
      ? Burst({
          mode: takeover ? "fall" : "pop",
          count: takeover ? 44 : 24,
          tone,
        })
      : null;
    if (burstEl) {
      outer.append(burstEl);
    }

    this.container.append(outer);

    this.timers.push(
      window.setTimeout(() => {
        shakeWrapper.style.animation = "";
      }, 700),
    );
    // duration <= 0 means hold forever, for eyeballing a layout's actual
    // size/position without it clearing mid-look: skip scheduling the
    // outro and the auto-clear entirely, rather than just picking a very
    // large number and hoping nobody waits that long.
    if (duration <= 0) {
      return;
    }
    this.timers.push(
      window.setTimeout(
        () => {
          animWrapper.style.animation = outAnim;
          if (scrim) {
            scrim.style.animation = "zwa-wipe-out .35s steps(6,end) both";
          }
          strobeTop?.remove();
          strobeBottom?.remove();
          burstEl?.remove();
        },
        Math.max(1200, duration - 600),
      ),
    );
    this.timers.push(
      window.setTimeout(() => {
        this.container.replaceChildren();
        this.onDone();
      }, duration),
    );
  }

  private clearTimers(): void {
    for (const id of this.timers) {
      clearTimeout(id);
    }
    this.timers = [];
  }
}
