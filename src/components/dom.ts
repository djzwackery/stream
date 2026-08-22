/**
 * Tiny DOM-building helper. These components don't have deep reactive state
 * or a tree of children that needs reconciling, just "build this DOM, throw
 * it away and rebuild it (or a piece of it) when the input changes," which
 * plain DOM APIs handle fine.
 */

/**
 * A style declaration for `el()`. A bare number on a length property (e.g.
 * `width: 220`) gets "px" appended; custom properties (`"--dx"`) are always
 * taken as a literal string. Use `undefined` to skip a property entirely.
 */
export type ElStyle = Record<string, string | number | undefined>;

/**
 * Options `el()` accepts beyond plain children.
 */
export interface ElOptions {
  /**
   * Inline styles, applied via the element's CSSOM style object.
   */
  style?: ElStyle;
  /**
   * Sets `aria-hidden="true"` when true.
   */
  ariaHidden?: boolean;
  /**
   * Image source, for `<img>` elements.
   */
  src?: string;
  /**
   * Image alt text, for `<img>` elements; defaults to "".
   */
  alt?: string;
  /**
   * Called if an `<img>`'s `src` fails to load (a 404, a dead host, ...), so
   * a caller can swap in a placeholder instead of leaving a broken-image icon.
   */
  onError?: () => void;
}

/**
 * A valid child for `el()`: a real node, text (numbers are stringified), or
 * a falsy value that's skipped, so callers can write `condition && el(...)`.
 */
export type ElChild = Node | string | number | false | null | undefined;

/**
 * CSS properties whose numeric values are unitless (no "px" appended).
 */
const UNITLESS_STYLE_PROPS = new Set([
  "opacity",
  "zIndex",
  "lineHeight",
  "flex",
  "flexGrow",
  "flexShrink",
  "WebkitLineClamp",
]);

function applyStyle(node: HTMLElement, style: ElStyle): void {
  for (const [prop, value] of Object.entries(style)) {
    if (value === undefined) {
      continue;
    }
    if (prop.startsWith("--")) {
      node.style.setProperty(prop, String(value));
      continue;
    }
    const cssValue =
      typeof value === "number" && !UNITLESS_STYLE_PROPS.has(prop)
        ? `${value}px`
        : String(value);
    Reflect.set(node.style, prop, cssValue);
  }
}

/**
 * Builds a real DOM element with the given style/attributes and children.
 */
export function el(
  tag: string,
  options?: ElOptions | null,
  ...children: ElChild[]
): HTMLElement {
  const node = document.createElement(tag);
  if (options?.style) {
    applyStyle(node, options.style);
  }
  if (options?.ariaHidden) {
    node.setAttribute("aria-hidden", "true");
  }
  if (options?.src !== undefined) {
    (node as HTMLImageElement).src = options.src;
  }
  if (tag === "img") {
    (node as HTMLImageElement).alt = options?.alt ?? "";
  }
  if (options?.onError) {
    node.addEventListener("error", options.onError);
  }
  for (const child of children) {
    if (child === false || child === null || child === undefined) {
      continue;
    }
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/**
 * Injects a `<style>` block with the given CSS text into `<head>` once,
 * keyed by `id` so re-mounting a component doesn't duplicate it.
 */
export function injectStylesheet(id: string, css: string): void {
  if (document.getElementById(id)) {
    return;
  }
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
