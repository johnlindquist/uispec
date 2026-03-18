# UISpec Compiler Reference

## Overview

The compiler transforms the authoring format (`.uispec.json`) into the compiled format (`.compiled.json`). It is a JSON → JSON transform with five phases.

```
                    compile
.uispec.json  ──────────────►  .compiled.json
(authoring)         │           (runtime)
                    │
          ┌─────────┴──────────┐
          │  1. Resolve tokens          │
          │  2. Expand $refs            │
          │  3. Flatten states          │
          │  4. Compile exprs           │
          │  5. Validate & normalize    │
          │     runtime semantics       │
          └─────────────────────────────┘
```

## Phase 1: Resolve Tokens

Walk the entire document. Any string value matching `{path.to.token}` is replaced with the concrete `$value` from `$tokens`.

```
Input:  { "color": "{color.active}" }
Output: { "color": "#52c41a" }
```

Dimension tokens flatten to their numeric value:

```
Input:  { "gap": "{spacing.sm}" }    // where spacing.sm.$value = { "value": 4, "unit": "px" }
Output: { "gap": 4 }
```

References resolve transitively — a token referencing another token is followed to the concrete value.

## Phase 2: Expand `$ref` Elements

Every `{ "$ref": "name", ...params }` is replaced with the full element definition from `$elements`, with params merged over defaults.

```
Input:  { "$ref": "action-button", "id": "crop", "icon": "Crop" }
Output: { "type": "button", "name": "crop", "icon": "Crop", "width": 24, "height": 24, ... }
```

Nested `$ref` within element children are expanded recursively.

## Phase 3: Flatten State Hierarchy

Nested state objects are flattened to dot-separated paths. Child states inherit parent transitions.

```
Input:
  states.recording.states.active  (recording has on.STOP)

Output:
  "recording.active": { "STOP": "transcribing.processing", "PAUSE": "recording.paused", ... }
```

Each leaf state gets its fully resolved `$visual`. Child states that don't define `slots` inherit from their parent.

The output is a flat transition table:

```json
{
  "transitions": {
    "hidden":                  { "SHOW": "recording.active" },
    "recording.active":        { "STOP": "transcribing.processing", "PAUSE": "recording.paused" },
    "recording.paused":        { "RESUME": "recording.active", "STOP": "transcribing.processing" },
    "transcribing.processing": { "DONE": "hidden", "NO_SPEECH": "transcribing.noSpeech" }
  }
}
```

## Phase 4: Compile Expressions

Expression strings in `dynamicStyle` are parsed into S-expression arrays:

```
Input:  "lerp(4, 20, pow(level, 0.7))"
Output: ["lerp", 4, 20, ["pow", ["var", "level"], 0.7]]
```

The grammar is intentionally minimal:

```
expr     = call | infix | literal | variable
call     = name "(" expr ("," expr)* ")"
infix    = expr ("+" | "-" | "*" | "/") expr
literal  = number | string
variable = identifier
```

## Phase 5: Validate and Normalize Runtime Semantics

The compiler MUST validate the authoring file against the runtime model defined in
`SPEC.md`. Specifically, it MUST check:

* Every `var` reference inside an expression resolves to a field declared in `$context`
  or to a recognized event payload path.
* Every event name used in a transition `on` block is declared in `$events`.
* Every transition target resolves to a leaf state path in `$machine`.
* Every expression operator is in the supported set (see SPEC.md § Dynamic Expressions).
* Every `assign` action targets a path starting with `context.`.
* Every `emit` action references an event declared in `$events`.

Validation failures MUST be reported as structured JSON with at minimum:

```json
{ "code": "UNDECLARED_CONTEXT_VAR", "message": "...", "path": "..." }
```

The compiler MUST emit the following in its compiled output:

* `contextSchema` — the full `$context` declaration, preserving types and defaults.
* `eventSchema` — the full `$events` declaration, preserving source and payload types.
* `states` — per-state objects including:
  * `transitions` — with guards and actions fully preserved (not collapsed).
  * `entry` — actions/effects executed on state entry, including inherited parent entries.
  * `exit` — actions/effects executed on state exit, including inherited parent exits.
  * `invoke` — long-running effects active while the state is entered (e.g. subscriptions,
    polling, websocket connections). Leaf states inherit `invoke` from their own node; parent
    `invoke` arrays are NOT merged into children (unlike entry/exit) because invocations
    are scoped to the declaring state's lifetime.
  * `visual` — the merged visual spec (child overrides parent, child slots replace parent slots).
* `assertions` — an array of verification expectations automatically extracted from `testId`
  fields found in `$elements` and compiled state visuals. Each assertion has the form:
  `{ "id": "<testId>-exists", "type": "element-present", "testId": "<testId>" }`.

This enables:

* Deterministic renderers that need no authoring-format knowledge.
* Machine-readable validation at CI time.
* Autonomous agent reasoning over a single compiled artifact.
* Snapshot and runtime verification against a single source of truth.

## Compiled Output Structure

```json
{
  "$format": "uispec-compiled",
  "$version": "0.2",
  "$source": "component.uispec.json",

  "initial": "signIn.idle",

  "contextSchema": {
    "email": { "type": "string", "default": "" },
    "submitting": { "type": "boolean", "default": false }
  },

  "eventSchema": {
    "SUBMIT": { "source": "user", "payload": {} },
    "AUTH_OK": { "source": "network", "payload": { "userId": { "type": "string" } } }
  },

  "states": {
    "signIn.idle": {
      "path": "signIn.idle",
      "visual": {
        "$description": "Form ready for input",
        "container": { },
        "slots": { }
      },
      "transitions": [
        {
          "event": "SUBMIT",
          "target": "signIn.loading",
          "guard": null,
          "actions": [
            { "kind": "assign", "path": "context.submitting", "value": true }
          ]
        }
      ],
      "entry": [],
      "exit": [],
      "invoke": []
    }
  },

  "assertions": [
    {
      "id": "auth-submit-exists",
      "type": "element-present",
      "testId": "auth-submit"
    }
  ]
}
```

## Per-Language Runtime

Consuming the compiled format requires ~50 lines total:

| Component | Lines | What it does |
|-----------|-------|-------------|
| Load JSON | 1-3 | Parse the file |
| Transition lookup | 1-3 | `table[state][event]` |
| Expression evaluator | 25-35 | Recursive match on ~20 ops (arithmetic, comparison, boolean, utility) |
| Visual tree walker | 30-50 | Recursive match on element types |

### Expression Evaluator (Python)

```python
def evaluate(expr, ctx):
    if expr is None:
        return None
    if isinstance(expr, (int, float, bool)):
        return expr
    if isinstance(expr, str):
        return expr
    op, *args = expr
    a = lambda: evaluate(args[0], ctx)
    b = lambda: evaluate(args[1], ctx)
    match op:
        case "var":      return ctx[args[0]]
        case "get":      return a()[args[1]]
        case "+":        return a() + b()
        case "-":        return a() - b()
        case "*":        return a() * b()
        case "/":        return a() / b()
        case "pow":      return a() ** b()
        case "min":      return min(a(), b())
        case "max":      return max(a(), b())
        case "lerp":     return a() + (b() - a()) * evaluate(args[2], ctx)
        case "if":       return b() if a() else evaluate(args[2], ctx)
        case "clamp":    return max(b(), min(evaluate(args[2], ctx), a()))
        case "==":       return a() == b()
        case "!=":       return a() != b()
        case "<":        return a() < b()
        case "<=":       return a() <= b()
        case ">":        return a() > b()
        case ">=":       return a() >= b()
        case "!":        return not a()
        case "&&":       return a() and b()
        case "||":       return a() or b()
        case "coalesce": va = a(); return va if va is not None else b()
```

### Expression Evaluator (Rust)

```rust
// Uses serde_json::Value. Returns Value to support bool/string/null, not just f64.
fn eval(expr: &Value, ctx: &Map<String, Value>) -> Value {
    match expr {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => expr.clone(),
        Value::Array(arr) => {
            let op = arr[0].as_str().unwrap();
            let a = || eval(&arr[1], ctx);
            let b = || eval(&arr[2], ctx);
            let num = |v: &Value| v.as_f64().unwrap_or(0.0);
            match op {
                "var"      => ctx.get(arr[1].as_str().unwrap()).cloned().unwrap_or(Value::Null),
                "get"      => a().get(arr[1].as_str().unwrap()).cloned().unwrap_or(Value::Null),
                "+"        => json!(num(&a()) + num(&b())),
                "-"        => json!(num(&a()) - num(&b())),
                "*"        => json!(num(&a()) * num(&b())),
                "/"        => json!(num(&a()) / num(&b())),
                "pow"      => json!(num(&a()).powf(num(&b()))),
                "min"      => json!(num(&a()).min(num(&b()))),
                "max"      => json!(num(&a()).max(num(&b()))),
                "=="       => json!(a() == b()),
                "!="       => json!(a() != b()),
                "<"        => json!(num(&a()) < num(&b())),
                "<="       => json!(num(&a()) <= num(&b())),
                ">"        => json!(num(&a()) > num(&b())),
                ">="       => json!(num(&a()) >= num(&b())),
                "!"        => json!(!a().as_bool().unwrap_or(false)),
                "&&"       => { let va = a(); if va.as_bool().unwrap_or(false) { b() } else { va } },
                "||"       => { let va = a(); if va.as_bool().unwrap_or(false) { va } else { b() } },
                "coalesce" => { let va = a(); if va.is_null() { b() } else { va } },
                "lerp"     => { let (va, vb) = (num(&a()), num(&b())); json!(va + (vb - va) * num(&eval(&arr[3], ctx))) },
                "if"       => if a().as_bool().unwrap_or(false) { b() } else { eval(&arr[3], ctx) },
                "clamp"    => json!(num(&a()).max(num(&b())).min(num(&eval(&arr[3], ctx)))),
                _          => Value::Null,
            }
        }
        _ => Value::Null,
    }
}
```

### Expression Evaluator (Swift)

```swift
// Uses a JSON-like Value enum to support bool/string/null, not just Double.
indirect enum Val: Equatable {
    case null, bool(Bool), num(Double), str(String), obj([String: Val])
}

func eval(_ expr: Any, ctx: [String: Val]) -> Val {
    if let n = expr as? Double { return .num(n) }
    if let b = expr as? Bool { return .bool(b) }
    if let s = expr as? String { return .str(s) }
    if expr is NSNull { return .null }
    guard let arr = expr as? [Any], let op = arr[0] as? String else { return .null }
    let a = { eval(arr[1], ctx: ctx) }
    let b = { eval(arr[2], ctx: ctx) }
    func num(_ v: Val) -> Double { if case .num(let n) = v { return n }; return 0 }
    func truthy(_ v: Val) -> Bool {
        switch v { case .null: return false; case .bool(let b): return b; case .num(let n): return n != 0; default: return true }
    }
    switch op {
    case "var":      return ctx[arr[1] as! String] ?? .null
    case "+":        return .num(num(a()) + num(b()))
    case "-":        return .num(num(a()) - num(b()))
    case "*":        return .num(num(a()) * num(b()))
    case "/":        return .num(num(a()) / num(b()))
    case "pow":      return .num(pow(num(a()), num(b())))
    case "min":      return .num(min(num(a()), num(b())))
    case "max":      return .num(max(num(a()), num(b())))
    case "==":       return .bool(a() == b())
    case "!=":       return .bool(a() != b())
    case "<":        return .bool(num(a()) < num(b()))
    case "<=":       return .bool(num(a()) <= num(b()))
    case ">":        return .bool(num(a()) > num(b()))
    case ">=":       return .bool(num(a()) >= num(b()))
    case "!":        return .bool(!truthy(a()))
    case "&&":       let va = a(); return truthy(va) ? b() : va
    case "||":       let va = a(); return truthy(va) ? va : b()
    case "coalesce": let va = a(); return va == .null ? b() : va
    case "lerp":     let (va, vb) = (num(a()), num(b())); return .num(va + (vb - va) * num(eval(arr[3], ctx: ctx)))
    case "if":       return truthy(a()) ? b() : eval(arr[3], ctx: ctx)
    case "clamp":    return .num(max(num(b()), min(num(eval(arr[3], ctx: ctx)), num(a()))))
    default:         return .null
    }
}
```
