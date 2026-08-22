/**
 * On-screen now-playing card. Static between songs; when the track changes
 * it plays a stepped swap (artwork wipe, stuttered text, a brief flash, the
 * progress rule resetting), same stepped register as the alert layer. A
 * progress-only update (same track, further along) just slides the fill,
 * no swap.
 */
import { el, injectStylesheet } from "./dom.js";
import { NP_KEYFRAMES, SWAP } from "./tokens.js";

/**
 * How long the fresh-track flash (eyebrow highlight + border glow) lasts, in milliseconds.
 */
const FLASH_MS = 2600;

/**
 * Constructor options for `NowPlayingCard`.
 */
export interface NowPlayingOptions {
  /**
   * Renders the smaller, corner-friendly layout instead of the full-size card.
   */
  compact: boolean;
  /**
   * Uniform size multiplier.
   */
  scale: number;
  /**
   * Which animation plays when the track changes.
   */
  swap: "stutter" | "flip" | "glitch";
}

/**
 * Manages the now-playing card's DOM inside `container`.
 */
export class NowPlayingCard {
  private readonly compact: boolean;
  private readonly scale: number;
  private readonly swapStyle: "stutter" | "flip" | "glitch";
  private readonly cardEl: HTMLElement;
  private fillEl: HTMLElement | null = null;
  private lastTrackKey: string | null = null;
  private freshTimer: number | undefined;

  constructor(container: HTMLElement, options: NowPlayingOptions) {
    this.compact = options.compact;
    this.scale = options.scale;
    this.swapStyle = options.swap;
    injectStylesheet("zw-np-keyframes", NP_KEYFRAMES);
    this.cardEl = el("div", {
      style: {
        display: "inline-flex",
        alignItems: "stretch",
        gap: this.compact ? this.rem(0.9) : this.rem(1.25),
        background: "color-mix(in oklch, var(--void-2) 88%, transparent)",
        border: "var(--edge) solid var(--void)",
        boxShadow: "var(--shadow-hard)",
        padding: this.compact ? this.rem(0.7) : this.rem(0.95),
        maxWidth: (this.compact ? 520 : 720) * this.scale,
        position: "relative",
        transition: "box-shadow 0.15s steps(2, end)",
        animation: "zw-np-out 0.38s steps(3, end) both",
      },
    });
    container.append(this.cardEl);
  }

  /**
   * Updates the card to show `track`, or hides it (plays the exit
   * animation) when `visible` is false.
   */
  update(track: TrackInfo, visible: boolean): void {
    // Same CSS-custom-property dependency as AlertStage.show(), same guard:
    // never render against styles.css/tokens/*.css before they've loaded.
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => this.update(track, visible), {
        once: true,
      });
      return;
    }
    this.cardEl.style.animation = visible
      ? "zw-np-in 0.5s steps(4, end) both"
      : "zw-np-out 0.38s steps(3, end) both";

    const trackKey = `${track.title}|${track.artist}`;
    const isFirst = this.lastTrackKey === null;
    const trackChanged = isFirst || trackKey !== this.lastTrackKey;
    this.lastTrackKey = trackKey;

    if (trackChanged) {
      const fresh = !isFirst;
      clearTimeout(this.freshTimer);
      this.renderSwapContent(track, fresh);
      if (fresh) {
        this.freshTimer = window.setTimeout(
          () => this.renderFreshState(false),
          FLASH_MS,
        );
      }
      return;
    }
    if (this.fillEl) {
      this.fillEl.style.width = `${Math.max(0, Math.min(100, track.progress))}%`;
    }
  }

  private rem(n: number): string {
    return `${n * this.scale}rem`;
  }

  private renderFreshState(fresh: boolean): void {
    this.cardEl.style.boxShadow = fresh
      ? `${8 * this.scale}px ${8 * this.scale}px 0 var(--acid)`
      : "var(--shadow-hard)";
    const eyebrow = this.cardEl.querySelector<HTMLElement>("[data-eyebrow]");
    if (eyebrow) {
      eyebrow.textContent = "";
      eyebrow.append(
        el("span", {
          style: {
            width: this.rem(0.45),
            height: this.rem(0.45),
            borderRadius: "50%",
            background: "currentColor",
            animation: "zw-np 1s steps(2, jump-none) infinite",
          },
        }),
        fresh ? "New track" : "Now playing",
      );
      Object.assign(eyebrow.style, {
        color: fresh ? "var(--void)" : "var(--acid)",
        background: fresh ? "var(--acid)" : "transparent",
        padding: fresh ? `${0.12 * this.scale}rem ${0.4 * this.scale}rem` : "0",
        marginInlineStart: fresh ? `${-0.4 * this.scale}rem` : "0",
      });
    }
    this.cardEl.querySelector("[data-flash]")?.remove();
  }

  private renderSwapContent(track: TrackInfo, fresh: boolean): void {
    const m = SWAP[this.swapStyle] ?? SWAP.stutter!;
    const art = (this.compact ? 84 : 132) * this.scale;

    this.cardEl.style.boxShadow = fresh
      ? `${8 * this.scale}px ${8 * this.scale}px 0 var(--acid)`
      : "var(--shadow-hard)";

    const artEl = el("div", {
      style: {
        width: art,
        height: art,
        flexShrink: 0,
        border: `${4 * this.scale}px solid var(--white)`,
        boxShadow: `${7 * this.scale}px ${7 * this.scale}px 0 var(--magenta)`,
        background: "var(--void-3)",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        animation: m.art,
      },
    });

    // Also the fallback if `track.artwork` 404s or otherwise fails to load,
    // not just when there's no artwork URL at all: the browser already
    // tried and failed, no point leaving a broken-image icon up there.
    const showArtPlaceholder = () => {
      Object.assign(artEl.style, {
        backgroundImage:
          "radial-gradient(color-mix(in oklch, var(--acid) 14%, transparent) 1px, transparent 1px)",
        backgroundSize: `${13 * this.scale}px ${13 * this.scale}px`,
      });
      artEl.replaceChildren(
        el(
          "span",
          {
            ariaHidden: true,
            style: {
              color: "var(--magenta)",
              fontSize: art * 0.42,
              lineHeight: 1,
              textShadow: `${3 * this.scale}px ${3 * this.scale}px 0 var(--void)`,
            },
          },
          "◆",
        ),
      );
    };
    if (track.artwork) {
      artEl.append(
        el("img", {
          src: track.artwork,
          onError: showArtPlaceholder,
          style: { width: "100%", height: "100%", objectFit: "cover" },
        }),
      );
    } else {
      showArtPlaceholder();
    }

    const eyebrowEl = el(
      "span",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: this.rem(0.45),
          fontFamily: "var(--font-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-label)",
          fontSize: this.rem(0.75),
          color: fresh ? "var(--void)" : "var(--acid)",
          background: fresh ? "var(--acid)" : "transparent",
          padding: fresh
            ? `${0.12 * this.scale}rem ${0.4 * this.scale}rem`
            : "0",
          marginInlineStart: fresh ? `${-0.4 * this.scale}rem` : "0",
          alignSelf: "flex-start",
        },
      },
      el("span", {
        style: {
          width: this.rem(0.45),
          height: this.rem(0.45),
          borderRadius: "50%",
          background: "currentColor",
          animation: "zw-np 1s steps(2, jump-none) infinite",
        },
      }),
      fresh ? "New track" : "Now playing",
    );
    eyebrowEl.dataset.eyebrow = "";

    const titleEl = el(
      "span",
      {
        style: {
          fontFamily: "var(--font-display)",
          fontSize: this.compact ? this.rem(1.15) : this.rem(1.7),
          lineHeight: 1.05,
          textTransform: "uppercase",
          color: "var(--white)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          animation: m.line,
        },
      },
      track.title,
    );

    const artistEl = el(
      "span",
      {
        style: {
          fontFamily: "var(--font-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: this.compact ? this.rem(0.7) : this.rem(0.9),
          color: "var(--ink-dim)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          animation: m.line,
          animationDelay: "0.08s",
        },
      },
      track.artist,
      track.label &&
        el("span", { style: { color: "var(--cyan)" } }, ` · ${track.label}`),
    );

    this.fillEl = el("span", {
      style: {
        display: "block",
        height: "100%",
        width: `${Math.max(0, Math.min(100, track.progress))}%`,
        background: "var(--magenta)",
        transition: "width 1s linear",
        animation: "zw-np-bar 0.45s steps(4, end) both",
      },
    });
    const barEl = el(
      "span",
      {
        style: {
          display: "block",
          height: 4 * this.scale,
          background: "var(--void-3)",
          marginTop: this.compact ? this.rem(0.15) : this.rem(0.35),
        },
      },
      this.fillEl,
    );

    const textColumn = el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: this.compact ? this.rem(0.3) : this.rem(0.45),
          minWidth: 0,
          paddingInlineEnd: this.rem(0.35),
        },
      },
      eyebrowEl,
      titleEl,
      artistEl,
      barEl,
    );

    const children: HTMLElement[] = [artEl, textColumn];
    if (fresh) {
      const flashEl = el("span", {
        ariaHidden: true,
        style: {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          mixBlendMode: "screen",
          animation: "zw-np-flash 0.5s steps(3, end) both",
        },
      });
      flashEl.dataset.flash = "";
      children.push(flashEl);
    }
    this.cardEl.replaceChildren(...children);
  }
}
