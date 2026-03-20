---
name: states
description: Design the $machine section — map happy paths, error paths, and all state types into a complete behavioral skeleton
---

# States: State Machine Design

Design the `$machine` — the behavioral skeleton of a UXSpec. Every state is a promise to the user about what they can do and what they'll see.

## When to Use

When building or revising the `$machine` section. Also useful for auditing an existing spec's state coverage.

## Process

### 1. Map the Happy Path
Start with the ideal flow: entry → action → outcome. Define compound states (parents) and leaf states (children). Every compound state needs an `initial` child.

```
idle --SUBMIT--> loading
loading --HTTP_OK--> success
```

### 2. Map the Unhappy Paths
For every transition, ask: what else could happen?
- **Network failure** — timeout, server error, no connection
- **Validation failure** — bad input, missing fields, format errors
- **Permission failure** — expired session, insufficient role, rate limited
- **Concurrent conflict** — double submission, stale data, race condition

Each failure needs a state (or at least a handled transition) — not just an afterthought.

### 3. Cover All State Types
A complete machine accounts for:
- **Empty** — no data yet, no results, first-time use. These are onboarding opportunities.
- **Loading** — initial fetch, pagination, background refresh. Each may need different visuals.
- **Error** — network, validation, permissions, rate limiting. Each needs different copy and recovery.
- **Success** — confirmation, next steps, celebration. What happens after the goal is met?
- **Partial** — some data loaded, some fields valid. Don't force all-or-nothing.

### 4. Simplify
For each state, ask: is this truly necessary?
- Can two states merge? (e.g., "loading" and "refreshing" might be one state with a context flag)
- Is a state reachable? (orphaned states are dead weight)
- Does every state have a way out? (no dead ends)
- Look for the 20% of states delivering 80% of value.

### 5. Wire Transitions
- Map events to transitions with optional guards and actions
- Add `entry`/`exit` actions (set loading flags, clear errors, reset forms)
- Add `invoke` for long-running effects (HTTP calls, timers, polling)
- Use `always` transitions with guards for automatic routing (e.g., redirect if already authenticated)

## Diagram

Present the state graph as text before writing JSON:

```
idle --SUBMIT--> loading
loading --HTTP_OK--> success
loading --HTTP_ERROR--> error
error --RETRY--> loading
success --RESET--> idle
```

## Principle

A state machine is a contract: "in this state, these things are true and these things are possible." If a state doesn't change what the user sees or can do, it doesn't belong.
