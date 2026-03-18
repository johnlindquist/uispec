---
name: uispec
description: Walk through building a UISpec (.uispec.json) file — gathering requirements, designing the state machine, defining visuals, then compiling and verifying the output.
---

# UISpec Builder

Interactive workflow for creating UISpec files — the JSON format that unifies state machines and visual specifications for AI agents.

## Trigger

Use when the user wants to create, build, or scaffold a `.uispec.json` file, or asks "help me write a uispec".

## Workflow

Follow these phases in order. Each phase produces a concrete artifact before moving on.

### Phase 1 — Gather Requirements

Ask the user:
1. **What is this component/page?** (e.g., "login form", "toast notifications", "media player")
2. **What are the key states?** (e.g., "idle, loading, error, success")
3. **What events drive transitions?** (e.g., "SUBMIT, INPUT_CHANGED, HTTP_OK, HTTP_ERROR")
4. **What context data is needed?** (e.g., "email: string, password: string, error: string | null")
5. **Any reusable elements?** (e.g., "input field with label, action button")

Summarize back to the user as a bullet list before proceeding.

### Phase 2 — Design the State Machine

Build the `$machine` section:
- Define compound states (parents) and leaf states (children)
- Every compound state needs an `initial` child
- Map events to transitions with optional guards and actions
- Add `entry`/`exit` actions where needed (e.g., set loading flag, clear errors)
- Add `invoke` for long-running effects (HTTP calls, timers)

Present the state graph as a text diagram:

```
idle --SUBMIT--> loading
loading --HTTP_OK--> success
loading --HTTP_ERROR--> error
error --RETRY--> loading
```

### Phase 3 — Define Tokens and Visuals

1. Define `$tokens` — colors, spacing, radius, font, timing (follow W3C Design Tokens format)
2. Define `$elements` — reusable element templates with `params`
3. Add `$visual` to each leaf state — container layout, slots with elements
4. Add `testId` to interactive elements for assertions
5. Add `aria` labels for accessibility

Read `references/format-reference.md` for token syntax, element types, and visual structure.

### Phase 4 — Add Runtime Semantics

1. Define `$context` — typed fields with defaults
2. Define `$events` — with source and payload types
3. Define `$actions` — assign, emit, log
4. Define `$effects` — http, timer, navigate, focus
5. Wire `binding`, `visibleWhen`, `enabledWhen`, `onPress`, `onChange` on elements

Read `references/runtime-semantics.md` for expression syntax and action/effect kinds.

### Phase 5 — Generate and Verify

1. Write the spec to `examples/<name>.uispec.json`
2. Validate: `bun run src/compiler/cli.ts validate examples/<name>.uispec.json`
3. If validation fails, fix reported issues (the compiler returns structured issue codes)
4. Compile: `bun run src/compiler/cli.ts compile examples/<name>.uispec.json`
5. Inspect: `bun run src/compiler/cli.ts inspect examples/<name>.uispec.json`
6. Report to the user:
   - Number of states and assertions
   - Whether initial resolves to a leaf state
   - Any unresolved refs or token aliases
   - The compiled output path

### Issue Resolution

If the compiler reports issues, map codes to fixes:

| Code | Fix |
|------|-----|
| `UNDECLARED_CONTEXT_VAR` | Add missing field to `$context` |
| `UNDECLARED_EVENT` | Add missing event to `$events` |
| `UNDECLARED_TARGET` | Fix transition target to match a valid state path |
| `UNSUPPORTED_EXPR_OP` | Replace with a supported operator (see spec) |
| `INVALID_ASSIGN_PATH` | Ensure path starts with `context.` |
| `UNKNOWN_TOKEN_REFERENCE` | Add missing token to `$tokens` or fix the path |
| `UNKNOWN_ELEMENT_REFERENCE` | Add missing element to `$elements` or fix the name |
| `INVALID_MACHINE_INITIAL` | Set `$machine.initial` to a valid top-level state |
| `INVALID_COMPOUND_INITIAL` | Set compound state `initial` to a valid child name |

## Key Rules

- File extension: `.uispec.json`
- Schema: `https://uispec.dev/0.2/schema.json`
- Required top-level: `$schema`, `$description`, `$machine`
- `$machine` requires: `id`, `initial`, `states`
- Leaf elements (`text`, `button`, `input`, `icon`, `shape`, `badge`, `bar`) MUST NOT have `children`
- Container elements (`group`, `layer`, `grid`, `stack-h`, `stack-v`) MAY have `children`
- Token references: `"{path.to.token}"` — curly braces inside a string
- Element references: `{ "$ref": "name", ...params }`
- Expressions: S-expression arrays like `["==", ["var", "context.x"], true]`
- All `$`-prefixed properties are reserved

## Reference Files

- `references/format-reference.md` — Token syntax, element types, visual structure, layout primitives
- `references/runtime-semantics.md` — Context, events, actions, effects, expressions, transitions
- `references/minimal-example.md` — Complete minimal spec you can use as a starting template
