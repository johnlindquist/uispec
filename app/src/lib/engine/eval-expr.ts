import type { Json, Expr, ExprEnv } from "../types";

function resolvePath(obj: any, path: string): Json {
  const segments = path.split(".");
  let current: any = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== "object") return null;
    current = current[seg];
  }
  return (current ?? null) as Json;
}

export function evalExpr(expr: Expr, env: ExprEnv): Json {
  // Scalars pass through directly
  if (expr === null || typeof expr !== "object" || !Array.isArray(expr)) {
    return expr as Json;
  }

  const [op, ...args] = expr;

  switch (op) {
    case "var": {
      const path = args[0] as string;
      if (path.startsWith("context.")) {
        return resolvePath(env.context, path.slice("context.".length));
      }
      if (path.startsWith("event.")) {
        if (env.event == null) return null;
        return resolvePath(env.event, path.slice("event.".length));
      }
      // Try context first, then event
      const fromCtx = resolvePath(env.context, path);
      if (fromCtx !== null) return fromCtx;
      if (env.event != null) {
        return resolvePath(env.event, path);
      }
      return null;
    }

    case "get": {
      const target = evalExpr(args[0] as Expr, env);
      const prop = args[1] as string;
      if (target != null && typeof target === "object" && !Array.isArray(target)) {
        return (target as Record<string, Json>)[prop] ?? null;
      }
      return null;
    }

    case "param":
      // Parameters are resolved at compile time; return null at runtime
      return null;

    // ── Comparison ──
    case "==":
      return evalExpr(args[0] as Expr, env) === evalExpr(args[1] as Expr, env);
    case "!=":
      return evalExpr(args[0] as Expr, env) !== evalExpr(args[1] as Expr, env);
    case "<":
      return (evalExpr(args[0] as Expr, env) as number) < (evalExpr(args[1] as Expr, env) as number);
    case "<=":
      return (evalExpr(args[0] as Expr, env) as number) <= (evalExpr(args[1] as Expr, env) as number);
    case ">":
      return (evalExpr(args[0] as Expr, env) as number) > (evalExpr(args[1] as Expr, env) as number);
    case ">=":
      return (evalExpr(args[0] as Expr, env) as number) >= (evalExpr(args[1] as Expr, env) as number);

    // ── Logic ──
    case "!":
      return !evalExpr(args[0] as Expr, env);
    case "&&": {
      const left = evalExpr(args[0] as Expr, env);
      if (!left) return left;
      return evalExpr(args[1] as Expr, env);
    }
    case "||": {
      const left = evalExpr(args[0] as Expr, env);
      if (left) return left;
      return evalExpr(args[1] as Expr, env);
    }
    case "coalesce": {
      const left = evalExpr(args[0] as Expr, env);
      if (left != null) return left;
      return evalExpr(args[1] as Expr, env);
    }

    // ── Arithmetic ──
    case "+":
      return (evalExpr(args[0] as Expr, env) as number) + (evalExpr(args[1] as Expr, env) as number);
    case "-":
      return (evalExpr(args[0] as Expr, env) as number) - (evalExpr(args[1] as Expr, env) as number);
    case "*":
      return (evalExpr(args[0] as Expr, env) as number) * (evalExpr(args[1] as Expr, env) as number);
    case "/": {
      const divisor = evalExpr(args[1] as Expr, env) as number;
      if (divisor === 0) return null;
      return (evalExpr(args[0] as Expr, env) as number) / divisor;
    }
    case "pow":
      return Math.pow(
        evalExpr(args[0] as Expr, env) as number,
        evalExpr(args[1] as Expr, env) as number
      );
    case "min":
      return Math.min(
        evalExpr(args[0] as Expr, env) as number,
        evalExpr(args[1] as Expr, env) as number
      );
    case "max":
      return Math.max(
        evalExpr(args[0] as Expr, env) as number,
        evalExpr(args[1] as Expr, env) as number
      );

    // ── Ternary math ──
    case "clamp": {
      const val = evalExpr(args[0] as Expr, env) as number;
      const lo = evalExpr(args[1] as Expr, env) as number;
      const hi = evalExpr(args[2] as Expr, env) as number;
      return Math.min(Math.max(val, lo), hi);
    }
    case "lerp": {
      const a = evalExpr(args[0] as Expr, env) as number;
      const b = evalExpr(args[1] as Expr, env) as number;
      const t = evalExpr(args[2] as Expr, env) as number;
      return a + (b - a) * t;
    }

    // ── Conditional ──
    case "if":
      return evalExpr(args[0] as Expr, env)
        ? evalExpr(args[1] as Expr, env)
        : evalExpr(args[2] as Expr, env);

    // ── Rounding ──
    case "round":
      return Math.round(evalExpr(args[0] as Expr, env) as number);
    case "floor":
      return Math.floor(evalExpr(args[0] as Expr, env) as number);
    case "ceil":
      return Math.ceil(evalExpr(args[0] as Expr, env) as number);

    default:
      return null;
  }
}
