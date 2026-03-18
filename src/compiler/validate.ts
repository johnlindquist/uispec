import type {
  ActionSpec,
  EffectSpec,
  Expr,
  StateNode,
  UISpecDocument,
} from "./types";

export type IssueCode =
  | "UNDECLARED_CONTEXT_VAR"
  | "UNDECLARED_EVENT"
  | "UNDECLARED_TARGET"
  | "UNSUPPORTED_EXPR_OP"
  | "INVALID_ASSIGN_PATH";

export interface ValidationIssue {
  code: IssueCode;
  message: string;
  path: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
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
  issues: ValidationIssue[],
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
        });
      }
    }
  }

  for (const arg of args) {
    walkExpr(arg as Expr, path, issues, contextKeys);
  }
}

function collectStatePaths(
  states: Record<string, StateNode>,
  prefix = "",
  out = new Set<string>()
): Set<string> {
  for (const [key, node] of Object.entries(states)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.add(path);
    if (node.states && Object.keys(node.states).length > 0) {
      collectStatePaths(node.states, path, out);
    }
  }
  return out;
}

function collectLeafPaths(
  states: Record<string, StateNode>,
  prefix = "",
  out = new Set<string>()
): Set<string> {
  for (const [key, node] of Object.entries(states)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!node.states || Object.keys(node.states).length === 0) {
      out.add(path);
    } else {
      collectLeafPaths(node.states, path, out);
    }
  }
  return out;
}

function validateAction(
  action: ActionSpec,
  path: string,
  issues: ValidationIssue[],
  eventKeys: Set<string>,
  contextKeys: Set<string>
): void {
  if (action.kind === "assign") {
    if (!action.path?.startsWith("context.")) {
      issues.push({
        code: "INVALID_ASSIGN_PATH",
        message: `assign path must start with context.: ${action.path ?? "(missing)"}`,
        path,
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
    });
  }
}

function validateEntryExit(
  items: Array<ActionSpec | EffectSpec> | undefined,
  path: string,
  issues: ValidationIssue[],
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
 * Resolve a transition target against the set of all known state paths.
 * Statecharts allow relative targets: within `signIn.states.idle`, a target
 * of `"loading"` means sibling `signIn.loading`. We check:
 *   1. Exact match (absolute path).
 *   2. Relative to the parent compound state (sibling path).
 *   3. Relative to each ancestor compound state (walking up).
 */
function resolveTarget(
  target: string,
  nodePath: string,
  allPaths: Set<string>
): boolean {
  if (allPaths.has(target)) return true;
  // nodePath is like "$machine.states.signIn.states.idle" — extract the
  // logical state path by stripping the "$machine.states." prefix and
  // ".states." separators.
  const logicalPath = nodePath
    .replace(/^\$machine\.states\./, "")
    .replace(/\.states\./g, ".");
  // Walk up parent paths and try prepending
  const parts = logicalPath.split(".");
  for (let i = parts.length - 1; i >= 1; i--) {
    const parentPath = parts.slice(0, i).join(".");
    const resolved = `${parentPath}.${target}`;
    if (allPaths.has(resolved)) return true;
  }
  return false;
}

function validateNode(
  node: StateNode,
  path: string,
  issues: ValidationIssue[],
  allPaths: Set<string>,
  eventKeys: Set<string>,
  contextKeys: Set<string>
): void {
  for (const [event, transition] of Object.entries(node.on ?? {})) {
    if (event !== "" && !eventKeys.has(event)) {
      issues.push({
        code: "UNDECLARED_EVENT",
        message: `Transition uses undeclared event: ${event}`,
        path: `${path}.on.${event}`,
      });
    }

    const target =
      typeof transition === "string" ? transition : transition.target;
    if (!resolveTarget(target, path, allPaths)) {
      issues.push({
        code: "UNDECLARED_TARGET",
        message: `Transition target does not exist: ${target}`,
        path: `${path}.on.${event}`,
      });
    }

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
      if (!resolveTarget(target, path, allPaths)) {
        issues.push({
          code: "UNDECLARED_TARGET",
          message: `Transition target does not exist: ${target}`,
          path: `${path}.always[${i}]`,
        });
      }
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
      allPaths,
      eventKeys,
      contextKeys
    );
  }
}

export function validateSpec(document: UISpecDocument): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allPaths = collectStatePaths(document.$machine.states);
  const eventKeys = new Set(Object.keys(document.$events ?? {}));
  const contextKeys = new Set(Object.keys(document.$context ?? {}));

  for (const [key, node] of Object.entries(document.$machine.states)) {
    validateNode(
      node,
      `$machine.states.${key}`,
      issues,
      allPaths,
      eventKeys,
      contextKeys
    );
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
