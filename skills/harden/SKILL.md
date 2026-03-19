# Harden: Edge Cases and Resilience

Strengthen a UXSpec against real-world conditions — long text, missing data, network failures, diverse devices, keyboard navigation. Specs that only work with perfect data aren't specs.

## When to Use

After the happy path is designed. When preparing a spec for production. When reviewing a spec and asking "what could go wrong?"

## Text and Content

- **Overflow:** Every text element needs a strategy. Will it truncate with ellipsis? Clamp to N lines? Wrap freely? Define this in the `$visual` or `$description`.
- **Translation budget:** If the product may be localized, budget 30–40% extra space in layouts. German and French are notably longer than English.
- **Dynamic content:** If content comes from context or user input, test the visual mentally with: empty string, single word, 200 characters, special characters, emoji, RTL text.

## Error States

Every async operation needs an error path. For each, define:
- **What the user sees** — a specific message, not a generic banner
- **What they can do** — retry button, alternative action, or navigation away
- **What persists** — form data should survive errors; don't clear inputs on failure

Error categories need different handling:
| Error type | UXSpec approach |
|------------|----------------|
| Network/timeout | Show message + retry button. Preserve form state. |
| Validation | Inline per-field errors near the relevant input. Specific fix suggestion. |
| Permission | Explain what's needed and how to get it. Don't just say "forbidden." |
| Rate limiting | Show wait time. Disable the action with a visible countdown. |
| Not found | Explain what was expected. Offer search or navigation home. |

## Loading States

Not all loading is the same:
- **Initial load** — skeleton screens or progress indicators. Set expectations ("Loading your dashboard...").
- **Action loading** — replace the triggering button with a spinner. Disable other actions. Maintain layout.
- **Background refresh** — subtle indicator (pulsing dot, timestamp update). Don't disrupt the user.
- **Pagination** — loading indicator at the bottom. Don't remove existing content.

## Input and Interaction

- **Touch targets:** 44x44px minimum for any interactive element. Check buttons, links, icons, checkboxes.
- **Keyboard navigation:** Every interactive element must be reachable via Tab. Define `keyboard` bindings in `$visual` for shortcuts. Every focusable element needs a visible focus state.
- **Double submission:** Disable submit buttons during async operations. Use `enabledWhen` tied to a loading flag.
- **Empty collections:** When a list/grid has zero items, show an empty state with explanation and action — never a blank space.

## Accessibility

- **`aria.label`** on icon buttons, abstract shapes, and any element where visual content isn't self-describing
- **`aria.live`** on dynamically updating regions: `"assertive"` for errors, `"polite"` for status updates
- **Color independence:** Don't rely on color alone. Pair red error text with an icon or border.
- **Contrast:** Token-referenced colors should maintain WCAG 4.5:1 against their backgrounds. Note this in `$description` if a specific combination is intentional.

## Responsive Considerations

If the spec targets multiple screen sizes, note adaptation in `$description`:
- Which elements reflow or stack on smaller screens?
- What hides or collapses?
- Do touch targets increase on mobile?
- Does navigation change (e.g., tabs → bottom nav)?

## Anti-patterns

- Designing only for the happy path with perfect data
- Generic error messages ("Something went wrong") without recovery options
- Clearing form data on error — the user just typed all that
- Assuming all users have fast connections and modern devices
- Missing focus management after state changes (focus gets lost in the DOM)
- Empty states that are literally empty — no message, no action

## Principle

A hardened spec doesn't assume ideal conditions. It explicitly handles what happens when text is too long, the network fails, the user navigates by keyboard, and data arrives empty. These aren't edge cases — they're Tuesday.
