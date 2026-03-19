# UXSpec

**A JSON format that is readable and writable by both humans and AI agents — and directly executable by machines.**

Most UI specifications are either human-friendly (Figma, prose docs) or machine-friendly (code, ASTs). You write a design spec for humans, then translate it to code for machines. The spec and the code drift apart. Nobody trusts either one.

UXSpec is both at once. A human reads the `$description` fields and understands intent. An agent reads the structured JSON and generates pixel-accurate implementations. A compiler validates it, flattens it, and produces a runtime artifact that any renderer can execute — React, SwiftUI, Compose, Flutter, or a custom engine.

**One artifact. Readable by humans. Writable by agents. Executable by machines.**

You describe what your UI looks like and how it behaves in a single file. That file is the spec, the documentation, and the source of truth for rendering — all at once. No translation step. No drift.

## Why This Exists

Today, when an AI agent needs to understand or generate a UI component, it must triangulate across multiple files:

- **State logic** scattered across `useState`, `useEffect`, event handlers
- **Layout** embedded in JSX conditionals (`state === "loading" && <Spinner />`)
- **Styling** in a separate CSS/Tailwind/styled-components file
- **Interaction rules** (hover, focus, keyboard) in more event handlers

To answer "what does the error state look like?", the agent has to read three files and mentally reconstruct the picture. To generate a new state, it has to modify three files in sync.

UXSpec collapses all of this into one artifact. One file. One source of truth. The state machine says what happens. The visual spec on each state says what it looks like. The tokens say what colors and spacing are available. An agent reads one file and knows everything.

### Concrete Example: A Login Form

In a typical React codebase, a login form with loading and error states spans 3+ files:

```tsx
// LoginForm.tsx — 80 lines of JSX with conditional rendering
// useLogin.ts — 40 lines of state management
// login.module.css — 60 lines of styles
```

In UXSpec, the same component is **one file** where every state is explicit:

```json
{
  "$machine": {
    "id": "login",
    "initial": "idle",
    "states": {
      "idle": {
        "on": { "SUBMIT": { "target": "loading", "guard": ["!=", ["var", "context.email"], ""] } },
        "$visual": {
          "$description": "Login form ready for input",
          "slots": {
            "form": [
              { "type": "input", "name": "email", "testId": "email-input" },
              { "type": "input", "name": "password", "testId": "password-input" },
              { "type": "button", "content": "Sign In", "testId": "submit-btn",
                "enabledWhen": ["!=", ["var", "context.email"], ""],
                "onPress": [{ "kind": "emit", "event": "SUBMIT" }] }
            ]
          }
        }
      },
      "loading": {
        "entry": [{ "kind": "http", "request": "signIn" }],
        "on": { "HTTP_OK": "success", "HTTP_ERROR": "error" },
        "$visual": {
          "$description": "Spinner replaces submit button, inputs disabled",
          "slots": {
            "form": [
              { "type": "input", "name": "email", "enabledWhen": false },
              { "type": "input", "name": "password", "enabledWhen": false },
              { "type": "icon", "name": "spinner", "icon": "Loader" }
            ]
          }
        }
      },
      "error": {
        "on": { "SUBMIT": "loading", "INPUT_CHANGED": "idle" },
        "$visual": {
          "$description": "Error banner above form, fields re-enabled",
          "slots": {
            "error": [{ "type": "text", "content": ["var", "context.error"], "color": "#ee5555", "testId": "error-msg" }],
            "form": [
              { "type": "input", "name": "email", "testId": "email-input" },
              { "type": "button", "content": "Try Again", "testId": "submit-btn" }
            ]
          }
        }
      },
      "success": {
        "entry": [{ "kind": "navigate", "to": "/dashboard" }],
        "$visual": { "$description": "Redirect to dashboard — transient state" }
      }
    }
  }
}
```

An agent reads this and immediately knows: there are 4 states, the submit button is disabled when email is empty, the error state shows a red banner with the error message, and success navigates to `/dashboard`. No guessing. No file hopping.

### What You Get

- **Human + agent read/write.** A designer reads `$description` fields and reviews the spec in a PR. An agent reads the structured JSON to generate or modify the UI. Both work on the same file. No translation layer, no "spec vs implementation" divergence.
- **Machine executable.** The compiler validates, resolves tokens, flattens states, and outputs a runtime artifact. A renderer consumes it directly — no interpretation, no guessing. Two independent renderers given the same compiled spec MUST produce the same UI.
- **Cross-platform from one source.** The same spec renders to React, SwiftUI, Compose, or Flutter. Layout primitives (`stack-h`, `stack-v`, `grid`) map to each platform's native equivalent.
- **Built-in test contracts.** Every `testId` generates an assertion in the compiled output. CI can verify that the rendered UI matches the spec without writing manual tests.
- **Atomic state changes.** Adding a new state means adding one block with transitions AND visuals. Nothing else to update. No "forgot to add the CSS" bugs. An agent can add a feature by adding a state — the visual and behavior are defined together.

## Format Overview

A `.uxspec.json` file has up to eight sections:

```
┌──────────────────────────────────────┐
│  $tokens      Design vocabulary      │
│               (colors, spacing,      │
│               typography, timing)    │
├──────────────────────────────────────┤
│  $animations  Named keyframe defs    │
├──────────────────────────────────────┤
│  $elements    Reusable component     │
│               specs (buttons,        │
│               inputs, badges)        │
├──────────────────────────────────────┤
│  $context     Typed runtime state    │
│               (form values, flags,   │
│               error messages)        │
├──────────────────────────────────────┤
│  $events      Typed event catalog    │
│               (user, network,        │
│               timer, system)         │
├──────────────────────────────────────┤
│  $actions     Pure state mutations   │
│  $effects     Side-effecting ops     │
├──────────────────────────────────────┤
│  $machine     Statechart where       │
│               every state has a      │
│               $visual describing     │
│               its complete UI        │
└──────────────────────────────────────┘
```

Every state in `$machine` carries a `$visual` object with:

- `$description` — natural language summary (the most important field for agents)
- `slots` — what elements render in each content area
- `container` — layout and styling for the state's root element
- `keyboard` — key bindings active in this state
- `onEnter` — focus management and entry animations
- `autoDismiss` — auto-transition after a duration

States also carry runtime semantics: `entry`/`exit` actions, `always` (transient) transitions, `invoke` for long-running effects, and guarded transitions with inline actions. Elements can declare `binding`, `visibleWhen`, `enabledWhen`, `testId`, and `aria` to connect visual structure to runtime data.

## What Makes This Different

**State machines are the skeleton, visual specs are the skin, and they live in the same body.**

Other approaches separate behavior from appearance:

| Library | Behavior | Appearance | Same file? |
|---------|----------|------------|------------|
| XState | State machine | Your JSX + CSS | No |
| Zag.js | State machine | Your JSX + CSS (via `data-state`) | No |
| React Aria | State hooks | Your styled components | No |
| CVA/Panda | — | Variant-to-style map | No behavior |
| **UXSpec** | **State machine** | **`$visual` on each state** | **Yes** |

## Built on Standards

- **Tokens** follow the [W3C Design Tokens Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) — `$type`, `$value`, alias syntax `{path.to.token}`
- **State machines** are compatible with [SCJSON](https://statecharts.sh/) (JSON translation of W3C SCXML)
- **Layout** uses abstract primitives (`stack-h`, `stack-v`, `grid`, `layer`) that map to CSS, SwiftUI, Compose, or Flutter

## Language Agnostic

JSON is parseable by every language. The format has no TypeScript, no CSS, no framework-specific concepts.

A **compiled** version of any `.uxspec.json` resolves all token references and element refs into concrete values and preserves the full runtime model — context schema, event schema, guarded transitions, entry/exit actions, and verification assertions. Consuming the compiled format requires a small amount of code in any language:

- Transition lookup with guards: `table[state][event]` + guard evaluation
- Expression evaluator: recursive match on ~20 ops (25-35 lines)
- Visual tree walker: recursive match on element types (30-50 lines)

See [spec/COMPILER.md](spec/COMPILER.md) for reference implementations in Python, Rust, and Swift.

## Examples

Each example targets different edge cases:

| Example | What it tests |
|---------|---------------|
| [01-recording-overlay](examples/01-recording-overlay.uxspec.json) | Compound states, dynamic expressions (waveform bars), auto-dismiss, keyboard bindings, focus management |
| [02-auth-flow](examples/02-auth-flow.uxspec.json) | Multi-page routing, OAuth redirect, email verification, rate limiting, form-level vs field-level errors |
| [03-toast-notifications](examples/03-toast-notifications.uxspec.json) | Ephemeral lifecycle (enter → visible → exit), hover-to-pause countdown, swipe-to-dismiss, action buttons (undo), stacking |
| [04-form-validation](examples/04-form-validation.uxspec.json) | Per-field validation states (pristine/dirty/touched/error/valid), async validation with debounce, character counters, password strength, cross-field validation, network errors |
| [05-media-player](examples/05-media-player.uxspec.json) | Parallel states (playback + volume + display mode), continuous values (seek position, volume), buffering stalls, picture-in-picture, error recovery |
| [06-data-resource-page](examples/06-data-resource-page.uxspec.json) | Route-level loading, data fetch on entry, success/empty/error branches, retry, form edit, optimistic save, rollback on failure, toast on success, focus management, test IDs, aria metadata |

## Quick Start

```bash
# Validate a spec (checks for structural and semantic errors)
bun run src/compiler/cli.ts validate examples/02-auth-flow.uxspec.json

# Compile to flat, fully-resolved runtime format
bun run src/compiler/cli.ts compile examples/02-auth-flow.uxspec.json
# → writes dist/compiled/02-auth-flow.compiled.json

# Inspect the compiled state graph without writing files
bun run src/compiler/cli.ts inspect examples/02-auth-flow.uxspec.json

# Run all tests
bun test
```

The compiler outputs structured JSON so agents can parse results programmatically:

```json
{"file":"examples/02-auth-flow.uxspec.json","ok":true,"states":17,"assertions":21,"leafInitial":true}
```

When validation fails, you get actionable issue codes:

```json
{"ok":false,"issues":[{"code":"UNDECLARED_CONTEXT_VAR","message":"Expression references undeclared context variable \"email\"","path":"$machine.states.idle.$visual"}]}
```

## For AI Agents

An agent working with UXSpec can:

**Read** a `.uxspec.json` to understand a component's full behavior and appearance — every state, every transition, every pixel value, every interaction state — from a single file.

**Write** a `.uxspec.json` to define a new component. The format is constrained enough that the output is unambiguous: another agent (or a code generator) can produce a pixel-accurate implementation from the spec alone.

**Verify** a rendered component against its spec. Compare a screenshot to the `$visual` — check that colors match token values, elements are in the right slots, and interaction states apply the right style overrides.

**Modify** behavior and visuals atomically. Adding a new state means adding one block with both `on` (transitions) and `$visual` (appearance). Nothing else to update.

The `$description` on every state and element is natural language documentation that agents can use for reasoning without parsing the visual structure. A valid strategy is: read descriptions to understand intent, read the structured spec to get exact values.

## Project Structure

```
uxspec/
├── README.md
├── spec/
│   ├── SPEC.md           Format specification
│   └── COMPILER.md       Compiler reference + per-language runtimes
├── schema/
│   └── uxspec.schema.json   JSON Schema for validation
├── src/compiler/
│   ├── cli.ts            CLI entry point (validate, compile, inspect)
│   ├── compile.ts        Five-phase compiler orchestration
│   ├── resolve.ts        Token and $ref resolution
│   ├── state-paths.ts    State hierarchy flattening
│   ├── validate.ts       Runtime semantics validation
│   ├── diagnostics.ts    Structured issue codes
│   └── types.ts          Shared types
├── skills/
│   └── SKILL.md          Agent skill for guided spec authoring
├── examples/
│   ├── 01-recording-overlay.uxspec.json
│   ├── 02-auth-flow.uxspec.json
│   ├── 03-toast-notifications.uxspec.json
│   ├── 04-form-validation.uxspec.json
│   ├── 05-media-player.uxspec.json
│   └── 06-data-resource-page.uxspec.json
└── tests/
    ├── compile.test.ts             Core compilation tests
    ├── validate.test.ts            Validation tests
    ├── compiler.cli.test.ts        CLI integration tests
    ├── compiler.conformance.test.ts  Output conformance tests
    └── compiler.failures.test.ts   Diagnostic issue tests
```

## Runtime Semantics (v0.2)

UXSpec v0.2 adds a normative execution model. The spec now defines:

- **Typed context** (`$context`) — declare every runtime variable with a type and default.
- **Typed events** (`$events`) — declare every event with source and payload schema.
- **Actions and effects** (`$actions`, `$effects`) — pure state mutations vs. side-effecting operations.
- **State lifecycle** — `entry`, `exit`, `always` (transient transitions), `invoke` (long-running effects).
- **Element data binding** — `binding`, `visibleWhen`, `enabledWhen` connect UI elements to runtime state.
- **Verification hooks** — `testId` and `aria` enable deterministic testing and accessibility auditing.
- **Extended expression language** — comparison (`==`, `!=`, `<`, `<=`, `>`, `>=`), boolean (`!`, `&&`, `||`), and utility (`get`, `coalesce`) operators.

The compiled format preserves context/event schemas, guarded transitions, entry/exit behavior, and optional assertions so a renderer or agent can implement the full application from a single artifact.

> **Migration note.** The existing examples (01–05) use some legacy fields (`command`, `bind`, `conditional`, `errorStyle`, `stateStyles`) that predate the v0.2 runtime model. These are documented as aliases in the spec and will be migrated in a future cycle. New examples should use the v0.2 runtime properties exclusively.

## Status

This is an active specification. The visual layer is maturing, and the runtime semantics layer (v0.2) is newly normative. We're looking for feedback on:

- Does the runtime model (`$context`, `$events`, actions, effects) cover enough to implement a real app?
- Are the layout primitives (`stack-h`, `stack-v`, `grid`, `layer`) sufficient?
- Is the expression language too limited or too complex?
- What edge cases are missing from the examples?
- Would you use this for cross-platform rendering, agent-driven development, design-to-code, or something else?

## License

MIT
