# Tokens: Design Token System

Define the `$tokens` that give a spec its visual identity — color, typography, spacing, timing. Tokens are the vocabulary every `$visual` speaks.

## When to Use

When creating or revising `$tokens`. Also when visuals feel inconsistent — inconsistency usually means a missing or unused token.

## Token Categories

### Typography
- **Font choice:** Match the brand personality from the gather phase. Avoid invisible defaults (Inter, Roboto, system-ui) unless the brand genuinely calls for neutrality.
- **Type scale:** Use a consistent ratio (1.2 minor third, 1.25 major second, 1.333 perfect fourth) across 5 sizes: `caption`, `secondary`, `body`, `heading`, `display`. Never use arbitrary sizes.
- **Weight roles:** 3–4 weights max, each with a clear job: regular for body, medium for labels, semibold for headings, bold for emphasis.
- **Readability:** Body at 16px minimum. Line height 1.5–1.7 for body, tighter (1.2–1.3) for headings.

### Color
- **Palette:** 2–4 hues beyond neutrals. Distribute as 60% dominant, 30% secondary, 10% accent.
- **Semantic colors:** Consistent meanings throughout — `success`, `error`, `warning`, `info`. Name tokens by role, not by hue (`color.error`, not `color.red`).
- **Contrast:** Text must meet WCAG 4.5:1 minimum against its background. Large text (18px+ bold, 24px+ regular) may use 3:1.
- **Tinted neutrals:** Tint grays toward the brand hue for cohesion. Pure gray (#888) next to a warm brand color feels dead.
- **Dark mode:** If needed, define a separate surface/text token set. Don't just invert — dark surfaces need lighter tints, not the same palette reversed.

### Spacing
- **Scale:** Use a consistent system: 4, 8, 12, 16, 24, 32, 48, 64. Name them `xs` through `3xl` or similar.
- **Roles:** `gap` for between siblings, `padding` for container insets, `margin` for section separation. Consistent scale, different applications.
- **Rhythm:** Tight spacing (8–12px) groups related elements. Generous spacing (32–64px) separates sections. The variation creates visual hierarchy without needing borders or cards.

### Timing
- **Feedback:** 100–150ms for button press, toggle, selection.
- **Transition:** 200–300ms for hover states, menu open/close, tab switch.
- **Layout:** 300–500ms for accordion, modal, page transition.
- **Exit:** ~75% of entrance duration. Things should leave faster than they arrive.

### Radius
- **Consistency:** Pick 2–3 values (e.g., `sm: 4px`, `md: 8px`, `lg: 16px`). Use `md` as default, `sm` for small controls, `lg` for cards/modals.
- **Intent:** Sharp corners feel precise and technical. Rounded corners feel friendly and approachable. Match the brand.

## Anti-patterns
- Hard-coded values in `$visual` instead of token references
- Tokens defined but never referenced (dead tokens)
- Near-duplicate tokens (`spacing.15` and `spacing.16`) — pick one
- Naming by appearance (`color.blue`) instead of role (`color.primary`)
- Defining tokens you don't need yet — add them when a visual requires them

## Principle

Tokens are the single source of truth for visual consistency. If two elements should look the same, they should reference the same token. If they look different, the reason should be a different token — not a hard-coded override.
