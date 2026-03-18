# UISpec

**A JSON format for AI agents to define complete application interfaces.**

State machines are excellent documentation — they describe application behavior in a way that is both executable code and a human-readable spec. UISpec extends this idea to the visual layer. Each state in the machine also declares exactly what the UI looks like: layout, styling, typography, animation, and interaction states.

The result is a single file that an AI agent can read to understand an entire UI, or write to define one from scratch — without ambiguity, without cross-referencing CSS files, without inferring visual intent from JSX conditionals.

## Why This Exists

Today, when an AI agent needs to understand or generate a UI component, it must triangulate across multiple files:

- **State logic** scattered across `useState`, `useEffect`, event handlers
- **Layout** embedded in JSX conditionals (`state === "loading" && <Spinner />`)
- **Styling** in a separate CSS/Tailwind/styled-components file
- **Interaction rules** (hover, focus, keyboard) in more event handlers

To answer "what does the error state look like?", the agent has to read three files and mentally reconstruct the picture. To generate a new state, it has to modify three files in sync.

UISpec collapses all of this into one artifact. One file. One source of truth. The state machine says what happens. The visual spec on each state says what it looks like. The tokens say what colors and spacing are available. An agent reads one file and knows everything.

## Format Overview

A `.uispec.json` file has up to eight sections:

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
| **UISpec** | **State machine** | **`$visual` on each state** | **Yes** |

## Built on Standards

- **Tokens** follow the [W3C Design Tokens Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) — `$type`, `$value`, alias syntax `{path.to.token}`
- **State machines** are compatible with [SCJSON](https://statecharts.sh/) (JSON translation of W3C SCXML)
- **Layout** uses abstract primitives (`stack-h`, `stack-v`, `grid`, `layer`) that map to CSS, SwiftUI, Compose, or Flutter

## Language Agnostic

JSON is parseable by every language. The format has no TypeScript, no CSS, no framework-specific concepts.

A **compiled** version of any `.uispec.json` resolves all token references and element refs into concrete values and preserves the full runtime model — context schema, event schema, guarded transitions, entry/exit actions, and verification assertions. Consuming the compiled format requires a small amount of code in any language:

- Transition lookup with guards: `table[state][event]` + guard evaluation
- Expression evaluator: recursive match on ~20 ops (25-35 lines)
- Visual tree walker: recursive match on element types (30-50 lines)

See [spec/COMPILER.md](spec/COMPILER.md) for reference implementations in Python, Rust, and Swift.

## Examples

Each example targets different edge cases:

| Example | What it tests |
|---------|---------------|
| [01-recording-overlay](examples/01-recording-overlay.uispec.json) | Compound states, dynamic expressions (waveform bars), auto-dismiss, keyboard bindings, focus management |
| [02-auth-flow](examples/02-auth-flow.uispec.json) | Multi-page routing, OAuth redirect, email verification, rate limiting, form-level vs field-level errors |
| [03-toast-notifications](examples/03-toast-notifications.uispec.json) | Ephemeral lifecycle (enter → visible → exit), hover-to-pause countdown, swipe-to-dismiss, action buttons (undo), stacking |
| [04-form-validation](examples/04-form-validation.uispec.json) | Per-field validation states (pristine/dirty/touched/error/valid), async validation with debounce, character counters, password strength, cross-field validation, network errors |
| [05-media-player](examples/05-media-player.uispec.json) | Parallel states (playback + volume + display mode), continuous values (seek position, volume), buffering stalls, picture-in-picture, error recovery |
| [06-data-resource-page](examples/06-data-resource-page.uispec.json) | Route-level loading, data fetch on entry, success/empty/error branches, retry, form edit, optimistic save, rollback on failure, toast on success, focus management, test IDs, aria metadata |

## For AI Agents

An agent working with UISpec can:

**Read** a `.uispec.json` to understand a component's full behavior and appearance — every state, every transition, every pixel value, every interaction state — from a single file.

**Write** a `.uispec.json` to define a new component. The format is constrained enough that the output is unambiguous: another agent (or a code generator) can produce a pixel-accurate implementation from the spec alone.

**Verify** a rendered component against its spec. Compare a screenshot to the `$visual` — check that colors match token values, elements are in the right slots, and interaction states apply the right style overrides.

**Modify** behavior and visuals atomically. Adding a new state means adding one block with both `on` (transitions) and `$visual` (appearance). Nothing else to update.

The `$description` on every state and element is natural language documentation that agents can use for reasoning without parsing the visual structure. A valid strategy is: read descriptions to understand intent, read the structured spec to get exact values.

## Project Structure

```
uispec/
├── README.md
├── spec/
│   ├── SPEC.md           Format specification
│   └── COMPILER.md       Compiler reference + per-language runtimes
└── examples/
    ├── 01-recording-overlay.uispec.json
    ├── 02-auth-flow.uispec.json
    ├── 03-toast-notifications.uispec.json
    ├── 04-form-validation.uispec.json
    ├── 05-media-player.uispec.json
    └── 06-data-resource-page.uispec.json
```

## Runtime Semantics (v0.2)

UISpec v0.2 adds a normative execution model. The spec now defines:

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
