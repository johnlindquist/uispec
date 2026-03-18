import type {
  CompilerIssue,
  CompilerIssueCode,
  CompilerTraceEntry,
  CompilerTraceKind,
  CompilerTracePhase,
} from "./types";

export function makeIssue(
  code: CompilerIssueCode,
  message: string,
  path: string,
  phase: CompilerIssue["phase"]
): CompilerIssue {
  return { code, message, path, phase };
}

export function traceOk(
  trace: CompilerTraceEntry[],
  phase: CompilerTracePhase,
  kind: CompilerTraceKind,
  path: string,
  input: string,
  output?: string,
  detail?: string
): void {
  trace.push({
    phase,
    kind,
    path,
    input,
    output,
    detail,
    status: "ok",
  });
}

export function traceError(
  trace: CompilerTraceEntry[],
  phase: CompilerTracePhase,
  kind: CompilerTraceKind,
  path: string,
  input: string,
  code: CompilerIssueCode,
  detail: string,
  attempts?: string[]
): void {
  trace.push({
    phase,
    kind,
    path,
    input,
    code,
    detail,
    attempts,
    status: "error",
  });
}
