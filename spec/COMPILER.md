# UISpec Compiler Reference

## Overview

The compiler transforms the authoring format (`.uispec.json`) into the compiled format (`.compiled.json`). It's a single-pass JSON → JSON transform with four phases.

```
                    compile
.uispec.json  ──────────────►  .compiled.json
(authoring)         │           (runtime)
                    │
          ┌─────────┴──────────┐
          │  1. Resolve tokens │
          │  2. Expand $refs   │
          │  3. Flatten states │
          │  4. Compile exprs  │
          └────────────────────┘
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

## Compiled Output Structure

```json
{
  "$format": "uispec-compiled",
  "$version": "0.1",
  "$source": "component.uispec.json",

  "initial": "hidden",

  "transitions": {
    "state.path": { "EVENT": "target.state.path" }
  },

  "visuals": {
    "state.path": {
      "description": "...",
      "container": { },
      "slots": { }
    }
  }
}
```

## Per-Language Runtime

Consuming the compiled format requires ~50 lines total:

| Component | Lines | What it does |
|-----------|-------|-------------|
| Load JSON | 1-3 | Parse the file |
| Transition lookup | 1-3 | `table[state][event]` |
| Expression evaluator | 15-20 | Recursive match on 10 ops |
| Visual tree walker | 30-50 | Recursive match on element types |

### Expression Evaluator (Python, 15 lines)

```python
def evaluate(expr, ctx):
    if isinstance(expr, (int, float)):
        return expr
    if isinstance(expr, str):
        return expr
    op, *args = expr
    a = lambda: evaluate(args[0], ctx)
    b = lambda: evaluate(args[1], ctx)
    match op:
        case "var":   return ctx[args[0]]
        case "+":     return a() + b()
        case "-":     return a() - b()
        case "*":     return a() * b()
        case "/":     return a() / b()
        case "pow":   return a() ** b()
        case "min":   return min(a(), b())
        case "max":   return max(a(), b())
        case "lerp":  return a() + (b() - a()) * evaluate(args[2], ctx)
        case "if":    return b() if a() else evaluate(args[2], ctx)
        case "clamp": return max(b(), min(evaluate(args[2], ctx), a()))
```

### Expression Evaluator (Rust, 20 lines)

```rust
fn eval(expr: &Value, ctx: &HashMap<String, f64>) -> f64 {
    match expr {
        Value::Number(n) => n.as_f64().unwrap(),
        Value::Array(arr) => {
            let op = arr[0].as_str().unwrap();
            let a = || eval(&arr[1], ctx);
            let b = || eval(&arr[2], ctx);
            match op {
                "var"   => *ctx.get(arr[1].as_str().unwrap()).unwrap_or(&0.0),
                "+"     => a() + b(),
                "-"     => a() - b(),
                "*"     => a() * b(),
                "/"     => a() / b(),
                "pow"   => a().powf(b()),
                "min"   => a().min(b()),
                "max"   => a().max(b()),
                "lerp"  => { let (va, vb) = (a(), b()); va + (vb - va) * eval(&arr[3], ctx) },
                "if"    => if a() != 0.0 { b() } else { eval(&arr[3], ctx) },
                "clamp" => a().max(b()).min(eval(&arr[3], ctx)),
                _       => 0.0,
            }
        }
        _ => 0.0,
    }
}
```

### Expression Evaluator (Swift, 20 lines)

```swift
func eval(_ expr: Any, ctx: [String: Double]) -> Double {
    if let n = expr as? Double { return n }
    guard let arr = expr as? [Any], let op = arr[0] as? String else { return 0 }
    let a = { eval(arr[1], ctx: ctx) }
    let b = { eval(arr[2], ctx: ctx) }
    switch op {
    case "var":   return ctx[arr[1] as! String] ?? 0
    case "+":     return a() + b()
    case "-":     return a() - b()
    case "*":     return a() * b()
    case "/":     return a() / b()
    case "pow":   return pow(a(), b())
    case "min":   return min(a(), b())
    case "max":   return max(a(), b())
    case "lerp":  let (va, vb) = (a(), b()); return va + (vb - va) * eval(arr[3], ctx: ctx)
    case "if":    return a() != 0 ? b() : eval(arr[3], ctx: ctx)
    case "clamp": return max(b(), min(eval(arr[3], ctx: ctx), a()))
    default:      return 0
    }
}
```
