"use client";

import React, { useState, useCallback } from "react";
import { mapElementStyle } from "./style-map";
import { resolveIcon } from "./icon-map";
import type { CSSProperties } from "react";

interface LeafProps {
  element: Record<string, any>;
  send: (type: string, payload?: Record<string, any>) => void;
  context: Record<string, any>;
  evalExpr: (expr: any) => any;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ariaProps(aria: Record<string, any> | undefined): Record<string, any> {
  if (!aria) return {};
  const out: Record<string, any> = {};
  if (aria.role) out.role = aria.role;
  if (aria.label) out["aria-label"] = aria.label;
  if (aria.level != null) out["aria-level"] = aria.level;
  if (aria.live) out["aria-live"] = aria.live;
  if (aria.busy != null) out["aria-busy"] = aria.busy;
  if (aria.hidden != null) out["aria-hidden"] = aria.hidden;
  if (aria.expanded != null) out["aria-expanded"] = aria.expanded;
  if (aria.selected != null) out["aria-selected"] = aria.selected;
  if (aria.disabled != null) out["aria-disabled"] = aria.disabled;
  if (aria.describedby) out["aria-describedby"] = aria.describedby;
  if (aria.labelledby) out["aria-labelledby"] = aria.labelledby;
  if (aria.controls) out["aria-controls"] = aria.controls;
  if (aria.valuemin != null) out["aria-valuemin"] = aria.valuemin;
  if (aria.valuemax != null) out["aria-valuemax"] = aria.valuemax;
  if (aria.valuenow != null) out["aria-valuenow"] = aria.valuenow;
  if (aria.valuetext) out["aria-valuetext"] = aria.valuetext;
  return out;
}

function executeActions(
  actions: any[] | undefined,
  send: LeafProps["send"],
  payload?: Record<string, any>,
) {
  if (!actions) return;
  for (const action of actions) {
    if (action.kind === "emit" && action.event) {
      send(action.event, payload);
    }
  }
}

function mergeInteractionStyle(
  base: CSSProperties,
  interactions: Record<string, any> | undefined,
  state: string,
): CSSProperties {
  if (!interactions?.[state]) return base;
  const overrides = interactions[state];
  const merged: CSSProperties = { ...base };
  if (overrides.background) merged.background = overrides.background;
  if (overrides.color) merged.color = overrides.color;
  if (overrides.opacity != null) merged.opacity = overrides.opacity;
  if (overrides.borderColor) merged.borderColor = overrides.borderColor;
  if (overrides.transform) merged.transform = overrides.transform;
  if (overrides.scale != null) merged.transform = `scale(${overrides.scale})`;
  return merged;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function TextLeaf({ element, evalExpr }: LeafProps) {
  const style = mapElementStyle(element);
  const aria = ariaProps(element.aria);
  const testId = element.testId;

  let content = element.content;
  if (content == null && element.binding?.content) {
    const bc = element.binding.content;
    content = Array.isArray(bc) ? evalExpr(bc) : bc;
  }
  if (Array.isArray(content)) {
    content = evalExpr(content);
  }
  // Fallback: bind (legacy shorthand), then label
  if (content == null && element.bind) content = element.bind;
  if (content == null) content = element.label;

  const isHeading =
    element.aria?.role === "heading" && element.aria?.level != null;

  if (isHeading) {
    const level = Number(element.aria.level);
    const headingProps = { style, "data-testid": testId, ...aria };
    switch (level) {
      case 1: return <h1 {...headingProps}>{content ?? ""}</h1>;
      case 2: return <h2 {...headingProps}>{content ?? ""}</h2>;
      case 3: return <h3 {...headingProps}>{content ?? ""}</h3>;
      case 4: return <h4 {...headingProps}>{content ?? ""}</h4>;
      case 5: return <h5 {...headingProps}>{content ?? ""}</h5>;
      case 6: return <h6 {...headingProps}>{content ?? ""}</h6>;
      default: return <span {...headingProps}>{content ?? ""}</span>;
    }
  }

  return (
    <span style={style} data-testid={testId} {...aria}>
      {content ?? ""}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export function InputLeaf({ element, send, context, evalExpr }: LeafProps) {
  const [focused, setFocused] = useState(false);

  const baseStyle = mapElementStyle(element);
  const style = focused
    ? mergeInteractionStyle(baseStyle, element.interactions, "focus")
    : baseStyle;
  const aria = ariaProps(element.aria);
  const testId = element.testId;
  const binding = element.binding ?? {};
  const inputType = binding.inputType ?? element.inputType ?? "text";
  const name = binding.name ?? element.bind ?? element.name;
  const placeholder = binding.placeholder ?? element.placeholder;

  // Read the current value from context using the binding name
  const value = name ? (context[name] ?? "") : "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      executeActions(element.onChange, send, {
        name,
        value: e.target.value,
      });
    },
    [element.onChange, send, name],
  );

  const commonProps = {
    style,
    "data-testid": testId,
    name,
    placeholder,
    value: String(value),
    onChange: handleChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    ...aria,
  };

  if (inputType === "textarea") {
    return <textarea {...commonProps} />;
  }

  return <input type={inputType} {...commonProps} />;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function ButtonLeaf({ element, send, evalExpr }: LeafProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const baseStyle = mapElementStyle(element);
  let style = baseStyle;
  if (pressed) {
    style = mergeInteractionStyle(style, element.interactions, "press");
  } else if (hovered) {
    style = mergeInteractionStyle(style, element.interactions, "hover");
  }

  const aria = ariaProps(element.aria);
  const testId = element.testId;

  let disabled = false;
  if (element.enabledWhen) {
    disabled = !evalExpr(element.enabledWhen);
  }

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (element.onPress) {
      executeActions(element.onPress, send);
    } else if (element.command) {
      send(element.command);
    }
  }, [disabled, element.onPress, element.command, send]);

  return (
    <button
      style={style}
      data-testid={testId}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      {...aria}
    >
      {element.content ?? element.label ?? element.bind ?? element.aria?.label ?? element.name ?? ""}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

export function IconLeaf({ element }: LeafProps) {
  const style = mapElementStyle(element);
  const aria = ariaProps(element.aria);
  const testId = element.testId;
  const iconName = element.icon ?? element.name ?? "";
  const IconComponent = resolveIcon(iconName);
  const size = element.size?.width?.value ?? element.size?.width ?? 24;
  const color = element.color ?? element.style?.color;

  if (!IconComponent) {
    return (
      <span style={style} data-testid={testId} {...aria}>
        [{iconName}]
      </span>
    );
  }

  return (
    <span style={style} data-testid={testId} {...aria}>
      <IconComponent size={size} color={color} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export function ShapeLeaf({ element }: LeafProps) {
  const style: CSSProperties = {
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);
  const testId = element.testId;

  if (element.fill) style.background = element.fill;

  const shape = element.shape ?? "rectangle";
  if (shape === "circle") {
    style.borderRadius = "50%";
  }

  return <div style={style} data-testid={testId} {...aria} />;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export function BadgeLeaf({ element }: LeafProps) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);
  const testId = element.testId;

  return (
    <span style={style} data-testid={testId} {...aria}>
      {element.content ?? ""}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bar
// ---------------------------------------------------------------------------

export function BarLeaf({ element, evalExpr }: LeafProps) {
  const style: CSSProperties = {
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);
  const testId = element.testId;

  // Dynamic height from expression or static value
  let height = element.height;
  if (Array.isArray(height)) {
    height = evalExpr(height);
  }
  if (height != null) {
    style.height = typeof height === "number" ? `${height}px` : height;
  }

  return <div style={style} data-testid={testId} {...aria} />;
}
