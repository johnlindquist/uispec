# UISpec Format Specification v0.1

## Purpose

UISpec is a language-agnostic JSON format that unifies **state machine definitions** and **complete visual specifications** into a single file. Its primary motivation is to give AI agents a format they can read, write, and reason about to define full application interfaces — behavior, layout, styling, animation, and interaction — without ambiguity.

State machines are excellent at describing application behavior in a way that is both executable code and human-readable documentation. UISpec extends this idea to the visual layer: every state in the machine also declares exactly what the UI looks like, down to pixel values, colors, typography, and interaction states.

## Design Principles

1. **AI-agent-first.** The format is optimized for machine consumption. An agent should be able to generate a complete, pixel-accurate UI from a `.uispec.json` file without any other context.

2. **Human-readable second.** Natural language `$description` fields on every state and element make the file scannable by humans. A designer can review a PR containing a `.uispec.json` change and understand both behavioral and visual impact.

3. **Language-agnostic.** JSON is parseable by every programming language. Layout primitives (`stack-h`, `stack-v`, `grid`) map to any UI framework. No TypeScript, no CSS, no framework-specific concepts in the format itself.

4. **Standards-based.** Tokens follow the [W3C Design Tokens Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/). State machines are compatible with [SCJSON](https://statecharts.sh/) (JSON translation of W3C SCXML). No novel formats where existing standards suffice.

5. **Two-phase architecture.** An authoring format (rich, with references and tokens) compiles to a runtime format (flat, fully resolved). The authoring format is for humans and design tools. The compiled format is for runtimes and agents.

## File Format

- Extension: `.uispec.json`
- Media type: `application/uispec+json`
- Encoding: UTF-8
- All `$`-prefixed properties are reserved

## Top-Level Structure

```json
{
  "$schema": "https://uispec.dev/0.1/schema.json",
  "$description": "Human-readable description of this component",

  "$tokens": { },
  "$animations": { },
  "$elements": { },
  "$machine": { }
}
```

### `$tokens`

Design tokens following the W3C Design Tokens Format. Tokens define the visual vocabulary — colors, spacing, radii, typography, timing, shadows.

Token values use `$type` and `$value` per the W3C spec. Token references use curly brace alias syntax: `"{color.active}"`.

### `$animations`

Named keyframe animation definitions. Each animation has:

| Property | Type | Description |
|----------|------|-------------|
| `$description` | string | What this animation does |
| `duration` | dimension or token ref | How long |
| `easing` | string | Timing function |
| `repeat` | number or `"infinite"` | Iteration count |
| `keyframes` | object | Percentage keys → property values |

### `$elements`

Reusable element definitions referenced from state visuals via `$ref`. Elements can declare `params` — named slots that are filled when referenced.

### `$machine`

The statechart definition. Compatible with SCJSON structure:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Machine identifier |
| `initial` | string | Initial state name |
| `$visual` | object | Root container visual spec (shared across all states) |
| `states` | object | State nodes keyed by name |

Each state node:

| Property | Type | Description |
|----------|------|-------------|
| `on` | object | Event → target state transitions |
| `initial` | string | Initial child state (for compound states) |
| `states` | object | Child state nodes (for compound states) |
| `$visual` | object | Visual specification for this state |

## Visual Specification (`$visual`)

Every state node may have a `$visual` object describing what the UI looks like when the machine is in that state.

| Property | Type | Description |
|----------|------|-------------|
| `$description` | string | **Natural language description.** The most important field for agents. |
| `container` | object | Box/layout properties for the root element |
| `slots` | object | Named content areas (e.g., `left`, `middle`, `right`) |
| `onEnter` | object | Focus target, entry animation |
| `keyboard` | object | Key → event mappings active in this state |
| `autoDismiss` | dimension | Auto-transition to parent's next state after duration |

### Slot Inheritance

If a child state defines `slots`, those slots **override** the parent's slots entirely. If a child state does not define `slots`, it inherits the parent's visual.

This means a substate only needs to declare the slots that change:

```json
"recording": {
  "$visual": { "slots": { "left": [...], "middle": [...], "right": [...] } },
  "states": {
    "active": {
      "$visual": { "$description": "Inherits parent slots — no override needed" }
    },
    "paused": {
      "$visual": {
        "$description": "Overrides middle slot only",
        "slots": { "middle": [{ "type": "text", "content": "Paused" }] }
      }
    }
  }
}
```

## Layout Primitives

Platform-agnostic layout types:

| Primitive | CSS | SwiftUI | Compose | Flutter |
|-----------|-----|---------|---------|---------|
| `stack-h` | `flex-direction: row` | `HStack` | `Row` | `Row` |
| `stack-v` | `flex-direction: column` | `VStack` | `Column` | `Column` |
| `grid` | `display: grid` | `LazyVGrid` | `LazyVerticalGrid` | `GridView` |
| `layer` | `position: relative` | `ZStack` | `Box` | `Stack` |

## Element Types

| Type | Description |
|------|-------------|
| `icon` | Named icon with size and color |
| `text` | Styled text content (may be i18n key) |
| `button` | Interactive element with hover/press/focus states |
| `group` | Layout container with children |
| `badge` | Small status indicator |
| `shape` | Primitive shape (circle, rectangle) |
| `bar` | Data-driven bar (e.g., waveform level) |
| `input` | Text input field |

Elements with `repeat: N` are rendered N times. When combined with `dynamic` properties, each instance receives an `index` variable.

## Dynamic Expressions

Some properties depend on runtime context (e.g., audio levels, form values). These are declared in a `dynamic` array on the element:

```json
{
  "dynamic": [
    { "property": "height", "expr": ["+", 4, ["*", 16, ["pow", ["var", "level"], 0.7]]] },
    { "property": "opacity", "expr": ["max", 0.3, ["*", ["var", "level"], 1.5]] }
  ]
}
```

Expressions use S-expression arrays. The instruction set:

| Op | Args | Meaning |
|----|------|---------|
| `var` | name | Read runtime context variable |
| `+` `-` `*` `/` | a, b | Arithmetic |
| `pow` | base, exp | Exponentiation |
| `min` `max` | a, b | Clamping |
| `lerp` | a, b, t | Linear interpolation |
| `if` | cond, then, else | Conditional |
| `round` `floor` `ceil` | value | Rounding |
| `clamp` | value, min, max | Range clamping |

Literals (numbers, strings) are passed through as-is.

## Token References

Following W3C Design Tokens alias syntax:

```json
{ "color": "{color.active}" }
```

Resolves to the `$value` of the token at path `color.active` in `$tokens`. References resolve transitively (a token can reference another token).

## Element References

Reusable elements defined in `$elements` are referenced with `$ref`:

```json
{ "$ref": "action-button", "id": "crop", "icon": "Crop" }
```

The referenced element's definition is expanded inline, with the provided properties merged (overriding any matching keys).

## Compiled Format

A compile step transforms the authoring format into a flat, fully-resolved JSON file:

- All token references → concrete values
- All `$ref` elements → expanded inline
- Nested states → flat dot-separated keys
- Expression strings → S-expression arrays
- Transition table → flat `{ state: { event: targetState } }` map

The compiled format requires ~50 lines of code to consume in any language. See the [compiler reference](./COMPILER.md) for details.
