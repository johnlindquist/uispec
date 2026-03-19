---
name: uxspec
description: Walk through building a UXSpec (.uxspec.json) file — gathering requirements, making design decisions about layout/typography/color/motion/accessibility, designing the state machine, defining visuals, then compiling and verifying the output.
---

# UXSpec Builder

Interactive workflow for creating UXSpec files — the JSON format that unifies state machines and visual specifications for AI agents. Each phase prompts for real design decisions so specs capture intentional UI/UX, not just structure.

## Trigger

Use when the user wants to create, build, or scaffold a `.uxspec.json` file, or asks "help me write a uxspec".

## Workflow

Follow these phases in order. Each phase produces a concrete artifact before moving on.

### Phase 1 — Gather Requirements

Ask the user:
1. **What is this component/page?** (e.g., "login form", "toast notifications", "media player")
2. **What are the key states?** (e.g., "idle, loading, error, success")
3. **What events drive transitions?** (e.g., "SUBMIT, INPUT_CHANGED, HTTP_OK, HTTP_ERROR")
4. **What context data is needed?** (e.g., "email: string, password: string, error: string | null")
5. **Any reusable elements?** (e.g., "input field with label, action button")

Then ask design context questions — these cannot be inferred from code:
6. **Who uses this and in what context?** (e.g., "developers on desktop", "shoppers on mobile mid-checkout")
7. **What's the brand personality?** (e.g., "professional and calm", "playful and bold", "minimal and precise")
8. **Any reference sites or anti-references?** (things to emulate or avoid)

Finally, prompt for UX intent:
9. **Is this a first-time experience?** If so, what's the "aha moment" users need to reach? Design for progressive disclosure — teach features as encountered, don't front-load.
10. **What's the primary action per state?** Each state should have ONE clear thing the user can do. If there are multiple, consider splitting states.
11. **What copy tone fits the context?** Error messages should explain what happened and suggest a fix without blame. Empty states should describe what will appear and offer a clear CTA. Loading states should set duration expectations.

Summarize back to the user as a bullet list before proceeding.

### Phase 2 — Design the State Machine

Build the `$machine` section:
- Define compound states (parents) and leaf states (children)
- Every compound state needs an `initial` child
- Map events to transitions with optional guards and actions
- Add `entry`/`exit` actions where needed (e.g., set loading flag, clear errors)
- Add `invoke` for long-running effects (HTTP calls, timers)

**Simplify aggressively:** For each state, ask — is this truly necessary, or can it be combined with another? Look for the 20% of states delivering 80% of value. Remove obstacles between users and their goals.

**Cover all state types:** Ensure the machine accounts for:
- **Empty states** — no data yet, no results, first-time use
- **Loading states** — initial load, pagination, refresh
- **Error states** — network failure, validation, permissions, rate limiting
- **Success states** — confirmation, next steps, celebration moments
- **Edge cases** — offline, concurrent operations, expired sessions

Present the state graph as a text diagram:

```
idle --SUBMIT--> loading
loading --HTTP_OK--> success
loading --HTTP_ERROR--> error
error --RETRY--> loading
```

### Phase 3 — Define Tokens and Visuals

1. Define `$tokens` — colors, spacing, radius, font, timing (follow W3C Design Tokens format)
2. Define `$elements` — reusable element templates with `params`
3. Add `$visual` to each leaf state — container layout, slots with elements
4. Add `testId` to interactive elements for assertions
5. Add `aria` labels for accessibility

Read `references/format-reference.md` for token syntax, element types, and visual structure.

**When defining tokens and visuals, prompt for these design decisions:**

#### Typography
- **Font choice:** Pick fonts that match the brand personality. Avoid invisible defaults (Inter, Roboto, system-ui) unless the brand calls for it.
- **Type scale:** Use a consistent ratio (e.g., 1.25) across 5 sizes: caption, secondary, body, heading, display. Don't use arbitrary sizes.
- **Hierarchy:** Establish hierarchy through multiple dimensions — size + weight + color + spacing — not size alone.
- **Readability:** Body text at 16px minimum. Line length 45–75 characters. Line height 1.5–1.7 for body copy.

#### Color
- **Palette:** 2–4 colors beyond neutrals. Distribute as 60% dominant, 30% secondary, 10% accent.
- **Semantic meaning:** Assign consistent meanings — success (green), error (red), warning (amber), info (blue).
- **Contrast:** Text must meet WCAG 4.5:1 minimum. Don't rely on color alone to convey information.
- **Tinted neutrals:** Tint grays toward the brand hue for subconscious cohesion.

#### Layout & Spacing
- **Spacing system:** Use a consistent scale (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px). Never use arbitrary values.
- **Visual rhythm:** Tight grouping for related items, generous separation between distinct sections. Varied spacing creates rhythm.
- **Hierarchy through space:** Whitespace communicates structure. More space = more separation = higher importance.
- **Container strategy:** Don't default to wrapping everything in cards. Use spacing and typography to create grouping. Cards inside cards is always wrong.

#### Visual Descriptions
Write `$description` fields that capture design intent, not just structure:
- Bad: "Shows a form with inputs"
- Good: "Login form with generous spacing, email and password fields stacked vertically, prominent sign-in button below. Error state shows a red banner above the form with a retry suggestion."

### Phase 4 — Add Runtime Semantics

1. Define `$context` — typed fields with defaults
2. Define `$events` — with source and payload types
3. Define `$actions` — assign, emit, log
4. Define `$effects` — http, timer, navigate, focus
5. Wire `binding`, `visibleWhen`, `enabledWhen`, `onPress`, `onChange` on elements

Read `references/runtime-semantics.md` for expression syntax and action/effect kinds.

**When wiring interactions, prompt for these design decisions:**

#### Motion & Animation
- **Where is feedback needed?** Button presses, form submissions, toggle switches, and state changes all benefit from visual acknowledgment.
- **Timing:** 100–150ms for instant feedback (button press). 200–300ms for state changes (hover, menu). 300–500ms for layout changes (accordion, modal). Exit animations ~75% of entrance duration.
- **Easing:** Use deceleration curves (ease-out-quart, ease-out-expo). Avoid bounce and elastic — they feel dated.
- **Reduced motion:** Always respect `prefers-reduced-motion`. Provide a meaningful alternative (instant transition, opacity-only fade).
- **Entrance choreography:** Stagger reveals with 50–100ms delays. Don't animate everything — pick one hero moment per view.

#### Interaction Resilience
- **Text overflow:** How should long content behave? Truncate with ellipsis, multi-line clamp, or allow wrapping?
- **Internationalization:** Budget 30–40% extra space for translations. Use logical properties for RTL support.
- **Error handling:** Network errors need a clear message + retry button. Form validation should be inline, near the field, with specific suggestions. Never blame the user.
- **Loading states:** Show what's loading and set time expectations. Use skeleton screens over spinners where possible.
- **Touch targets:** 44x44px minimum for any interactive element.
- **Keyboard navigation:** All functionality must be accessible via keyboard. Define logical tab order and focus management.

#### Responsive Adaptation
- **Mobile (if applicable):** Single column, bottom-anchored navigation, 44px touch targets, no hover-dependent interactions, thumb-reachable primary actions.
- **Content priority:** What gets hidden or deferred on smaller screens? Use progressive disclosure, not `display: none` on important content.

#### Personality & Delight
- **Success moments:** What happens when the user completes the primary action? A subtle animation, encouraging copy, or next-step guidance makes the difference.
- **Empty states:** These are onboarding opportunities. Describe what will appear, explain the value, and offer a clear action.
- **Error tone:** Match the brand. A bank says "We couldn't process your request. Please try again." A creative tool says "Something went sideways — let's try that again."

### Phase 5 — Generate and Verify

1. Write the spec to `examples/<name>.uxspec.json`
2. Validate: `bun run src/compiler/cli.ts validate examples/<name>.uxspec.json`
3. If validation fails, fix reported issues (the compiler returns structured issue codes)
4. Compile: `bun run src/compiler/cli.ts compile examples/<name>.uxspec.json`
5. Inspect: `bun run src/compiler/cli.ts inspect examples/<name>.uxspec.json`
6. Report to the user:
   - Number of states and assertions
   - Whether initial resolves to a leaf state
   - Any unresolved refs or token aliases
   - The compiled output path

**After compilation succeeds, run a design quality review:**

- **AI slop test:** If you showed this spec to someone and said "AI made this," would they believe you immediately? Check for: generic font choices, purple-to-blue gradients, glassmorphism, cards-inside-cards, centered-everything layouts, gradient text, hero-metrics-with-sparklines. If any are present, fix them.
- **Hierarchy check (squint test):** Blur your vision. Can you still identify the primary action, secondary content, and groupings? If everything looks the same, spacing and weight need work.
- **State coverage:** Does every state have a visual? Are empty, loading, error, and success states covered with helpful descriptions and clear next actions?
- **Copy review:** Is every label, error message, and description specific and helpful? Replace generic text ("An error occurred") with actionable copy ("We couldn't reach the server — check your connection and try again").
- **Accessibility pass:** Do all interactive elements have `aria` labels? Is contrast sufficient? Are touch targets large enough? Is keyboard navigation defined?
- **Consistency:** Are tokens used consistently? Are similar elements using the same spacing, typography, and color tokens? Inconsistency usually means a missing token.

### Issue Resolution

If the compiler reports issues, map codes to fixes:

| Code | Fix |
|------|-----|
| `UNDECLARED_CONTEXT_VAR` | Add missing field to `$context` |
| `UNDECLARED_EVENT` | Add missing event to `$events` |
| `UNDECLARED_TARGET` | Fix transition target to match a valid state path |
| `UNSUPPORTED_EXPR_OP` | Replace with a supported operator (see spec) |
| `INVALID_ASSIGN_PATH` | Ensure path starts with `context.` |
| `UNKNOWN_TOKEN_REFERENCE` | Add missing token to `$tokens` or fix the path |
| `UNKNOWN_ELEMENT_REFERENCE` | Add missing element to `$elements` or fix the name |
| `INVALID_MACHINE_INITIAL` | Set `$machine.initial` to a valid top-level state |
| `INVALID_COMPOUND_INITIAL` | Set compound state `initial` to a valid child name |

## Key Rules

- File extension: `.uxspec.json`
- Schema: `https://raw.githubusercontent.com/johnlindquist/uxspec/main/schema/uxspec.schema.json`
- Required top-level: `$schema`, `$description`, `$machine`
- `$machine` requires: `id`, `initial`, `states`
- Leaf elements (`text`, `button`, `input`, `icon`, `shape`, `badge`, `bar`) MUST NOT have `children`
- Container elements (`group`, `layer`, `grid`, `stack-h`, `stack-v`) MAY have `children`
- Token references: `"{path.to.token}"` — curly braces inside a string
- Element references: `{ "$ref": "name", ...params }`
- Expressions: S-expression arrays like `["==", ["var", "context.x"], true]`
- All `$`-prefixed properties are reserved

## Reference Files

- `references/format-reference.md` — Token syntax, element types, visual structure, layout primitives
- `references/runtime-semantics.md` — Context, events, actions, effects, expressions, transitions
- `references/minimal-example.md` — Complete minimal spec you can use as a starting template
