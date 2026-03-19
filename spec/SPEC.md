# UXSpec Format Specification v0.2

## Purpose

UXSpec is a language-agnostic JSON format that unifies **state machine definitions** and **complete visual specifications** into a single file. Its primary motivation is to give AI agents a format they can read, write, and reason about to define full application interfaces — behavior, layout, styling, animation, and interaction — without ambiguity.

State machines are excellent at describing application behavior in a way that is both executable code and human-readable documentation. UXSpec extends this idea to the visual layer: every state in the machine also declares exactly what the UI looks like, down to pixel values, colors, typography, and interaction states.

## Design Principles

1. **AI-agent-first.** The format is optimized for machine consumption. An agent should be able to generate a complete, pixel-accurate UI from a `.uxspec.json` file without any other context.

2. **Human-readable second.** Natural language `$description` fields on every state and element make the file scannable by humans. A designer can review a PR containing a `.uxspec.json` change and understand both behavioral and visual impact.

3. **Language-agnostic.** JSON is parseable by every programming language. Layout primitives (`stack-h`, `stack-v`, `grid`) map to any UI framework. No TypeScript, no CSS, no framework-specific concepts in the format itself.

4. **Standards-based.** Tokens follow the [W3C Design Tokens Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/). State machines are compatible with [SCJSON](https://statecharts.sh/) (JSON translation of W3C SCXML). No novel formats where existing standards suffice.

5. **Two-phase architecture.** An authoring format (rich, with references and tokens) compiles to a runtime format (flat, fully resolved). The authoring format is for humans and design tools. The compiled format is for runtimes and agents.

## File Format

- Extension: `.uxspec.json`
- Media type: `application/uxspec+json`
- Encoding: UTF-8
- All `$`-prefixed properties are reserved

## Top-Level Structure

```json
{
  "$schema": "https://raw.githubusercontent.com/johnlindquist/uxspec/main/schema/uxspec.schema.json",
  "$description": "Human-readable description of this component",

  "$tokens": { },
  "$animations": { },
  "$elements": { },
  "$context": { },
  "$events": { },
  "$actions": { },
  "$effects": { },
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
| `on` | object | Event → transition mappings |
| `always` | array | Transient transitions evaluated immediately on state entry |
| `entry` | array | Actions/effects executed when entering the state |
| `exit` | array | Actions/effects executed when leaving the state |
| `invoke` | array | Long-running effects active while the state is entered |
| `initial` | string | Initial child state (for compound states) |
| `states` | object | Child state nodes (for compound states) |
| `$visual` | object | Visual specification for this state |

### `$context`

`$context` declares the typed runtime state available to expressions, bindings, guards,
and effects. An implementation MUST initialize every declared field to its `default` value
when the machine starts. An implementation MUST reject any `var` reference to a context
field that is not declared in `$context`.

```json
"$context": {
  "email": {
    "type": "string",
    "default": "",
    "required": true,
    "$description": "Current email field value"
  },
  "submitting": {
    "type": "boolean",
    "default": false
  },
  "error": {
    "type": "string",
    "default": null
  }
}
```

Each field MUST declare a `type`. Allowed `type` values:

* `string`
* `number`
* `boolean`
* `object`
* `array`
* `null`

Optional properties:

| Property | Type | Description |
|----------|------|-------------|
| `default` | any | Initial value. MUST match the declared `type` (or be `null`). |
| `required` | boolean | If `true`, the field MUST be provided by the host before the machine starts. |
| `$description` | string | Human-readable explanation. |

### `$events`

`$events` declares every event that MAY be sent to the machine. An implementation
SHOULD warn when a transition references an event not declared in `$events`.

```json
"$events": {
  "INPUT_CHANGED": {
    "source": "user",
    "payload": {
      "name": { "type": "string" },
      "value": { "type": "string" }
    }
  },
  "SUBMIT": {
    "source": "user",
    "payload": {}
  },
  "HTTP_OK": {
    "source": "network",
    "payload": {
      "userId": { "type": "string" }
    }
  },
  "HTTP_ERROR": {
    "source": "network",
    "payload": {
      "message": { "type": "string" }
    }
  }
}
```

Each event MAY declare:

| Property | Type | Description |
|----------|------|-------------|
| `source` | string | Origin category. Allowed values: `user`, `system`, `timer`, `network`, `storage`. |
| `payload` | object | Typed payload fields. Each field follows the same schema as a `$context` field. |

### `$actions`

`$actions` declares named, reusable pure state mutations. Actions MUST NOT produce
external side effects.

Built-in action kinds:

| Kind | Required fields | Description |
|------|----------------|-------------|
| `assign` | `path`, `value` | Set a context field. `path` MUST start with `context.`. |
| `emit` | `event` | Send an event to the machine. The event MUST be declared in `$events`. |
| `log` | `level`, `message` | Emit a structured log line. `level` MUST be one of `debug`, `info`, `warn`, `error`. |

Example:

```json
{ "kind": "assign", "path": "context.email", "value": ["var", "event.value"] }
{ "kind": "emit", "event": "SUBMIT" }
{ "kind": "log", "level": "info", "message": "submit_clicked" }
```

### `$effects`

`$effects` declares named side-effecting operations. Effects interact with the outside
world and MUST be idempotent or keyed so they are safe to retry.

Built-in effect kinds:

| Kind | Required fields | Description |
|------|----------------|-------------|
| `http` | `request` | Invoke a named HTTP request definition. |
| `timer.start` | `id`, `ms`, `event` | Start a timer that sends `event` after `ms` milliseconds. |
| `timer.cancel` | `id` | Cancel a running timer. |
| `navigate` | `to` | Navigate to a route. |
| `focus` | `target` | Move focus to the named element. |
| `storage.write` | `key`, `value` | Write a value to persistent storage. |

Example:

```json
{ "kind": "http", "request": "signInRequest" }
{ "kind": "timer.start", "id": "cooldown", "ms": 3000, "event": "COOLDOWN_EXPIRED" }
{ "kind": "focus", "target": "email" }
{ "kind": "navigate", "to": "/dashboard" }
```

### Transitions

A transition maps an event (or the `always` keyword) to a target state, an optional
guard expression, and an optional list of actions.

Short form (event → target string):

```json
"on": { "SUBMIT": "loading" }
```

Object form (with guard and actions):

```json
"on": {
  "SUBMIT": {
    "target": "submitting",
    "guard": ["==", ["var", "context.submitting"], false],
    "actions": [
      { "kind": "assign", "path": "context.submitting", "value": true }
    ]
  }
}
```

`always` transitions are evaluated immediately when the state is entered. They MUST
include a `guard` to prevent infinite loops:

```json
"always": [
  { "target": "success", "guard": ["==", ["var", "context.verified"], true] }
]
```

### `entry` and `exit`

`entry` is an array of actions and/or effects executed when the machine enters a state.
`exit` is an array executed when the machine leaves a state. Entry and exit blocks run
in declared order.

```json
"loading": {
  "entry": [
    { "kind": "assign", "path": "context.loading", "value": true },
    { "kind": "http", "request": "loadResource" }
  ],
  "exit": [
    { "kind": "assign", "path": "context.loading", "value": false }
  ]
}
```

### `invoke`

`invoke` declares long-running effects that are active for the entire duration the
machine is in the state. When the machine exits the state, the invoked effect MUST be
cancelled.

```json
"recording": {
  "invoke": [
    { "kind": "timer.start", "id": "recording-tick", "ms": 1000, "event": "TICK" }
  ]
}
```

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

| Type | Category | Description |
|------|----------|-------------|
| `group` | container | Generic layout container with children |
| `layer` | container | Z-axis stacking container (equivalent to CSS `position: relative` / SwiftUI `ZStack`) |
| `grid` | container | Grid layout container |
| `stack-h` | container | Horizontal stack layout container |
| `stack-v` | container | Vertical stack layout container |
| `text` | leaf | Styled text content (may be i18n key) |
| `input` | leaf | Text input field |
| `button` | leaf | Interactive element with hover/press/focus states |
| `icon` | leaf | Named icon with size and color |
| `shape` | leaf | Primitive shape (circle, rectangle) |
| `badge` | leaf | Small status indicator |
| `bar` | leaf | Data-driven bar (e.g., waveform level) |

### Container vs Leaf Elements

Elements are classified into two categories that determine whether they may declare `children`:

- **Container-capable elements:** `group`, `layer`, `grid`, `stack-h`, `stack-v`
- **Leaf control elements:** `input`, `button`, `text`, `icon`, `shape`, `badge`, `bar`

A container-capable element MAY declare a `children` array containing other elements. A leaf control element MUST NOT declare `children` unless the schema explicitly marks it as composite.

This distinction is normative: two independent renderers MUST classify the same element tree the same way. When a labeled input or a text-with-link is needed, wrap the elements in a `group` container rather than adding `children` to a leaf control.

**Correct pattern — labeled input field:**

```json
{
  "type": "group",
  "name": "email-field",
  "layout": "stack-v",
  "gap": 4,
  "children": [
    { "type": "text", "content": "Email" },
    { "type": "input", "name": "email", "binding": { "inputType": "email" } }
  ]
}
```

**Incorrect pattern — leaf control as container:**

```json
{
  "type": "input",
  "children": [
    { "type": "text", "content": "Email" },
    { "type": "input", "name": "email" }
  ]
}
```

Elements with `repeat: N` are rendered N times. When combined with `dynamic` properties, each instance receives an `index` variable.

### Element Runtime Properties

Elements MAY declare the following runtime properties:

| Property | Type | Description |
|----------|------|-------------|
| `binding` | object | Maps element properties to context variables or event payloads. |
| `visibleWhen` | expr | The element is rendered only when this expression evaluates to truthy. |
| `enabledWhen` | expr | The element is interactive only when this expression evaluates to truthy. When falsy, the element MUST render in a disabled state. |
| `onPress` | array | Actions/effects triggered when the element is pressed/clicked. |
| `onChange` | array | Actions/effects triggered when the element's value changes. |
| `testId` | string | Stable identifier for automated testing and verification. Implementations MUST surface this as a `data-testid` attribute (web) or equivalent accessibility identifier. |
| `aria` | object | Accessibility metadata. Keys map to ARIA attributes (e.g., `{ "label": "Submit form", "live": "polite" }`). |

Example:

```json
{
  "type": "button",
  "name": "submit",
  "binding": {
    "content": ["var", "context.buttonLabel"]
  },
  "enabledWhen": ["==", ["var", "context.submitting"], false],
  "onPress": [
    { "kind": "emit", "event": "SUBMIT" }
  ],
  "testId": "auth-submit",
  "aria": { "label": "Sign in" }
}
```

#### `binding`

`binding` maps element properties to runtime values. Each key is a property name on the
element; each value is an expression that resolves against `$context` or event payload.

```json
"binding": {
  "content": ["var", "context.actionLabel"],
  "placeholder": ["var", "context.emailPlaceholder"]
}
```

### Interaction States

Elements MAY declare an `interactions` object mapping interaction state names to style
overrides. This is a visual-only concern and does not affect runtime behavior.

Recognized interaction states: `hover`, `focus`, `press`, `disabled`.

```json
"interactions": {
  "hover": { "background": "{color.accentHover}" },
  "focus": { "outlineWidth": { "value": 2, "unit": "px" }, "outlineColor": "rgba(0, 112, 243, 0.3)" },
  "disabled": { "opacity": 0.5 }
}
```

> **Note — legacy fields.** Existing examples use the following fields that are superseded
> by the runtime properties above. Implementations SHOULD treat them as aliases during a
> migration period:
>
> | Legacy field | Replacement |
> |-------------|-------------|
> | `command` | `onPress` with `{ "kind": "emit", "event": "..." }` |
> | `bind` | `binding` with a `content` key |
> | `$bind` | Parameter binding within `$elements` — distinct from runtime `binding` |
> | `conditional` | `visibleWhen` expression |
> | `errorStyle` | Conditional styling via `interactions.error` or a `visibleWhen` wrapper |
> | `stateStyles` | Per-field-state styling — use `visibleWhen` + sibling elements |

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

Expressions use S-expression arrays. An implementation MUST support all operators listed
below. An implementation MUST reject any operator not in this table.

#### Arithmetic Operators

| Op | Args | Meaning |
|----|------|---------|
| `+` | a, b | Addition |
| `-` | a, b | Subtraction |
| `*` | a, b | Multiplication |
| `/` | a, b | Division |
| `pow` | base, exp | Exponentiation |

#### Comparison Operators

| Op | Args | Meaning |
|----|------|---------|
| `==` | a, b | Equality (value, not reference) |
| `!=` | a, b | Inequality |
| `<` | a, b | Less than |
| `<=` | a, b | Less than or equal |
| `>` | a, b | Greater than |
| `>=` | a, b | Greater than or equal |

#### Boolean Operators

| Op | Args | Meaning |
|----|------|---------|
| `!` | a | Logical NOT |
| `&&` | a, b | Logical AND (short-circuiting) |
| `\|\|` | a, b | Logical OR (short-circuiting) |

#### Access and Utility Operators

| Op | Args | Meaning |
|----|------|---------|
| `var` | name | Read a runtime variable. The name MUST use dot-separated paths (e.g., `context.email`, `event.value`). |
| `get` | object, key | Property access on an object value. |
| `coalesce` | a, b | Return `a` if non-null, otherwise `b`. |
| `if` | cond, then, else | Conditional. |
| `min` | a, b | Minimum of two values. |
| `max` | a, b | Maximum of two values. |
| `clamp` | value, min, max | Clamp value to range. |
| `lerp` | a, b, t | Linear interpolation. |
| `round` | value | Round to nearest integer. |
| `floor` | value | Round down. |
| `ceil` | value | Round up. |

Example:

```json
["&&",
  ["!=", ["var", "context.action"], null],
  ["==", ["var", "context.submitting"], false]
]
```

Literals (numbers, strings, booleans, `null`) are passed through as-is.

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
