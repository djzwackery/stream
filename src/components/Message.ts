/**
 * Renders an alert's quoted message, which is plain text or text mixed with
 * emote images. Text only ever becomes DOM text nodes, never parsed as markup.
 */
import { el } from "./dom.js";
import type { ElChild } from "./dom.js";

export function hasMessage(e: AlertStageEvent): boolean {
  return Boolean(e.messageParts?.length || e.message);
}

/**
 * Quoted children for a message `<p>`, in order, emote images sized to the line.
 */
export function messageNodes(e: AlertStageEvent, upper = false): ElChild[] {
  const parts: MessagePart[] = e.messageParts?.length
    ? e.messageParts
    : [{ text: e.message }];
  return [
    "“",
    ...parts.map((part): ElChild => {
      if (part.emote) {
        const img = el("img", {
          src: part.emote,
          onError: () => img.remove(),
          style: {
            height: "1.4em",
            verticalAlign: "middle",
            margin: "0 0.1em",
          },
        });
        return img;
      }
      const text = part.text ?? "";
      return upper ? text.toUpperCase() : text;
    }),
    "”",
  ];
}
