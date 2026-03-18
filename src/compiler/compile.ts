import type {
  ActionSpec,
  Assertion,
  CompiledState,
  CompiledTransition,
  CompiledUISpec,
  EffectSpec,
  Json,
  StateNode,
  UISpecDocument,
  VisualSpec,
} from "./types";

function normalizeTransition(
  event: string | null,
  raw: string | { target: string; guard?: any; actions?: ActionSpec[] }
): CompiledTransition {
  if (typeof raw === "string") {
    return { event, target: raw, guard: null, actions: [] };
  }
  return {
    event,
    target: raw.target,
    guard: raw.guard ?? null,
    actions: raw.actions ?? [],
  };
}

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

function collectTestIds(obj: unknown, out: Assertion[]): void {
  if (obj === null || obj === undefined || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) collectTestIds(item, out);
    return;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.testId === "string") {
    out.push({
      id: `${record.testId}-exists`,
      type: "element-present",
      testId: record.testId,
    });
  }
  for (const value of Object.values(record)) {
    collectTestIds(value, out);
  }
}

function compileNode(
  path: string,
  node: StateNode,
  inheritedVisual: VisualSpec | undefined,
  inheritedEntry: Array<ActionSpec | EffectSpec>,
  inheritedExit: Array<ActionSpec | EffectSpec>,
  out: Record<string, CompiledState>
): void {
  const visual = mergeVisual(inheritedVisual, node.$visual);
  const entry = [...inheritedEntry, ...(node.entry ?? [])];
  const exit = [...(node.exit ?? []), ...inheritedExit];
  const invoke = node.invoke ?? [];

  const transitions: CompiledTransition[] = [];

  for (const [event, target] of Object.entries(node.on ?? {})) {
    transitions.push(normalizeTransition(event, target));
  }

  for (const target of node.always ?? []) {
    transitions.push(normalizeTransition(null, target as any));
  }

  if (!node.states || Object.keys(node.states).length === 0) {
    out[path] = { path, visual, transitions, entry, exit, invoke };
    return;
  }

  for (const [childKey, childNode] of Object.entries(node.states)) {
    compileNode(
      joinPath(path, childKey),
      childNode,
      visual,
      entry,
      exit,
      out
    );
  }
}

export function compile(document: UISpecDocument): CompiledUISpec {
  const states: Record<string, CompiledState> = {};

  for (const [key, node] of Object.entries(document.$machine.states)) {
    compileNode(key, node, document.$machine.$visual, [], [], states);
  }

  const assertions: Assertion[] = [];
  collectTestIds(document.$elements, assertions);
  for (const state of Object.values(states)) {
    collectTestIds(state.visual, assertions);
  }

  return {
    $format: "uispec-compiled",
    $version: "0.2",
    initial: document.$machine.initial,
    contextSchema: document.$context ?? {},
    eventSchema: document.$events ?? {},
    states,
    assertions,
  };
}
