/**
 * Square-GIF-beside-name redeem layout.
 */
import { el } from "../dom.js";
import { MediaBox } from "../MediaBox.js";
import { Scanlines } from "../Scanlines.js";
import { display, label, panel } from "../style-helpers.js";
import type { LayoutProps } from "../types.js";

/**
 * Builds a `Sidecar` layout element.
 */
export function Sidecar({
  e,
  s,
  tone,
  t,
  hideEyebrow,
}: LayoutProps): HTMLElement {
  const size = 220 * s;
  return el(
    "div",
    {
      style: {
        ...panel(tone, s),
        display: "flex",
        alignItems: "center",
        gap: `${1.4 * s}rem`,
        padding: `${1.2 * s}rem ${1.8 * s}rem`,
        position: "relative",
      },
    },
    MediaBox({
      src: e.media,
      width: size,
      height: size,
      name: e.reward || e.detail,
      s,
    }),
    el(
      "div",
      null,
      // No separate e.detail line: for redeem that's just e.reward's own
      // title again, restating the headline above in plainer words rather
      // than adding anything, one bold line short of the eyebrow instead
      // of two, easier to read at a glance and on stream.
      !hideEyebrow &&
        el("div", { style: label(s * 1.5) }, e.headline || t.eyebrow),
      el(
        "div",
        {
          style: {
            ...display(s, 3),
            marginTop: `${0.55 * s}rem`,
            textShadow: `${3 * s}px ${3 * s}px 0 var(--void)`,
          },
        },
        e.name,
      ),
    ),
    Scanlines(),
  );
}
