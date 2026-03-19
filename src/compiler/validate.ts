import type {
  ActionSpec,
  CompilerIssue,
  CompilerTraceEntry,
  EffectSpec,
  Expr,
  StateNode,
  UXSpecDocument,
} from "./types";
import {
  buildStateIndex,
  resolveLeafInitial,
  resolveTargetPath,
  type StateIndex,
} from "./state-paths";

export interface ValidationResult {
  ok: boolean;
  issues: CompilerIssue[];
  trace: CompilerTraceEntry[];
}

const SUPPORTED_OPS = new Set([
  "var",
  "get",
  "+",
  "-",
  "*",
  "/",
  "pow",
  "min",
  "max",
  "clamp",
  "lerp",
  "if",
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "!",
  "&&",
  "||",
  "coalesce",
  "round",
  "floor",
  "ceil",
]);

function walkExpr(
  expr: Expr,
  path: string,
  issues: CompilerIssue[],
  contextKeys: Set<string>
): void {
  if (expr === null) return;
  if (
    typeof expr === "string" ||
    typeof expr === "number" ||
    typeof expr === "boolean"
  )
    return;
  if (!Array.isArray(expr) || expr.length === 0) return;

  const [op, ...args] = expr as [string, ...Expr[]];

  if (!SUPPORTED_OPS.has(op)) {
    issues.push({
      code: "UNSUPPORTED_EXPR_OP",
      message: `Unsupported expression operator: ${op}`,
      path,
      phase: "validate",
    });
    return;
  }

  if (op === "var" && typeof args[0] === "string") {
    const key = args[0] as string;
    if (key.startsWith("context.")) {
      const bare = key.slice("context.".length);
      if (!contextKeys.has(bare)) {
        issues.push({
          code: "UNDECLARED_CONTEXT_VAR",
          message: `Context variable not declared: ${key}`,
          path,
          phase: "validate",
        });
      }
    }
  }

  for (const arg of args) {
    walkExpr(arg as Expr, path, issues, contextKeys);
  }
}

function validateAction(
  action: ActionSpec,
  path: string,
  issues: CompilerIssue[],
  eventKeys: Set<string>,
  contextKeys: Set<string>
): void {
  if (action.kind === "assign") {
    if (!action.path?.startsWith("context.")) {
      issues.push({
        code: "INVALID_ASSIGN_PATH",
        message: `assign path must start with context.: ${action.path ?? "(missing)"}`,
        path,
        phase: "validate",
      });
    }
    if (action.value !== undefined) {
      walkExpr(action.value, `${path}.value`, issues, contextKeys);
    }
  }

  if (action.kind === "emit" && action.event && !eventKeys.has(action.event)) {
    issues.push({
      code: "UNDECLARED_EVENT",
      message: `Event not declared in $events: ${action.event}`,
      path,
      phase: "validate",
    });
  }
}

function validateEntryExit(
  items: Array<ActionSpec | EffectSpec> | undefined,
  path: string,
  issues: CompilerIssue[],
  eventKeys: Set<string>,
  contextKeys: Set<string>
): void {
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (
      "kind" in item &&
      (item.kind === "assign" || item.kind === "emit" || item.kind === "log")
    ) {
      validateAction(
        item as ActionSpec,
        `${path}[${i}]`,
        issues,
        eventKeys,
        contextKeys
      );
    }
  }
}

/**
 * Convert a schema-style path like "$machine.states.signIn.states.idle"
 * to a logical state path like "signIn.idle" for StateIndex lookups.
 */
function schemaPathToLogicalPath(schemaPath: string): string {
  return schemaPath
    .replace(/^\$machine\.states\./, "")
    .replace(/\.states\./g, ".");
}

function validateNode(
  node: StateNode,
  path: string,
  issues: CompilerIssue[],
  index: StateIndex,
  eventKeys: Set<string>,
  contextKeys: Set<string>
): void {
  const logicalPath = schemaPathToLogicalPath(path);

  for (const [event, transition] of Object.entries(node.on ?? {})) {
    if (event !== "" && !eventKeys.has(event)) {
      issues.push({
        code: "UNDECLARED_EVENT",
        message: `Transition uses undeclared event: ${event}`,
        path: `${path}.on.${event}`,
        phase: "validate",
      });
    }

    const target =
      typeof transition === "string" ? transition : transition.target;
    resolveTargetPath(logicalPath, target, index, issues, `${path}.on.${event}`);

    if (typeof transition !== "string") {
      if (transition.guard) {
        walkExpr(
          transition.guard,
          `${path}.on.${event}.guard`,
          issues,
          contextKeys
        );
      }
      for (let i = 0; i < (transition.actions ?? []).length; i++) {
        validateAction(
          transition.actions![i]!,
          `${path}.on.${event}.actions[${i}]`,
          issues,
          eventKeys,
          contextKeys
        );
      }
    }
  }

  if (node.always) {
    for (let i = 0; i < node.always.length; i++) {
      const transition = node.always[i]!;
      const target =
        typeof transition === "string" ? transition : transition.target;
      resolveTargetPath(logicalPath, target, index, issues, `${path}.always[${i}]`);
      if (typeof transition !== "string") {
        if (transition.guard) {
          walkExpr(
            transition.guard,
            `${path}.always[${i}].guard`,
            issues,
            contextKeys
          );
        }
        for (let j = 0; j < (transition.actions ?? []).length; j++) {
          validateAction(
            transition.actions![j]!,
            `${path}.always[${i}].actions[${j}]`,
            issues,
            eventKeys,
            contextKeys
          );
        }
      }
    }
  }

  validateEntryExit(node.entry, `${path}.entry`, issues, eventKeys, contextKeys);
  validateEntryExit(node.exit, `${path}.exit`, issues, eventKeys, contextKeys);

  for (const [childKey, child] of Object.entries(node.states ?? {})) {
    validateNode(
      child,
      `${path}.states.${childKey}`,
      issues,
      index,
      eventKeys,
      contextKeys
    );
  }
}

export function validateSpec(
  document: UXSpecDocument,
  options: { trace?: boolean } = {}
): ValidationResult {
  const issues: CompilerIssue[] = [];
  const trace: CompilerTraceEntry[] = [];
  const eventKeys = new Set(Object.keys(document.$events ?? {}));
  const contextKeys = new Set(Object.keys(document.$context ?? {}));

  // Build StateIndex for target resolution (shared engine with compiler)
  const index = buildStateIndex(document.$machine.states, issues, trace);

  // Check machine initial
  resolveLeafInitial(document.$machine.initial, index, issues, "$machine.initial", trace);

  for (const [key, node] of Object.entries(document.$machine.states)) {
    validateNode(
      node,
      `$machine.states.${key}`,
      issues,
      index,
      eventKeys,
      contextKeys
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    trace: options.trace ? trace : [],
  };
}
