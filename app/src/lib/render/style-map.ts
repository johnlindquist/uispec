import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// Dimension helpers
// ---------------------------------------------------------------------------

type DimValue = string | number | { value: number; unit?: string } | undefined | null;

const UNITLESS_PROPS = new Set(["fontWeight", "opacity", "lineHeight", "zIndex", "flex", "order", "flexGrow", "flexShrink"]);

function normalizeDimension(v: DimValue, prop?: string): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") {
    if (prop && UNITLESS_PROPS.has(prop)) return v;
    return v === 0 ? 0 : `${v}px`;
  }
  if (typeof v === "string") {
    if (v === "fill") return "100%";
    return v;
  }
  if (typeof v === "object" && "value" in v) {
    const unit = v.unit ?? "px";
    return `${v.value}${unit}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Padding
// ---------------------------------------------------------------------------

function normalizePadding(
  padding: any,
): Pick<
  CSSProperties,
  "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft"
> {
  if (padding == null) return {};
  if (typeof padding === "number") return { padding: `${padding}px` };
  if (typeof padding === "string") return { padding };
  if (typeof padding === "object") {
    const result: CSSProperties = {};
    if ("value" in padding && typeof padding.value === "number") {
      result.padding = `${padding.value}px`;
    }
    if ("horizontal" in padding) {
      const h =
        typeof padding.horizontal === "number"
          ? `${padding.horizontal}px`
          : padding.horizontal;
      result.paddingLeft = h;
      result.paddingRight = h;
    }
    if ("vertical" in padding) {
      const v =
        typeof padding.vertical === "number"
          ? `${padding.vertical}px`
          : padding.vertical;
      result.paddingTop = v;
      result.paddingBottom = v;
    }
    if ("top" in padding) result.paddingTop = normalizeDimension(padding.top);
    if ("right" in padding)
      result.paddingRight = normalizeDimension(padding.right);
    if ("bottom" in padding)
      result.paddingBottom = normalizeDimension(padding.bottom);
    if ("left" in padding)
      result.paddingLeft = normalizeDimension(padding.left);
    return result;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

function normalizeShadow(shadow: any): string | undefined {
  if (!shadow) return undefined;
  if (typeof shadow === "string") return shadow;
  if (Array.isArray(shadow)) {
    return shadow
      .map((s: any) => {
        if (typeof s === "string") return s;
        const x = s.x ?? s.offsetX ?? 0;
        const y = s.y ?? s.offsetY ?? 0;
        const blur = s.blur ?? 0;
        const spread = s.spread ?? 0;
        const color = s.color ?? "rgba(0,0,0,0.25)";
        const inset = s.inset ? "inset " : "";
        return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
      })
      .join(", ");
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Backdrop filter
// ---------------------------------------------------------------------------

function buildBackdropFilter(element: Record<string, any>): string | undefined {
  const parts: string[] = [];
  if (element.backdropBlur != null) {
    parts.push(`blur(${element.backdropBlur}px)`);
  }
  if (element.backdropSaturate != null) {
    parts.push(`saturate(${element.backdropSaturate})`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

// ---------------------------------------------------------------------------
// Layout mapping
// ---------------------------------------------------------------------------

function layoutStyle(
  layout: string | undefined,
  element: Record<string, any>,
): CSSProperties {
  const css: CSSProperties = {};

  switch (layout) {
    case "stack-v":
      css.display = "flex";
      css.flexDirection = "column";
      break;
    case "stack-h":
      css.display = "flex";
      css.flexDirection = "row";
      break;
    case "grid":
      css.display = "grid";
      if (element.columns) {
        if (typeof element.columns === "number") {
          css.gridTemplateColumns = `repeat(${element.columns}, 1fr)`;
        } else if (typeof element.columns === "string") {
          css.gridTemplateColumns = element.columns;
        } else if (Array.isArray(element.columns)) {
          css.gridTemplateColumns = element.columns.join(" ");
        }
      }
      break;
    case "layer":
      css.display = "flex";
      css.position = "relative";
      break;
    case "group":
    default:
      if (layout === "group" || layout == null) {
        css.display = "flex";
        css.flexDirection = "column";
      }
      break;
  }

  return css;
}

// ---------------------------------------------------------------------------
// Align / justify mapping
// ---------------------------------------------------------------------------

function mapAlign(align: string | undefined): string | undefined {
  if (!align) return undefined;
  switch (align) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "stretch":
      return "stretch";
    default:
      return align;
  }
}

function mapJustify(justify: string | undefined): string | undefined {
  if (!justify) return undefined;
  switch (justify) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "between":
      return "space-between";
    case "around":
      return "space-around";
    case "evenly":
      return "space-evenly";
    default:
      return justify;
  }
}

// ---------------------------------------------------------------------------
// Size object → dimensions
// ---------------------------------------------------------------------------

function mapSize(size: Record<string, any> | undefined): CSSProperties {
  if (!size) return {};
  const css: CSSProperties = {};
  if (size.width != null) css.width = normalizeDimension(size.width);
  if (size.height != null) css.height = normalizeDimension(size.height);
  if (size.minWidth != null) css.minWidth = normalizeDimension(size.minWidth);
  if (size.minHeight != null)
    css.minHeight = normalizeDimension(size.minHeight);
  if (size.maxWidth != null) css.maxWidth = normalizeDimension(size.maxWidth);
  if (size.maxHeight != null)
    css.maxHeight = normalizeDimension(size.maxHeight);
  return css;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build CSS for a container element (has layout, children, slots).
 * Reads: layout, align, justify, gap, size, padding, background, cornerRadius,
 * shadow, backdropBlur, backdropSaturate, opacity, borderWidth, borderColor, etc.
 */
export function mapContainerStyle(
  element: Record<string, any>,
): CSSProperties {
  const layout =
    element.layout ?? (element.type === "layer" ? "layer" : undefined);
  const css: CSSProperties = {
    ...layoutStyle(layout, element),
    ...mapSize(element.size),
    ...normalizePadding(element.padding),
  };

  if (element.align) css.alignItems = mapAlign(element.align);
  if (element.justify) css.justifyContent = mapJustify(element.justify);
  if (element.gap != null)
    css.gap = typeof element.gap === "number" ? `${element.gap}px` : element.gap;

  if (element.background) css.background = element.background;
  if (element.cornerRadius != null)
    css.borderRadius = normalizeDimension(element.cornerRadius);
  if (element.opacity != null) css.opacity = element.opacity;
  if (element.borderWidth != null)
    css.borderWidth = normalizeDimension(element.borderWidth);
  if (element.borderColor) css.borderColor = element.borderColor;
  if (element.borderWidth != null) css.borderStyle = "solid";

  const shadow = normalizeShadow(element.shadow);
  if (shadow) css.boxShadow = shadow;

  const backdrop = buildBackdropFilter(element);
  if (backdrop) css.backdropFilter = backdrop;

  return css;
}

/**
 * Build CSS for any element. Combines the element-level style prop with
 * element-level visual props (background, size, padding, corner radius, etc.).
 */
export function mapElementStyle(element: Record<string, any>): CSSProperties {
  const css: CSSProperties = {};

  // Direct style properties
  const style = element.style ?? {};
  if (style.fontSize != null) css.fontSize = normalizeDimension(style.fontSize, "fontSize");
  if (style.fontWeight != null) css.fontWeight = style.fontWeight;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.lineHeight != null) css.lineHeight = style.lineHeight;
  if (style.color) css.color = style.color;
  if (style.background) css.background = style.background;
  if (style.opacity != null) css.opacity = style.opacity;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.letterSpacing != null)
    css.letterSpacing = normalizeDimension(style.letterSpacing);
  if (style.textTransform) css.textTransform = style.textTransform;
  if (style.textDecoration) css.textDecoration = style.textDecoration;
  if (style.whiteSpace) css.whiteSpace = style.whiteSpace;
  if (style.height != null) css.height = normalizeDimension(style.height);
  if (style.width != null) css.width = normalizeDimension(style.width);
  if (style.cornerRadius != null) css.borderRadius = normalizeDimension(style.cornerRadius);
  if (style.borderWidth != null) css.borderWidth = normalizeDimension(style.borderWidth);
  if (style.borderColor) { css.borderColor = style.borderColor; css.borderStyle = "solid"; }
  Object.assign(css, normalizePadding(style.padding));

  // Element-level visual props
  if (element.background) css.background = element.background;
  if (element.color) css.color = element.color;
  if (element.opacity != null) css.opacity = element.opacity;
  if (element.cornerRadius != null)
    css.borderRadius = normalizeDimension(element.cornerRadius);
  if (element.borderWidth != null)
    css.borderWidth = normalizeDimension(element.borderWidth);
  if (element.borderColor) {
    css.borderColor = element.borderColor;
    css.borderStyle = "solid";
  }

  // Size
  Object.assign(css, mapSize(element.size));

  // Padding
  Object.assign(css, normalizePadding(element.padding));

  // Shadow
  const shadow = normalizeShadow(element.shadow);
  if (shadow) css.boxShadow = shadow;

  // Backdrop
  const backdrop = buildBackdropFilter(element);
  if (backdrop) css.backdropFilter = backdrop;

  // Gap (for containers that also use mapElementStyle)
  if (element.gap != null)
    css.gap = typeof element.gap === "number" ? `${element.gap}px` : element.gap;

  return css;
}
