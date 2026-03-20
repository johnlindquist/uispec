export type Scalar = string | number | boolean | null;
export type Json = Scalar | Json[] | { [key: string]: Json };
export type Expr = Scalar | [string, ...any[]];

export interface ContextField {
  type: string;
  default?: Json;
  $description?: string;
}

export interface EventSpec {
  source?: string;
  payload?: Record<string, any>;
}

export interface ActionSpec {
  kind: "assign" | "emit" | "log";
  path?: string;
  value?: Expr;
  event?: string;
  level?: string;
  message?: string;
}

export interface EffectSpec {
  kind:
    | "http"
    | "timer.start"
    | "timer.cancel"
    | "navigate"
    | "focus"
    | "storage.write";
  id?: string;
  ms?: number;
  event?: string;
  to?: string;
  target?: string;
  request?: string;
  key?: string;
  value?: Json;
}

export interface CompiledTransition {
  event: string | null;
  target: string;
  guard: Expr | null;
  actions: ActionSpec[];
}

export interface VisualSpec {
  $description?: string;
  container?: Record<string, Json>;
  slots?: Record<string, Json[]>;
  keyboard?: Record<string, string>;
  onEnter?: Record<string, Json>;
  autoDismiss?: Json;
  [key: string]: Json | undefined;
}

export interface CompiledState {
  type?: "final";
  path: string;
  visual: VisualSpec;
  transitions: CompiledTransition[];
  entry: Array<ActionSpec | EffectSpec>;
  exit: Array<ActionSpec | EffectSpec>;
  invoke: Array<Record<string, Json>>;
}

export interface CompiledUXSpec {
  $format: "uxspec-compiled";
  $version: "0.2";
  initial: string;
  contextSchema: Record<string, ContextField>;
  eventSchema: Record<string, EventSpec>;
  states: Record<string, CompiledState>;
  assertions: Array<{ id: string; type: string; testId: string }>;
}

export interface UXSnapshot {
  statePath: string;
  context: Record<string, Json>;
  visual: VisualSpec;
  transitions: CompiledTransition[];
}

export interface UXStore {
  getSnapshot(): UXSnapshot;
  subscribe(listener: () => void): () => void;
  send(type: string, payload?: Record<string, Json>): void;
  forceState(path: string): void;
}

export interface ExprEnv {
  context: Record<string, Json>;
  event: Record<string, Json> | null;
}
