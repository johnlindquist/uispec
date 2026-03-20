---
name: clarify
description: Improve every piece of text in a UXSpec — descriptions, labels, error messages, empty states, and loading copy
---

# Clarify: Copy and Descriptions

Improve every piece of text in a UXSpec — `$description` fields, button labels, error messages, empty state copy, loading text. Words are design.

## When to Use

When reviewing a spec's text content. When `$description` fields are vague. When error states say "An error occurred." When empty states are blank.

## $description Fields

These are the most-read part of a spec — they appear in PR reviews, agent prompts, and design handoffs. Write them like you're briefing someone who will build the UI without seeing a mockup.

**Include:** layout direction, spacing character, element hierarchy, color intent, emphasis, interactive affordances.

- "Error state" → "A red-tinted banner appears above the form with an alert icon and the specific error message. The form remains editable. The submit button shows 'Try again' in its default style."
- "Loading" → "The submit button is replaced by a centered spinner with 'Signing in...' text. All form fields are visible but disabled. The form maintains its layout to prevent content shift."

## Content Types

### Error Messages
Explain what happened. Suggest a fix. Never blame.
- Bad: "Error 403: Forbidden"
- Good: "You don't have access to this resource. Contact your admin to request permission."
- Bad: "Invalid input"
- Good: "Email must include an @ symbol (e.g., name@example.com)"

### Empty States
These are opportunities, not dead ends. Describe what will appear. Explain the value. Offer a clear action.
- Bad: "No items"
- Good: "No projects yet. Create your first project to start tracking tasks."

### Button Labels
Describe the action specifically. Active voice. Match the user's mental model.
- Bad: "Submit", "Click here", "OK"
- Good: "Create account", "Save changes", "Send invitation"

### Loading States
Set expectations. Explain what's happening.
- Bad: "Loading..."
- Good: "Checking your credentials..." or "Fetching latest data..."

### Success States
Confirm what happened. Guide to next steps.
- Bad: "Success!"
- Good: "Account created. Check your email to verify your address."

### Confirmation Dialogs
State the specific action. Explain consequences.
- Bad: "Are you sure?"
- Good: "Delete 'Project Alpha'? This removes all tasks and cannot be undone."

## Copy Tone

Match the brand personality established in the gather phase:
- **Professional:** "We couldn't process your request. Please try again."
- **Friendly:** "Something went sideways — let's try that again."
- **Technical:** "Request failed (timeout after 30s). Retry or check network status."

Be consistent within a spec. If errors are friendly, success messages should be too.

## Anti-patterns

- Jargon without explanation ("CSRF token expired")
- Passive voice in actions ("The form will be submitted" → "Submit the form")
- Blame language ("You entered an invalid email" → "Please enter a valid email address")
- Generic text that could apply to any app ("Welcome!" → "Welcome to [product]. Here's how to get started.")
- Inconsistent terminology (using "delete", "remove", and "trash" for the same action)

## Principle

Every string in a UXSpec is an interface with a human. Vague copy creates vague implementations. Specific, intentional text — even in `$description` fields that no end user sees — produces specific, intentional UIs.
