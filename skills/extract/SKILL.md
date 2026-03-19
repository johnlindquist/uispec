# Extract: Reusable Elements and Patterns

Identify repeated patterns in a spec and consolidate them into `$elements` and shared tokens. Systematic reuse, not premature abstraction.

## When to Use

After visuals are defined and you notice repetition across states. When multiple states share similar elements (form fields, action buttons, status banners). When the spec has grown and consistency is drifting.

## What to Extract

### Elements (`$elements`)
Look for patterns that appear in 2+ states with the same structure but different content:

**Before:**
```json
"idle": {
  "$visual": {
    "slots": {
      "body": [
        { "type": "group", "layout": "stack-v", "gap": "{spacing.xs}", "children": [
          { "type": "text", "content": "Email" },
          { "type": "input", "name": "email", "binding": { "inputType": "email" } }
        ]},
        { "type": "group", "layout": "stack-v", "gap": "{spacing.xs}", "children": [
          { "type": "text", "content": "Password" },
          { "type": "input", "name": "password", "binding": { "inputType": "password" } }
        ]}
      ]
    }
  }
}
```

**After:**
```json
"$elements": {
  "form-field": {
    "type": "group", "layout": "stack-v", "gap": "{spacing.xs}",
    "params": ["label", "name", "inputType"],
    "children": [
      { "type": "text", "content": { "$bind": "label" } },
      { "type": "input", "name": { "$bind": "name" }, "binding": { "inputType": { "$bind": "inputType" } } }
    ]
  }
}
```

Referenced as: `{ "$ref": "form-field", "label": "Email", "name": "email", "inputType": "email" }`

### Tokens
Look for hard-coded values that should be tokens:
- A color hex appearing in multiple visuals → extract to `$tokens.color`
- A spacing value used inconsistently → standardize as a token
- A font size repeated but not from the scale → add to `$tokens.font.size`

### Patterns to Watch For
- **Status banners** — error, warning, success, info variants of the same layout. Extract a `status-banner` element with `variant` and `message` params.
- **Action buttons** — primary, secondary, destructive variants. Extract with `variant`, `label`, `action` params.
- **List items** — repeated row structures with icon + text + action. Extract the row, let states supply content.
- **Empty states** — illustration + message + CTA pattern appears everywhere. Extract it.

## When NOT to Extract

- **Used once.** A pattern appearing in only one state doesn't need extraction. Wait until it repeats.
- **Speculative reuse.** Don't extract because something "might" be reused later. Extract when it IS reused.
- **Fundamentally different.** Two elements that look similar but serve different purposes (a nav button vs a form submit) should stay separate — they'll diverge.

## Verification

After extraction:
- Compile the spec. `UNKNOWN_ELEMENT_REFERENCE` means a `$ref` name is wrong.
- Check that every `$ref` passes the right params.
- Verify the compiled output is unchanged — extraction should be invisible to the implementation.

## Principle

Extract for consistency, not for abstraction. Three similar lines of spec are better than a premature `$element` that only one state uses. But three states with identical form-field patterns? That's a missing element.
