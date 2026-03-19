# UXSpec Format Reference

## Token Syntax (W3C Design Tokens)

Tokens use `$type` and `$value`. Reference with `"{path.to.token}"`.

```json
"$tokens": {
  "color": {
    "primary":   { "$type": "color", "$value": "#0070f3" },
    "error":     { "$type": "color", "$value": "#ee5555" }
  },
  "spacing": {
    "sm": { "$type": "dimension", "$value": { "value": 8, "unit": "px" } },
    "md": { "$type": "dimension", "$value": { "value": 16, "unit": "px" } }
  },
  "radius": {
    "md": { "$type": "dimension", "$value": { "value": 8, "unit": "px" } }
  },
  "font": {
    "family": { "$type": "fontFamily", "$value": ["Inter", "system-ui", "sans-serif"] },
    "size": {
      "base": { "$type": "dimension", "$value": { "value": 14, "unit": "px" } }
    },
    "weight": {
      "medium": { "$type": "number", "$value": 500 }
    }
  },
  "timing": {
    "normal": { "$type": "duration", "$value": { "value": 250, "unit": "ms" } }
  }
}
```

## Element Types

### Containers (MAY have `children`)
- `group` — generic layout container
- `layer` — Z-axis stacking (ZStack)
- `grid` — grid layout
- `stack-h` — horizontal stack (HStack / Row)
- `stack-v` — vertical stack (VStack / Column)

### Leaves (MUST NOT have `children`)
- `text` — styled text, use `content` for the string
- `input` — text input, use `binding.inputType` for type
- `button` — interactive, use `onPress` for actions
- `icon` — named icon with `size` and `color`
- `shape` — primitive shape (circle, rectangle)
- `badge` — small status indicator
- `bar` — data-driven bar

## Reusable Elements (`$elements`)

```json
"$elements": {
  "form-input": {
    "type": "group",
    "layout": "stack-v",
    "gap": "{spacing.xs}",
    "params": ["label", "name", "inputType"],
    "children": [
      { "type": "text", "content": { "$bind": "label" }, "fontSize": "{font.size.sm}" },
      { "type": "input", "name": { "$bind": "name" }, "binding": { "inputType": { "$bind": "inputType" } } }
    ]
  }
}
```

Reference with: `{ "$ref": "form-input", "label": "Email", "name": "email", "inputType": "email" }`

## Visual Structure (`$visual`)

```json
"$visual": {
  "$description": "What this state looks like",
  "container": {
    "layout": "stack-v",
    "padding": "{spacing.lg}",
    "gap": "{spacing.md}",
    "background": "{color.surface}",
    "borderRadius": "{radius.md}"
  },
  "slots": {
    "header": [
      { "type": "text", "content": "Title", "fontSize": "{font.size.lg}" }
    ],
    "body": [
      { "type": "input", "name": "email", "testId": "email-input" },
      { "type": "button", "name": "submit", "content": "Submit", "testId": "submit-btn" }
    ]
  },
  "onEnter": { "focus": "email", "animation": "page-enter" },
  "keyboard": { "Enter": "SUBMIT" }
}
```

## Animations (`$animations`)

```json
"$animations": {
  "fade-in": {
    "$description": "Fade in on entry",
    "duration": "{timing.normal}",
    "easing": "ease-out",
    "keyframes": {
      "0":   { "opacity": 0 },
      "100": { "opacity": 1 }
    }
  }
}
```

## Interaction States

```json
"interactions": {
  "hover": { "background": "{color.accentHover}" },
  "focus": { "outlineWidth": { "value": 2, "unit": "px" }, "outlineColor": "rgba(0, 112, 243, 0.3)" },
  "disabled": { "opacity": 0.5 }
}
```

## Slot Inheritance

Child states inherit parent `$visual` slots. A child only needs to declare slots that change. If a child defines `slots`, it fully replaces the parent's slots.
