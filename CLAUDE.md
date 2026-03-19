# UXSpec — Development Guide

## Quick Start

```bash
bun test                                                    # Run all tests
bun run src/compiler/cli.ts validate examples/*.uxspec.json # Validate specs
bun run src/compiler/cli.ts compile examples/*.uxspec.json  # Compile specs
```

## Architecture

The compiler is a five-phase JSON-to-JSON transform:

1. **Resolve tokens** — replace `{token.path}` strings with concrete values from `$tokens`
2. **Expand `$ref`s** — inline element definitions from `$elements` with parameter substitution
3. **Build state index** — walk `$machine.states`, track leaf vs compound, resolve initials
4. **Flatten states** — produce dot-separated leaf paths with inherited visuals/transitions
5. **Extract assertions** — collect `testId` fields into verification expectations

Source files: `resolve.ts` → `state-paths.ts` → `compile.ts` → `validate.ts` → `cli.ts`

## Compiler Contract

- `compile()` never throws for authoring errors; it returns `{ ok, compiled, issues, trace }`.
- `compiled.initial` is always a leaf state path.
- CLI success fields:
  - `ok`
  - `file`
  - `output`
  - `states`
  - `assertions`
  - `unresolvedRefs`
  - `unresolvedTokenAliases`
  - `leafInitial`
  - `trace`
- CLI failure fields:
  - `ok`
  - `file`
  - `issues`
  - `trace`
- Trace kinds:
  - `token`
  - `ref`
  - `initial`
  - `target`

### CLI Success Example

```json
{"file":"examples/02-auth-flow.uxspec.json","ok":true,"output":"dist/compiled/02-auth-flow.compiled.json","states":17,"assertions":21,"unresolvedRefs":0,"unresolvedTokenAliases":0,"leafInitial":true,"trace":[]}
```

### CLI Failure Example

```json
{"file":"tests/fixtures/bad-initial.uxspec.json","ok":false,"issues":[{"code":"INVALID_MACHINE_INITIAL","message":"Machine initial \"missing\" does not resolve to a state","path":"$machine.initial","phase":"state-paths"}],"trace":[]}
```

### Issue Codes

| Code | Phase | Meaning |
|------|-------|---------|
| `UNDECLARED_CONTEXT_VAR` | validate | Expression references undeclared `$context` variable |
| `UNDECLARED_EVENT` | validate | Transition or emit uses undeclared `$events` key |
| `UNDECLARED_TARGET` | state-paths | Transition target does not resolve to any state |
| `UNSUPPORTED_EXPR_OP` | validate | Expression uses an operator outside the supported set |
| `INVALID_ASSIGN_PATH` | validate | Assign action path does not start with `context.` |
| `UNKNOWN_TOKEN_REFERENCE` | resolve | `{token.path}` not found in `$tokens` |
| `UNKNOWN_ELEMENT_REFERENCE` | resolve | `$ref` name not found in `$elements` |
| `INVALID_MACHINE_INITIAL` | state-paths | `$machine.initial` does not resolve to a state |
| `INVALID_COMPOUND_INITIAL` | state-paths | Compound state `initial` references nonexistent child |

## Testing

```bash
bun test                                  # All tests
bun test tests/compiler.cli.test.ts       # CLI integration tests
bun test tests/compiler.failures.test.ts  # Failure diagnostic tests
bun test tests/compiler.conformance.test.ts # Conformance tests
bun test tests/compile.test.ts            # Core compilation tests
bun test tests/validate.test.ts           # Validation tests
```
