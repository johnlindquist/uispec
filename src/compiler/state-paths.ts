import type { CompilerIssue, CompilerTraceEntry, StateNode } from "./types";
import { makeIssue, traceError, traceOk } from "./diagnostics";

export interface StateIndex {
  all: Set<string>;
  leaf: Set<string>;
  initialLeafByState: Map<string, string>;
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

function walk(
  states: Record<string, StateNode>,
  prefix: string,
  index: StateIndex,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[]
): void {
  for (const [key, node] of Object.entries(states)) {
    const path = joinPath(prefix, key);
    index.all.add(path);

    if (!node.states || Object.keys(node.states).length === 0) {
      index.leaf.add(path);
      index.initialLeafByState.set(path, path);
      continue;
    }

    walk(node.states, path, index, issues, trace);

    const initialChild = node.initial ?? Object.keys(node.states)[0];
    const childNode = initialChild ? node.states[initialChild] : undefined;
    if (!childNode) {
      issues.push(
        makeIssue(
          "INVALID_COMPOUND_INITIAL",
          `Compound state "${path}" has invalid initial child "${initialChild}"`,
          `$machine.states.${path.replace(/\./g, ".states.")}.initial`,
          "state-paths"
        )
      );
      traceError(
        trace,
        "state-paths",
        "initial",
        `$machine.states.${path.replace(/\./g, ".states.")}.initial`,
        initialChild ?? "",
        "INVALID_COMPOUND_INITIAL",
        `Compound state "${path}" has invalid initial child "${initialChild}"`
      );
      continue;
    }

    const childPath = joinPath(path, initialChild);
    const leaf = index.initialLeafByState.get(childPath);
    if (!leaf) {
      issues.push(
        makeIssue(
          "INVALID_COMPOUND_INITIAL",
          `Could not resolve initial leaf for "${path}"`,
          `$machine.states.${path.replace(/\./g, ".states.")}.initial`,
          "state-paths"
        )
      );
      traceError(
        trace,
        "state-paths",
        "initial",
        `$machine.states.${path.replace(/\./g, ".states.")}.initial`,
        initialChild,
        "INVALID_COMPOUND_INITIAL",
        `Could not resolve initial leaf for "${path}"`
      );
      continue;
    }

    index.initialLeafByState.set(path, leaf);
    traceOk(trace, "state-paths", "initial", path, initialChild, leaf);
  }
}

export function buildStateIndex(
  states: Record<string, StateNode>,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[] = []
): StateIndex {
  const index: StateIndex = {
    all: new Set<string>(),
    leaf: new Set<string>(),
    initialLeafByState: new Map<string, string>(),
  };
  walk(states, "", index, issues, trace);
  return index;
}

function canonicalAbsoluteTarget(
  rawTarget: string,
  index: StateIndex
): string | null {
  if (!index.all.has(rawTarget)) return null;
  return index.initialLeafByState.get(rawTarget) ?? rawTarget;
}

export function resolveLeafInitial(
  rawInitial: string,
  index: StateIndex,
  issues: CompilerIssue[],
  path: string = "$machine.initial",
  trace: CompilerTraceEntry[] = []
): string | null {
  const resolved = canonicalAbsoluteTarget(rawInitial, index);
  if (!resolved) {
    issues.push(
      makeIssue(
        "INVALID_MACHINE_INITIAL",
        `Machine initial "${rawInitial}" does not resolve to a state`,
        path,
        "state-paths"
      )
    );
    traceError(
      trace,
      "state-paths",
      "initial",
      path,
      rawInitial,
      "INVALID_MACHINE_INITIAL",
      `Machine initial "${rawInitial}" does not resolve to a state`
    );
    return null;
  }
  traceOk(trace, "state-paths", "initial", path, rawInitial, resolved);
  return resolved;
}

export function resolveTargetPath(
  sourceStatePath: string,
  rawTarget: string,
  index: StateIndex,
  issues: CompilerIssue[],
  path: string = sourceStatePath,
  trace: CompilerTraceEntry[] = []
): string | null {
  const attempts: string[] = [rawTarget];

  const absolute = canonicalAbsoluteTarget(rawTarget, index);
  if (absolute) {
    traceOk(trace, "state-paths", "target", path, rawTarget, absolute);
    return absolute;
  }

  const parts = sourceStatePath.split(".");
  const start = index.leaf.has(sourceStatePath) ? parts.length - 1 : parts.length;

  for (let i = start; i >= 1; i--) {
    const prefix = parts.slice(0, i).join(".");
    const candidate = `${prefix}.${rawTarget}`;
    attempts.push(candidate);

    const resolved = canonicalAbsoluteTarget(candidate, index);
    if (resolved) {
      traceOk(trace, "state-paths", "target", path, rawTarget, resolved);
      return resolved;
    }
  }

  issues.push(
    makeIssue(
      "UNDECLARED_TARGET",
      `Target "${rawTarget}" from "${sourceStatePath}" does not resolve to a state`,
      path,
      "state-paths"
    )
  );
  traceError(
    trace,
    "state-paths",
    "target",
    path,
    rawTarget,
    "UNDECLARED_TARGET",
    `Target "${rawTarget}" from "${sourceStatePath}" does not resolve to a state`,
    attempts
  );
  return null;
}
