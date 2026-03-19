<p align="center">
  <img src="https://raw.githubusercontent.com/johnlindquist/uxspec/main/logo.png" alt="UXSpec logo" width="400">
</p>

# UXSpec

**A contract between Human, Agent, and Machine.**

UXSpec is a JSON format where humans describe intent, agents generate structure, and machines compile to any framework — all in a single file.

```
  Human ──────┐
  Agent ──────┼──→ .uxspec.json ──→ React, SwiftUI,
  Machine ────┘                     Slint, Compose, ...
```

---

## Why a Contract?

A UI component today is scattered across **3+ files** — state logic, layout, styles. No single artifact captures the full picture. Humans can't review it at a glance. Agents can't modify it without juggling files. Machines can't verify it without running the app.

UXSpec is the **single source of truth** that all three parties agree on:

**Humans** write the intent. `$description` fields are natural language — review a spec in a PR like a design doc. Define tokens, name states, describe what each state looks like.

**Agents** produce the structure. Structured JSON with a schema. An agent generates or modifies specs without ambiguity. No guessing file boundaries or reconciling drift.

**Machines** enforce the contract. The compiler validates, resolves tokens, flattens states, and outputs a runtime artifact. Any renderer — React, SwiftUI, Compose, Slint — consumes it directly. Every `testId` becomes a verifiable assertion.

---

## One File, Everything

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

## Format at a Glance

A `.uxspec.json` file has up to nine sections:

| Section | Purpose |
|---------|---------|
| `$imports` | Share tokens, elements, and machines across files |
| `$tokens` | Design vocabulary — colors, spacing, typography, timing ([W3C Design Tokens](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)) |
| `$animations` | Named keyframe definitions |
| `$elements` | Reusable component templates with parameters |
| `$context` | Typed runtime state — form values, flags, errors |
| `$events` | Typed event catalog — user, network, timer, system |
| `$actions` / `$effects` | Pure mutations vs. side effects |
| `$machine` | Statechart where every state carries a `$visual` |

Every `$visual` includes: `$description`, `slots` (rendered elements), `container` (layout), `keyboard` (keybindings), `onEnter` (focus/animations), and `autoDismiss`.

---

## Composability

Large apps can split specs by module. `$imports` lets files share tokens, elements, and machines through explicit namespace aliases.

```json
{
  "$imports": {
    "ds": {
      "from": "./design-system.uxspec.json",
      "tokens": true,
      "elements": true
    },
    "settings": {
      "from": "./settings.uxspec.json",
      "machine": true
    }
  }
}
```

**Qualified references** — imported names use an `alias:` prefix so there's zero ambiguity:

```json
"{ds:color.brand.500}"
{ "$ref": "ds:primaryButton" }
```

**Machine composition** — one module invokes another via `invoke.kind = "machine"`. The child runs to a `type: "final"` state, then the parent transitions via `onDone`:

```json
"settingsFlow": {
  "invoke": [{
    "kind": "machine",
    "src": "settings",
    "id": "settingsFlow",
    "onDone": { "done": "home" }
  }]
}
```

**Bundle mode** — compile everything into a single deployment artifact:

```bash
bun run src/compiler/cli.ts compile --bundle examples/07-composable-app/app.uxspec.json
# → {"ok":true,"entry":"app","modules":2}
```

See [examples/07-composable-app/](examples/07-composable-app/) for a full worked example.

---

## Agent Skill

The [`skills/`](skills/) directory contains an agent skill that **guides spec authoring step by step**:

1. Gather requirements (states, events, context)
2. Design the state machine
3. Define tokens and visuals
4. Add runtime semantics
5. Compile and verify

Point your agent at `skills/SKILL.md` and it walks through the entire workflow — from idea to compiled, validated spec.

```bash
bun run src/compiler/cli.ts compile examples/03-toast-notifications.uxspec.json
# → {"ok":true,"states":8,"assertions":12,"leafInitial":true}
```

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
| [Composable App](examples/07-composable-app/) | `$imports`, shared design system, machine invoke, final states, bundle mode |

---

## Quick Start

```bash
# Validate
bun run src/compiler/cli.ts validate examples/02-auth-flow.uxspec.json

# Compile → dist/compiled/02-auth-flow.compiled.json
bun run src/compiler/cli.ts compile examples/02-auth-flow.uxspec.json

# Compile with imports → resolves cross-file tokens, elements, machine invokes
bun run src/compiler/cli.ts compile examples/07-composable-app/app.uxspec.json

# Bundle → single JSON with all modules
bun run src/compiler/cli.ts compile --bundle examples/07-composable-app/app.uxspec.json

# Inspect (no file output)
bun run src/compiler/cli.ts inspect examples/02-auth-flow.uxspec.json

# Run tests
bun test
```

---

## Status

Active specification. The visual layer is stable, runtime semantics (v0.2) are newly normative. Looking for feedback on the runtime model, layout primitives, and expression language.

See [spec/SPEC.md](spec/SPEC.md) for the full specification and [spec/COMPILER.md](spec/COMPILER.md) for compiler reference with Python, Rust, and Swift examples.

## Acknowledgments

Design decision prompts in the agent skill are informed by [Impeccable](https://github.com/pbakaus/impeccable) by [Paul Bakaus](https://github.com/pbakaus) — a design quality framework for AI-generated interfaces.

## License

MIT
