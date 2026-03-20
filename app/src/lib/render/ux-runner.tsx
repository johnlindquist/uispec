"use client";

import { useCallback, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CompiledUXSpec } from "../types";
import { useUXStore } from "../hooks/use-ux-store";
import { useKeyboard } from "../hooks/use-keyboard";
import { useFocus } from "../hooks/use-focus";
import { useAutoDismiss } from "../hooks/use-auto-dismiss";
import { evalExpr } from "../engine/eval-expr";
import { SlotRenderer } from "./slot-renderer";

export function UXRunner({ spec }: { spec: CompiledUXSpec }) {
  const { snapshot, send } = useUXStore(spec);
  const reduceMotion = useReducedMotion();

  const exprEvaluator = useCallback(
    (expr: any) =>
      evalExpr(expr, {
        context: snapshot.context as any,
        event: null,
      }),
    [snapshot.context]
  );

  useKeyboard(snapshot.visual?.keyboard, send);
  useFocus(snapshot.visual?.onEnter as any, snapshot.statePath);
  useAutoDismiss(snapshot.visual?.autoDismiss, snapshot.statePath, send);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* State indicator */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          padding: "6px 12px",
          background: "rgba(0,0,0,0.8)",
          color: "rgba(255,255,255,0.6)",
          fontSize: 12,
          fontFamily: "monospace",
          borderRadius: 6,
          zIndex: 9999,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {snapshot.statePath}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={snapshot.statePath}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: "100%", height: "100%" }}
        >
          <SlotRenderer
            visual={snapshot.visual}
            send={send}
            context={snapshot.context as any}
            evalExpr={exprEvaluator}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
