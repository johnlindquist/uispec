"use client";

import React from "react";
import { mapContainerStyle, mapElementStyle } from "./style-map";
import { ElementRenderer } from "./element-renderer";
import type { CSSProperties } from "react";

interface ContainerProps {
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
  return out;
}

function renderChildren(
  children: any[] | undefined,
  send: ContainerProps["send"],
  context: ContainerProps["context"],
  evalExpr: ContainerProps["evalExpr"],
) {
  if (!children || !Array.isArray(children)) return null;
  return children.map((child, i) => (
    <ElementRenderer
      key={child.testId ?? child.name ?? i}
      element={child}
      send={send}
      context={context}
      evalExpr={evalExpr}
    />
  ));
}

// ---------------------------------------------------------------------------
// Group — default flex container
// ---------------------------------------------------------------------------

export function GroupContainer({ element, send, context, evalExpr }: ContainerProps) {
  const style: CSSProperties = {
    ...mapContainerStyle({
      ...element,
      layout: element.layout ?? "group",
    }),
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);

  return (
    <div style={style} data-testid={element.testId} {...aria}>
      {renderChildren(element.children, send, context, evalExpr)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackV — vertical stack
// ---------------------------------------------------------------------------

export function StackVContainer({ element, send, context, evalExpr }: ContainerProps) {
  const style: CSSProperties = {
    ...mapContainerStyle({ ...element, layout: "stack-v" }),
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);

  return (
    <div style={style} data-testid={element.testId} {...aria}>
      {renderChildren(element.children, send, context, evalExpr)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackH — horizontal stack
// ---------------------------------------------------------------------------

export function StackHContainer({ element, send, context, evalExpr }: ContainerProps) {
  const style: CSSProperties = {
    ...mapContainerStyle({ ...element, layout: "stack-h" }),
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);

  return (
    <div style={style} data-testid={element.testId} {...aria}>
      {renderChildren(element.children, send, context, evalExpr)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function GridContainer({ element, send, context, evalExpr }: ContainerProps) {
  const style: CSSProperties = {
    ...mapContainerStyle({ ...element, layout: "grid" }),
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);

  return (
    <div style={style} data-testid={element.testId} {...aria}>
      {renderChildren(element.children, send, context, evalExpr)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer — position: relative, children absolutely positioned
// ---------------------------------------------------------------------------

export function LayerContainer({ element, send, context, evalExpr }: ContainerProps) {
  const style: CSSProperties = {
    ...mapContainerStyle({ ...element, layout: "layer" }),
    ...mapElementStyle(element),
  };
  const aria = ariaProps(element.aria);

  const children = element.children;
  if (!children || !Array.isArray(children)) {
    return <div style={style} data-testid={element.testId} {...aria} />;
  }

  return (
    <div style={style} data-testid={element.testId} {...aria}>
      {children.map((child: any, i: number) => {
        // Wrap each child in an absolutely positioned div unless it's a layer slot
        const childStyle: CSSProperties = {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        };
        return (
          <div key={child.testId ?? child.name ?? i} style={childStyle}>
            <ElementRenderer
              element={child}
              send={send}
              context={context}
              evalExpr={evalExpr}
            />
          </div>
        );
      })}
    </div>
  );
}
