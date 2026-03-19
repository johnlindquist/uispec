# UXSpec

**One file. Human-readable. Agent-writable. Machine-executable.**

UXSpec is a JSON format that describes what your UI looks like *and* how it behaves — in a single artifact that compiles to any language or framework.

```
  .uxspec.json ──→ React
                ──→ SwiftUI
  state machine ──→ Flutter
  + visuals     ──→ Compose
  + tokens      ──→ anything
  + tests
```

---

## The Problem

Today, a single UI component lives across **3+ files** — state logic in hooks, layout in JSX, styles in CSS. To answer "what does the error state look like?", an agent reads three files and reconstructs the picture. To add a state, it modifies three files in sync.

## The Fix

UXSpec collapses state + visuals + tokens + tests into **one file**:

```json
{
  "$machine": {
    "id": "login",
    "initial": "idle",
    "states": {
      "idle": {
        "on": { "SUBMIT": "loading" },
        "$visual": {
          "$description": "Login form ready for input",
          "slots": {
            "form": [
              { "type": "input", "name": "email", "testId": "email-input" },
              { "type": "button", "content": "Sign In", "testId": "submit-btn" }
            ]
          }
        }
      },
      "loading": {
        "$visual": { "$description": "Spinner replaces button, inputs disabled" }
      },
      "error": {
        "$visual": { "$description": "Red error banner above form" }
      },
      "success": {
        "entry": [{ "kind": "navigate", "to": "/dashboard" }]
      }
    }
  }
}
```

4 states. Every transition, visual, and test hook — one file. No drift.

---

## Key Properties

**Humans read it.** `$description` fields are natural language — review a spec in a PR like you'd review a design doc.

**Agents write it.** Structured JSON with a schema. An agent generates or modifies specs without ambiguity. Another agent (or code generator) produces a pixel-accurate implementation from the spec alone.

**Machines execute it.** The compiler validates, resolves tokens, flattens states, and outputs a runtime artifact. Any renderer consumes it directly — React, SwiftUI, Compose, Flutter, or a custom engine.

**Any language. Any framework.** JSON is parseable everywhere. No TypeScript, no CSS, no framework lock-in. The compiled format needs ~30 lines to consume in any language.

**Tests are built in.** Every `testId` becomes an assertion in the compiled output. CI verifies rendered UI matches the spec — no manual test authoring.

---

## Agent Skill

The [`skills/`](skills/) directory contains an agent skill that **guides spec authoring step by step**:

1. Gather requirements (states, events, context)
2. Design the state machine
3. Define tokens and visuals
4. Add runtime semantics
5. Compile and verify

Point your agent at `skills/SKILL.md` and it walks through the entire workflow — from idea to compiled, validated spec. The skill references format docs and a minimal template so the agent stays on-schema.

```bash
# Example: an agent uses the skill to scaffold a new spec
bun run src/compiler/cli.ts compile examples/03-toast-notifications.uxspec.json
# → {"ok":true,"states":8,"assertions":12,"leafInitial":true}
```

---

## Format at a Glance

A `.uxspec.json` file has up to eight sections:

| Section | Purpose |
|---------|---------|
| `$tokens` | Design vocabulary — colors, spacing, typography, timing ([W3C Design Tokens](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)) |
| `$animations` | Named keyframe definitions |
| `$elements` | Reusable component templates with parameters |
| `$context` | Typed runtime state — form values, flags, errors |
| `$events` | Typed event catalog — user, network, timer, system |
| `$actions` / `$effects` | Pure mutations vs. side effects |
| `$machine` | Statechart where every state carries a `$visual` |

Every `$visual` includes: `$description`, `slots` (rendered elements), `container` (layout), `keyboard` (keybindings), `onEnter` (focus/animations), and `autoDismiss`.

---

## Examples

| Example | Demonstrates |
|---------|-------------|
| [Recording Overlay](examples/01-recording-overlay.uxspec.json) | Compound states, dynamic expressions, auto-dismiss, keyboard bindings |
| [Auth Flow](examples/02-auth-flow.uxspec.json) | Multi-page routing, OAuth, email verification, rate limiting |
| [Toast Notifications](examples/03-toast-notifications.uxspec.json) | Ephemeral lifecycle, hover-to-pause, swipe-to-dismiss, stacking |
| [Form Validation](examples/04-form-validation.uxspec.json) | Per-field validation, async debounce, password strength, cross-field rules |
| [Media Player](examples/05-media-player.uxspec.json) | Parallel states, continuous values, buffering, picture-in-picture |
| [Data Resource Page](examples/06-data-resource-page.uxspec.json) | Route-level loading, optimistic save, rollback, toast on success |

---

## Quick Start

```bash
# Validate
bun run src/compiler/cli.ts validate examples/02-auth-flow.uxspec.json

# Compile → dist/compiled/02-auth-flow.compiled.json
bun run src/compiler/cli.ts compile examples/02-auth-flow.uxspec.json

# Inspect (no file output)
bun run src/compiler/cli.ts inspect examples/02-auth-flow.uxspec.json

# Run tests
bun test
```

---

## Status

Active specification. The visual layer is stable, runtime semantics (v0.2) are newly normative. Looking for feedback on the runtime model, layout primitives, and expression language.

See [spec/SPEC.md](spec/SPEC.md) for the full specification and [spec/COMPILER.md](spec/COMPILER.md) for compiler reference with Python, Rust, and Swift examples.

## License

MIT
