# UXSpec — Agent Guide

This file describes the machine-readable interfaces that AI agents and automated tooling can rely on.

## Project Structure

```
src/compiler/          # Compiler source (TypeScript, runs on Bun)
  types.ts             # All shared types: UXSpecDocument, CompileResult, CompilerIssue, etc.
  compile.ts           # compile() entry point
  validate.ts          # validateSpec() — standalone validation without compilation
  resolve.ts           # Token and $ref resolution
  state-paths.ts       # State index, leaf-initial resolution, target resolution
  cli.ts               # CLI entry: validate and compile commands

spec/COMPILER.md       # Normative compiler reference
examples/              # Authoring-format .uxspec.json files
dist/compiled/         # Compiled .compiled.json output
tests/                 # Bun test suites
```

## Commands

| Command | What it does |
|---------|-------------|
| `bun test` | Run all tests |
| `bun run src/compiler/cli.ts validate [file...]` | Validate specs, print one JSON record per file |
| `bun run src/compiler/cli.ts compile [file...]` | Compile specs, print one JSON record per file |
| `bun run src/compiler/cli.ts compile --trace [file...]` | Compile with trace data |

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

## Exit Codes

- `0` — all files processed successfully, no issues
- `1` — at least one file had validation/compilation issues or could not be read

## Idempotency

All operations are idempotent. Re-running `compile` on the same input produces identical output. The compiler has no side effects beyond writing `.compiled.json` files to `dist/compiled/`.
