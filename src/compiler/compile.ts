import type {
  ActionSpec,
  Assertion,
  CompiledState,
  CompiledTransition,
  CompiledUISpec,
  CompileResult,
  CompilerIssue,
  CompilerTraceEntry,
  EffectSpec,
  StateNode,
  UISpecDocument,
  VisualSpec,
} from "./types";
import { resolveDocument } from "./resolve";
import {
  buildStateIndex,
  resolveLeafInitial,
  resolveTargetPath,
  type StateIndex,
} from "./state-paths";

function mergeVisual(
  parent: VisualSpec | undefined,
  child: VisualSpec | undefined
): VisualSpec {
  const merged: VisualSpec = { ...(parent ?? {}), ...(child ?? {}) };
  if (child?.slots) {
    merged.slots = child.slots;
  } else if (parent?.slots) {
    merged.slots = parent.slots;
  }
  return merged;
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

function normalizeTransition(
  event: string | null,
  raw: string | { target: string; guard?: any; actions?: ActionSpec[] },
  sourceStatePath: string,
  index: StateIndex,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  eventPath: string
): CompiledTransition {
  const rawTarget = typeof raw === "string" ? raw : raw.target;
  const resolved = resolveTargetPath(
    sourceStatePath,
    rawTarget,
    index,
    issues,
    eventPath,
    trace
  );

  if (typeof raw === "string") {
    return {
      event,
      target: resolved ?? rawTarget,
      guard: null,
      actions: [],
    };
  }

  return {
    event,
    target: resolved ?? rawTarget,
    guard: raw.guard ?? null,
    actions: raw.actions ?? [],
  };
}

function mergeEventTransitions(
  inherited: CompiledTransition[],
  local: CompiledTransition[]
): CompiledTransition[] {
  const byEvent = new Map<string | null, CompiledTransition>();

  for (const transition of inherited) {
    if (transition.event !== null) byEvent.set(transition.event, transition);
  }

  for (const transition of local) {
    if (transition.event !== null) byEvent.set(transition.event, transition);
  }

  return Array.from(byEvent.values());
}

function collectTestIds(
  obj: unknown,
  out: Assertion[],
  seen: Set<string>
): void {
  if (obj === null || obj === undefined || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) collectTestIds(item, out, seen);
    return;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.testId === "string" && !seen.has(record.testId)) {
    seen.add(record.testId);
    out.push({
      id: `${record.testId}-exists`,
      type: "element-present",
      testId: record.testId,
    });
  }

  for (const value of Object.values(record)) {
    collectTestIds(value, out, seen);
  }
}

function compileNode(
  path: string,
  node: StateNode,
  index: StateIndex,
  inheritedVisual: VisualSpec | undefined,
  inheritedEntry: Array<ActionSpec | EffectSpec>,
  inheritedExit: Array<ActionSpec | EffectSpec>,
  inheritedEventTransitions: CompiledTransition[],
  out: Record<string, CompiledState>,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[]
): void {
  const visual = mergeVisual(inheritedVisual, node.$visual);
  const entry = [...inheritedEntry, ...(node.entry ?? [])];
  const exit = [...(node.exit ?? []), ...inheritedExit];
  const invoke = node.invoke ?? [];

  const localEventTransitions = Object.entries(node.on ?? {}).map(([event, raw]) =>
    normalizeTransition(
      event,
      raw,
      path,
      index,
      issues,
      trace,
      `$machine.states.${path.replace(/\./g, ".states.")}.on.${event}`
    )
  );

  const eventTransitions = mergeEventTransitions(
    inheritedEventTransitions,
    localEventTransitions
  );

  const alwaysTransitions = (node.always ?? []).map((raw, i) =>
    normalizeTransition(
      null,
      raw as any,
      path,
      index,
      issues,
      trace,
      `$machine.states.${path.replace(/\./g, ".states.")}.always[${i}]`
    )
  );

  if (!node.states || Object.keys(node.states).length === 0) {
    out[path] = {
      path,
      visual,
      transitions: [...eventTransitions, ...alwaysTransitions],
      entry,
      exit,
      invoke,
    };
    return;
  }

  for (const [childKey, childNode] of Object.entries(node.states)) {
    compileNode(
      joinPath(path, childKey),
      childNode,
      index,
      visual,
      entry,
      exit,
      eventTransitions,
      out,
      issues,
      trace
    );
  }
}

export function compile(
  document: UISpecDocument,
  options: { trace?: boolean } = {}
): CompileResult {
  const issues: CompilerIssue[] = [];
  const trace: CompilerTraceEntry[] = [];

  const resolved = resolveDocument(document, issues, trace);

  const index = buildStateIndex(resolved.$machine.states, issues, trace);

  if (issues.length > 0) {
    return {
      ok: false,
      compiled: null,
      issues,
      trace: options.trace ? trace : [],
    };
  }

  const initial = resolveLeafInitial(
    resolved.$machine.initial,
    index,
    issues,
    "$machine.initial",
    trace
  );

  if (issues.length > 0 || initial === null) {
    return {
      ok: false,
      compiled: null,
      issues,
      trace: options.trace ? trace : [],
    };
  }

  const states: Record<string, CompiledState> = {};

  for (const [key, node] of Object.entries(resolved.$machine.states)) {
    compileNode(
      key,
      node,
      index,
      resolved.$machine.$visual,
      [],
      [],
      [],
      states,
      issues,
      trace
    );
  }

  if (issues.length > 0) {
    return {
      ok: false,
      compiled: null,
      issues,
      trace: options.trace ? trace : [],
    };
  }

  const assertions: Assertion[] = [];
  const seen = new Set<string>();
  collectTestIds(resolved.$elements, assertions, seen);

  for (const state of Object.values(states)) {
    collectTestIds(state.visual, assertions, seen);
  }

  const compiled: CompiledUISpec = {
    $format: "uispec-compiled",
    $version: "0.2",
    initial,
    contextSchema: resolved.$context ?? {},
    eventSchema: resolved.$events ?? {},
    states,
    assertions,
  };

  return {
    ok: true,
    compiled,
    issues: [],
    trace: options.trace ? trace : [],
  };
}
