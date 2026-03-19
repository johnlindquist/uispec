# Minimal UXSpec Example

A complete, minimal spec for a simple counter component. Use as a starting template.

```json
{
  "$schema": "https://uxspec.dev/0.2/schema.json",
  "$description": "Simple counter — increment and decrement buttons with a display. Minimal example demonstrating core UXSpec patterns.",

  "$tokens": {
    "color": {
      "bg":      { "$type": "color", "$value": "#111111" },
      "surface": { "$type": "color", "$value": "#1a1a1a" },
      "text":    { "$type": "color", "$value": "#ffffff" },
      "accent":  { "$type": "color", "$value": "#0070f3" }
    },
    "spacing": {
      "sm": { "$type": "dimension", "$value": { "value": 8, "unit": "px" } },
      "md": { "$type": "dimension", "$value": { "value": 16, "unit": "px" } }
    },
    "radius": {
      "md": { "$type": "dimension", "$value": { "value": 8, "unit": "px" } }
    },
    "font": {
      "size": {
        "base": { "$type": "dimension", "$value": { "value": 14, "unit": "px" } },
        "xl":   { "$type": "dimension", "$value": { "value": 24, "unit": "px" } }
      }
    }
  },

  "$context": {
    "count": { "type": "number", "default": 0, "$description": "Current counter value" }
  },

  "$events": {
    "INCREMENT": { "source": "user", "payload": {} },
    "DECREMENT": { "source": "user", "payload": {} },
    "RESET":     { "source": "user", "payload": {} }
  },

  "$machine": {
    "id": "counter",
    "initial": "active",
    "states": {
      "active": {
        "on": {
          "INCREMENT": {
            "target": "active",
            "actions": [{ "kind": "assign", "path": "context.count", "value": ["+", ["var", "context.count"], 1] }]
          },
          "DECREMENT": {
            "target": "active",
            "actions": [{ "kind": "assign", "path": "context.count", "value": ["-", ["var", "context.count"], 1] }]
          },
          "RESET": {
            "target": "active",
            "actions": [{ "kind": "assign", "path": "context.count", "value": 0 }]
          }
        },
        "$visual": {
          "$description": "Counter display with increment, decrement, and reset buttons",
          "container": {
            "layout": "stack-v",
            "padding": "{spacing.md}",
            "gap": "{spacing.md}",
            "background": "{color.surface}",
            "borderRadius": "{radius.md}",
            "alignItems": "center"
          },
          "slots": {
            "display": [
              {
                "type": "text",
                "name": "count-display",
                "binding": { "content": ["var", "context.count"] },
                "fontSize": "{font.size.xl}",
                "color": "{color.text}",
                "testId": "count-display"
              }
            ],
            "controls": [
              {
                "type": "group",
                "layout": "stack-h",
                "gap": "{spacing.sm}",
                "children": [
                  {
                    "type": "button",
                    "name": "decrement",
                    "content": "-",
                    "onPress": [{ "kind": "emit", "event": "DECREMENT" }],
                    "background": "{color.accent}",
                    "testId": "decrement-btn"
                  },
                  {
                    "type": "button",
                    "name": "reset",
                    "content": "Reset",
                    "onPress": [{ "kind": "emit", "event": "RESET" }],
                    "testId": "reset-btn"
                  },
                  {
                    "type": "button",
                    "name": "increment",
                    "content": "+",
                    "onPress": [{ "kind": "emit", "event": "INCREMENT" }],
                    "background": "{color.accent}",
                    "testId": "increment-btn"
                  }
                ]
              }
            ]
          }
        }
      }
    }
  }
}
```

## Compile and Verify

```bash
bun run src/compiler/cli.ts validate examples/counter.uxspec.json
bun run src/compiler/cli.ts compile examples/counter.uxspec.json
bun run src/compiler/cli.ts inspect examples/counter.uxspec.json
```

Expected output:
- `ok: true`
- 1 state, 4 assertions (count-display, decrement-btn, reset-btn, increment-btn)
- `leafInitial: true`
- 0 unresolved refs, 0 unresolved token aliases
