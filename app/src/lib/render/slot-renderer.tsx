"use client";

import React from "react";
import { mapContainerStyle } from "./style-map";
import { ElementRenderer } from "./element-renderer";
import type { VisualSpec } from "../types";

interface SlotRendererProps {
  visual: VisualSpec;
  send: (type: string, payload?: Record<string, any>) => void;
  context: Record<string, any>;
  evalExpr: (expr: any) => any;
}

export function SlotRenderer({
  visual,
  send,
  context,
  evalExpr,
}: SlotRendererProps) {
  const containerStyle = mapContainerStyle(
    (visual.container as Record<string, any>) ?? {},
  );

  const slots = (visual.slots ?? {}) as Record<string, any[]>;

  return (
    <div style={containerStyle}>
      {Object.entries(slots).map(([slotName, elements]) =>
        Array.isArray(elements)
          ? elements.map((el, i) => (
              <ElementRenderer
                key={`${slotName}-${el.testId ?? el.name ?? i}`}
                element={el}
                send={send}
                context={context}
                evalExpr={evalExpr}
              />
            ))
          : null,
      )}
    </div>
  );
}
