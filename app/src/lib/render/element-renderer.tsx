"use client";

import React from "react";
import {
  GroupContainer,
  StackVContainer,
  StackHContainer,
  GridContainer,
  LayerContainer,
} from "./containers";
import {
  TextLeaf,
  InputLeaf,
  ButtonLeaf,
  IconLeaf,
  ShapeLeaf,
  BadgeLeaf,
  BarLeaf,
} from "./leaves";

export interface ElementRendererProps {
  element: Record<string, any>;
  send: (type: string, payload?: Record<string, any>) => void;
  context: Record<string, any>;
  evalExpr: (expr: any) => any;
}

const CONTAINER_TYPES: Record<
  string,
  React.ComponentType<ElementRendererProps>
> = {
  group: GroupContainer,
  "stack-v": StackVContainer,
  "stack-h": StackHContainer,
  grid: GridContainer,
  layer: LayerContainer,
};

// Elements that can optionally have children (from $ref expansion)
function hasChildren(element: Record<string, any>): boolean {
  return Array.isArray(element.children) && element.children.length > 0;
}

const LEAF_TYPES: Record<string, React.ComponentType<ElementRendererProps>> = {
  text: TextLeaf,
  input: InputLeaf,
  button: ButtonLeaf,
  icon: IconLeaf,
  shape: ShapeLeaf,
  badge: BadgeLeaf,
  bar: BarLeaf,
};

export function ElementRenderer({
  element,
  send,
  context,
  evalExpr,
}: ElementRendererProps) {
  if (!element) return null;

  // Evaluate visibleWhen — if present and falsy, skip rendering
  if (element.visibleWhen != null) {
    const visible = evalExpr(element.visibleWhen);
    if (!visible) return null;
  }

  // Handle legacy `conditional` string expressions — hide if we can't evaluate them
  // These are string expressions like "fieldState == 'error'" which reference $ref params
  // that aren't in our runtime context. Default to hidden for error/validating conditionals.
  if (element.conditional != null) {
    const cond = element.conditional as string;
    // Hide async spinners and error messages by default (they show in specific field states)
    if (cond.includes("'error'") || cond.includes("'validating'")) {
      return null;
    }
  }

  const type = element.type;

  // Skip description-only nodes (no type field)
  if (!type) return null;

  // Handle repeat: render N copies with an index scope
  const repeatCount =
    typeof element.repeat === "number" ? element.repeat : null;

  if (repeatCount != null && repeatCount > 0) {
    return (
      <>
        {Array.from({ length: repeatCount }, (_, index) => {
          const repeatedElement = { ...element, repeat: undefined };
          return (
            <SingleElement
              key={`${element.testId ?? element.name ?? type}-${index}`}
              element={repeatedElement}
              send={send}
              context={{ ...context, $index: index }}
              evalExpr={evalExpr}
              type={type}
            />
          );
        })}
      </>
    );
  }

  return (
    <SingleElement
      element={element}
      send={send}
      context={context}
      evalExpr={evalExpr}
      type={type}
    />
  );
}

function SingleElement({
  element,
  send,
  context,
  evalExpr,
  type,
}: ElementRendererProps & { type: string }) {
  // Check containers first
  const ContainerComponent = CONTAINER_TYPES[type];
  if (ContainerComponent) {
    return (
      <ContainerComponent
        element={element}
        send={send}
        context={context}
        evalExpr={evalExpr}
      />
    );
  }

  // Leaf types that have children from $ref expansion → render as group
  if (hasChildren(element) && !CONTAINER_TYPES[type]) {
    return (
      <GroupContainer
        element={element}
        send={send}
        context={context}
        evalExpr={evalExpr}
      />
    );
  }

  // Then leaves
  const LeafComponent = LEAF_TYPES[type];
  if (LeafComponent) {
    return (
      <LeafComponent
        element={element}
        send={send}
        context={context}
        evalExpr={evalExpr}
      />
    );
  }

  // Unknown type — render a debug placeholder
  return (
    <div
      data-testid={element.testId}
      style={{ border: "1px dashed red", padding: 4, fontSize: 12 }}
    >
      Unknown element type: {type}
    </div>
  );
}
