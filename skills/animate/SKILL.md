# Animate: Motion and Transitions

Add purposeful motion to a UXSpec — `$animations`, `onEnter` choreography, and timing tokens. Motion should communicate, not decorate.

## When to Use

When a spec feels static or abrupt. When state transitions need smoothing. When the user asks for animation, micro-interactions, or polish.

## Where Motion Adds Value

1. **State transitions** — entering/exiting a state should feel intentional, not instant. A form appearing, a loading spinner replacing a button, an error banner sliding in.
2. **Feedback** — button presses, toggle switches, form submissions. The user did something; acknowledge it.
3. **Spatial relationships** — where did this element come from? Where did it go? Motion answers these questions.
4. **Hierarchy** — staggered reveals communicate reading order. The first thing to animate is the first thing to notice.

## Timing Reference

| Category | Duration | Use for |
|----------|----------|---------|
| Instant feedback | 100–150ms | Button press, toggle, selection change |
| State change | 200–300ms | Hover effect, menu open/close, tab switch |
| Layout shift | 300–500ms | Accordion, modal, drawer, page transition |
| Entrance | 500–800ms | Initial page load, hero reveal |
| Exit | ~75% of entrance | Things should leave faster than they arrive |

Define these as `$tokens.timing` values so they're consistent across the spec.

## Easing

- **Use:** `ease-out-quart`, `ease-out-expo` — natural deceleration, things arrive smoothly.
- **Avoid:** `bounce`, `elastic` — feel dated and gimmicky. `linear` — feels mechanical.
- **Exits:** Use `ease-in` or `ease-in-out` — things accelerate away.

## `$animations` Block

Named keyframe definitions referenced from `$visual.onEnter`:

```json
"$animations": {
  "slide-up": {
    "$description": "Content slides up and fades in on state entry",
    "duration": "{timing.entrance}",
    "easing": "ease-out",
    "keyframes": {
      "0":   { "opacity": 0, "translateY": 16 },
      "100": { "opacity": 1, "translateY": 0 }
    }
  }
}
```

## `onEnter` Choreography

Each `$visual` can specify what happens when the state is entered:

```json
"onEnter": {
  "focus": "email-input",
  "animation": "slide-up"
}
```

**Decisions:**
- **One hero moment per state.** Don't animate everything. Pick the most important element or the container itself.
- **Stagger reveals** for lists or multi-element layouts: 50–100ms delay between items. More than 5 items? Animate the container, not each item.
- **Focus and animation together.** If a state entry moves focus, the animation should guide the eye to the focus target.

## Reduced Motion

Always design a reduced-motion alternative. This isn't optional.

- Replace slide/scale animations with simple opacity fades or instant transitions.
- Keep functional motion (focus movement, scroll-to) but remove decorative motion.
- Note the alternative in `$description`: "On reduced motion: content appears instantly with no slide."

## Anti-patterns

- Animating every state transition the same way — motion becomes noise
- Durations > 500ms for feedback — user waits for the UI to catch up
- Entrance animations that block interaction — never make the user wait to click
- Motion without purpose — if removing the animation changes nothing about comprehension, remove it
- Forgetting exit animations — abrupt disappearance after smooth entrance feels broken

## Principle

Motion in a UXSpec is metadata, not decoration. It tells the implementer *how* a state change should feel. A spec without motion isn't wrong — but a spec with thoughtful motion communicates more clearly what the designer intended.
