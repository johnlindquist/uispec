# Runtime Semantics Reference

## Context (`$context`)

Typed runtime state. Every field needs `type` and `default`.

```json
"$context": {
  "email":      { "type": "string",  "default": "",    "$description": "Email input value" },
  "submitting": { "type": "boolean", "default": false },
  "error":      { "type": "string",  "default": null },
  "items":      { "type": "array",   "default": [] }
}
```

Allowed types: `string`, `number`, `boolean`, `object`, `array`, `null`.

## Events (`$events`)

```json
"$events": {
  "SUBMIT":        { "source": "user",    "payload": {} },
  "INPUT_CHANGED": { "source": "user",    "payload": { "name": { "type": "string" }, "value": { "type": "string" } } },
  "HTTP_OK":       { "source": "network", "payload": { "data": { "type": "object" } } },
  "HTTP_ERROR":    { "source": "network", "payload": { "message": { "type": "string" } } },
  "TICK":          { "source": "timer",   "payload": {} }
}
```

Sources: `user`, `system`, `timer`, `network`, `storage`.

## Actions (`$actions`) — Pure State Mutations

| Kind | Required | Example |
|------|----------|---------|
| `assign` | `path`, `value` | `{ "kind": "assign", "path": "context.email", "value": ["var", "event.value"] }` |
| `emit` | `event` | `{ "kind": "emit", "event": "SUBMIT" }` |
| `log` | `level`, `message` | `{ "kind": "log", "level": "info", "message": "submitted" }` |

`assign` path MUST start with `context.`. `emit` event MUST be declared in `$events`.

## Effects (`$effects`) — Side Effects

| Kind | Required | Example |
|------|----------|---------|
| `http` | `request` | `{ "kind": "http", "request": "signInRequest" }` |
| `timer.start` | `id`, `ms`, `event` | `{ "kind": "timer.start", "id": "cooldown", "ms": 3000, "event": "COOLDOWN_EXPIRED" }` |
| `timer.cancel` | `id` | `{ "kind": "timer.cancel", "id": "cooldown" }` |
| `navigate` | `to` | `{ "kind": "navigate", "to": "/dashboard" }` |
| `focus` | `target` | `{ "kind": "focus", "target": "email" }` |
| `storage.write` | `key`, `value` | `{ "kind": "storage.write", "key": "token", "value": ["var", "context.token"] }` |

## Transitions

Short form: `"on": { "SUBMIT": "loading" }`

Object form with guard and actions:
```json
"on": {
  "SUBMIT": {
    "target": "loading",
    "guard": ["==", ["var", "context.submitting"], false],
    "actions": [{ "kind": "assign", "path": "context.submitting", "value": true }]
  }
}
```

`always` transitions (evaluated on state entry, MUST have guard):
```json
"always": [
  { "target": "success", "guard": ["==", ["var", "context.verified"], true] }
]
```

## Entry, Exit, Invoke

```json
"loading": {
  "entry": [
    { "kind": "assign", "path": "context.loading", "value": true },
    { "kind": "http", "request": "fetchData" }
  ],
  "exit": [
    { "kind": "assign", "path": "context.loading", "value": false }
  ],
  "invoke": [
    { "kind": "timer.start", "id": "poll", "ms": 5000, "event": "POLL_TICK" }
  ]
}
```

## Expression Syntax (S-expressions)

```
Arithmetic: +, -, *, /, pow
Comparison: ==, !=, <, <=, >, >=
Boolean:    !, &&, ||
Access:     var, get, coalesce
Control:    if
Math:       min, max, clamp, lerp, round, floor, ceil
```

Examples:
- `["var", "context.email"]` — read context value
- `["==", ["var", "context.error"], null]` — equality check
- `["&&", ["!=", ["var", "context.email"], ""], ["==", ["var", "context.submitting"], false]]` — compound guard
- `["if", ["var", "context.loading"], "Loading...", "Submit"]` — conditional text

## Element Runtime Properties

| Property | Type | Description |
|----------|------|-------------|
| `binding` | object | Maps element props to expressions: `{ "content": ["var", "context.label"] }` |
| `visibleWhen` | expr | Show only when truthy |
| `enabledWhen` | expr | Interactive only when truthy |
| `onPress` | array | Actions/effects on click |
| `onChange` | array | Actions/effects on value change |
| `testId` | string | Stable test identifier (becomes `data-testid`) |
| `aria` | object | Accessibility: `{ "label": "Submit form", "live": "polite" }` |
