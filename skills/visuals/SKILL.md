# Visuals: State Visual Specifications

Write the `$visual` blocks that define what each state looks like — layout, elements, descriptions, and test hooks.

## When to Use

When adding `$visual` to leaf states, writing `$description` fields, or defining `$elements` for reuse.

## $description — Capture Intent, Not Structure

The `$description` is what a human reads in a PR review and what an agent uses to generate an implementation. It must convey design intent.

**Bad:** "Shows a form with inputs"
**Good:** "Login form with generous vertical spacing. Email and password fields stacked with labels above each. A prominent blue sign-in button spans full width below the fields. A subtle 'Forgot password?' link sits right-aligned beneath the button."

**Bad:** "Error state"
**Good:** "A red-tinted banner appears above the form with an alert icon and the error message. The form fields remain visible and editable. The submit button returns to its default state with a 'Try again' label."

Include: layout direction, spacing character, emphasis/hierarchy, color intent, element placement, interactive affordances.

## Layout Decisions

### Container
Every `$visual` has a `container` that sets the layout frame:
- **`stack-v`** — vertical stack. Default for forms, lists, card content.
- **`stack-h`** — horizontal stack. For toolbars, button groups, inline fields.
- **`grid`** — 2D grid. For dashboards, galleries, responsive layouts.
- **`layer`** — Z-axis stacking. For overlays, floating elements, badges on cards.

Set `padding`, `gap`, `background`, and `borderRadius` via token references.

### Slots
Slots are named regions within the container. Use semantic names:
- `header`, `body`, `footer` — for page-level layouts
- `icon`, `label`, `action` — for component-level slots
- `primary`, `secondary` — for emphasis hierarchy

### Don't
- Wrap everything in cards. Use spacing and type hierarchy instead.
- Nest cards inside cards. If you need grouping, use a `group` with spacing.
- Center everything. Left-align body text and form fields. Center only headings and single-line CTAs when appropriate.
- Default to identical grid layouts. Vary element sizes and spans for visual interest.

## Reusable Elements (`$elements`)

Extract when a pattern appears in 2+ states:
```json
"$elements": {
  "form-input": {
    "type": "group",
    "layout": "stack-v",
    "gap": "{spacing.xs}",
    "params": ["label", "name", "inputType"],
    "children": [
      { "type": "text", "content": { "$bind": "label" } },
      { "type": "input", "name": { "$bind": "name" }, "binding": { "inputType": { "$bind": "inputType" } } }
    ]
  }
}
```

Reference with: `{ "$ref": "form-input", "label": "Email", "name": "email", "inputType": "email" }`

Only extract what's reused now. Premature abstraction creates dead elements.

## Test Hooks and Accessibility

- **`testId`** on every interactive element. These compile to assertions. Name them descriptively: `"submit-btn"`, `"email-input"`, `"error-banner"`.
- **`aria.label`** on elements where the visual content isn't self-describing: icon buttons, abstract shapes, dynamic content.
- **`aria.live`** on regions that update dynamically: error messages (`"assertive"`), status updates (`"polite"`).

## Interaction States

Define hover, focus, and disabled appearances via `interactions`:
```json
"interactions": {
  "hover": { "background": "{color.accentHover}" },
  "focus": { "outlineWidth": { "value": 2, "unit": "px" }, "outlineColor": "{color.focusRing}" },
  "disabled": { "opacity": 0.5 }
}
```

Every interactive element needs a visible focus state. Users navigating by keyboard must always know where they are.

## Principle

A `$visual` is a contract between designer and implementer. It should be specific enough that two different agents, reading the same `$visual`, produce implementations that look substantially the same.
