---
name: wire
description: Connect the spec to behavior — wire up $context, $events, actions, effects, guards, and element bindings
---

# Wire: Runtime Semantics

Connect the spec to behavior — context, events, actions, effects, bindings, guards. This is where the state machine comes alive.

## When to Use

When adding `$context`, `$events`, `$actions`, `$effects`, or wiring `binding`, `visibleWhen`, `enabledWhen`, `onPress`, `onChange` on elements.

## Context (`$context`)

Every piece of runtime state needs a typed field with a default:
```json
"$context": {
  "email":      { "type": "string",  "default": "" },
  "submitting": { "type": "boolean", "default": false },
  "error":      { "type": "string",  "default": null }
}
```

**Decisions:**
- Only declare fields the spec actually reads or writes. No speculative context.
- Use `null` as default for "not yet known" values (error messages, fetched data).
- Use empty collections (`[]`, `{}`) for "nothing yet" — distinct from `null` ("never fetched").
- Name fields by what they represent, not by where they're used: `error` not `errorBannerText`.

## Events (`$events`)

Every trigger the machine responds to:
```json
"$events": {
  "SUBMIT":        { "source": "user",    "payload": {} },
  "INPUT_CHANGED": { "source": "user",    "payload": { "name": { "type": "string" }, "value": { "type": "string" } } },
  "HTTP_OK":       { "source": "network", "payload": { "data": { "type": "object" } } }
}
```

**Decisions:**
- Name events as past-tense facts or imperative commands: `SUBMIT`, `HTTP_OK`, `TIMER_EXPIRED`.
- Source types: `user` (clicks, input), `network` (API responses), `timer`, `system` (lifecycle), `storage`.
- Payload should carry only what the machine needs to decide or store. Don't pass entire API responses if you only need one field.

## Bindings and Conditional Display

- **`binding`** — connects element props to expressions: `{ "content": ["var", "context.label"] }`
- **`visibleWhen`** — show only when truthy: `["!=", ["var", "context.error"], null]`
- **`enabledWhen`** — interactive only when truthy: `["==", ["var", "context.submitting"], false]`
- **`onPress`** / **`onChange`** — actions/effects triggered by interaction

**Decisions:**
- Prefer `visibleWhen` over separate states when the difference is purely whether an element shows. Use separate states when the difference changes what the user can *do*.
- Disable buttons during async operations. Don't rely on guards alone — users should see why they can't act.
- Always pair a disabled button with a visible reason (loading indicator, validation message).

## Guards

Guards control whether a transition fires:
```json
"on": {
  "SUBMIT": {
    "target": "loading",
    "guard": ["&&",
      ["!=", ["var", "context.email"], ""],
      ["==", ["var", "context.submitting"], false]
    ]
  }
}
```

**Decisions:**
- Guards should be simple boolean checks. Complex logic belongs in context preparation, not guard expressions.
- If a guard prevents a transition, the user should understand why. Pair guards with `enabledWhen` on the triggering element.
- Use `always` transitions (with guards) for automatic routing — e.g., skip a step if data already exists.

## Actions and Effects

**Actions** are pure state mutations (synchronous):
- `assign` — update context: `{ "kind": "assign", "path": "context.error", "value": null }`
- `emit` — raise an event: `{ "kind": "emit", "event": "FORM_RESET" }`
- `log` — debug output: `{ "kind": "log", "level": "info", "message": "submitted" }`

**Effects** are side effects (async, external):
- `http` — API call
- `timer.start` / `timer.cancel` — delayed events
- `navigate` — route change
- `focus` — move focus to an element
- `storage.write` — persist to storage

**Decisions:**
- Clear context on state entry, not exit. Entry actions are guaranteed to run; exit actions may be skipped if the machine is destroyed.
- Set loading flags in `entry`, clear them in `exit`.
- Focus management is a first-class concern. Define `focus` effects in `onEnter` for every state that changes the interactive surface.

## Principle

Runtime semantics exist to close the gap between "what this looks like" and "what this does." Every binding, guard, and action should make the spec more precise — not more complex. If wiring feels complicated, the state machine probably needs simplification first.
