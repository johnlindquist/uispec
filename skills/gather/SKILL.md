# Gather: Design Context and Requirements

Establish who this spec is for, what it needs to do, and how it should feel — before writing any JSON.

## When to Use

Before starting any new `.uxspec.json` file. Context cannot be inferred from code — only the creator knows the audience, intent, and tone.

## Questions

### Structural Requirements
1. **What is this?** Name the component or page. ("login form", "media player", "checkout flow")
2. **What states exist?** List the key modes. ("idle, loading, error, success")
3. **What events drive changes?** Name the triggers. ("SUBMIT, INPUT_CHANGED, HTTP_OK")
4. **What data does it track?** Name the context fields. ("email: string, error: string | null")
5. **Any reusable pieces?** Elements that repeat across states. ("labeled input, action button")

### Design Context
6. **Who uses this, and where?** Device, expertise, emotional state. ("first-time user on mobile mid-signup" is very different from "admin on desktop managing a queue")
7. **Brand personality in three words.** ("professional and calm", "playful and bold", "minimal and precise") — this shapes every token and description choice downstream.
8. **Reference sites or anti-references?** Things to emulate or explicitly avoid.

### UX Intent
9. **Is this a first-time experience?** If yes, what's the "aha moment"? Design for progressive disclosure — teach features when encountered, not upfront.
10. **One primary action per state.** If a state has two competing actions, it's probably two states. What's the single thing the user should do in each?
11. **Copy tone.** Errors should explain and suggest, never blame. Empty states should invite, not apologize. Loading states should set expectations. Match the brand personality from question 7.

## Output

A bullet-list summary covering all 11 answers. Get user confirmation before moving to state machine design. This summary becomes the foundation every other skill builds on.

## Principle

Every design decision in a UXSpec traces back to context. A login form for a bank and a login form for a game share structure but share nothing else. Capture the difference here so tokens, visuals, and copy reflect it throughout.
