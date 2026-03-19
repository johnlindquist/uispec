export type Scalar = string | number | boolean | null;
export type Json = Scalar | Json[] | { [key: string]: Json };

export type Expr =
  | Scalar
  | ["param", string]
  | ["var", string]
  | ["get", Expr, string]
  | ["+", Expr, Expr]
  | ["-", Expr, Expr]
  | ["*", Expr, Expr]
  | ["/", Expr, Expr]
  | ["pow", Expr, Expr]
  | ["min", Expr, Expr]
  | ["max", Expr, Expr]
  | ["clamp", Expr, Expr, Expr]
  | ["lerp", Expr, Expr, Expr]
  | ["if", Expr, Expr, Expr]
  | ["==", Expr, Expr]
  | ["!=", Expr, Expr]
  | ["<", Expr, Expr]
  | ["<=", Expr, Expr]
  | [">", Expr, Expr]
  | [">=", Expr, Expr]
  | ["!", Expr]
  | ["&&", Expr, Expr]
  | ["||", Expr, Expr]
  | ["coalesce", Expr, Expr]
  | ["round", Expr]
  | ["floor", Expr]
  | ["ceil", Expr];

export interface ContextField {
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  default?: Json;
  required?: boolean;
  $description?: string;
}

export interface EventSpec {
  source?: "user" | "system" | "timer" | "network" | "storage";
  payload?: Record<string, ContextField>;
}

export interface ActionSpec {
  kind: "assign" | "emit" | "log";
  path?: string;
  value?: Expr;
  event?: string;
  level?: "debug" | "info" | "warn" | "error";
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

export interface TransitionSpec {
  target: string;
  guard?: Expr | null;
  actions?: ActionSpec[];
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

export interface StateNode {
  type?: "final";
  initial?: string;
  on?: Record<string, string | TransitionSpec>;
  always?: Array<string | TransitionSpec>;
  entry?: Array<ActionSpec | EffectSpec>;
  exit?: Array<ActionSpec | EffectSpec>;
  invoke?: Array<Record<string, Json>>;
  states?: Record<string, StateNode>;
  $visual?: VisualSpec;
}

export interface ImportSpec {
  from: string;
  tokens?: boolean;
  elements?: boolean;
  animations?: boolean;
  machine?: boolean;
}

export interface MachineInvokeSpec {
  kind: "machine";
  src: string;
  id: string;
  input?: Record<string, Expr>;
  onDone?: Record<string, string>;
}

export interface ResolvedImportNamespace {
  alias: string;
  sourcePath: string;
  tokens?: Record<string, Json>;
  elements?: Record<string, Json>;
  animations?: Record<string, Json>;
  machineId?: string;
  machineDocument?: UXSpecDocument;
}

export interface ResolvedImports {
  namespaces: Map<string, ResolvedImportNamespace>;
}

export interface UXSpecDocument {
  $schema: string;
  $description: string;
  $imports?: Record<string, ImportSpec>;
  $tokens?: Record<string, Json>;
  $animations?: Record<string, Json>;
  $elements?: Record<string, Json>;
  $context?: Record<string, ContextField>;
  $events?: Record<string, EventSpec>;
  $actions?: Record<string, ActionSpec>;
  $effects?: Record<string, EffectSpec>;
  $machine: {
    id: string;
    initial: string;
    $visual?: VisualSpec;
    states: Record<string, StateNode>;
  };
}

export interface CompiledTransition {
  event: string | null;
  target: string;
  guard: Expr | null;
  actions: ActionSpec[];
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

export interface Assertion {
  id: string;
  type: "element-present";
  testId: string;
}

export interface CompiledUXSpec {
  $format: "uxspec-compiled";
  $version: "0.2";
  $source?: string;
  initial: string;
  contextSchema: Record<string, ContextField>;
  eventSchema: Record<string, EventSpec>;
  states: Record<string, CompiledState>;
  assertions: Assertion[];
  dependencies?: Record<string, { from: string; kind: "machine" }>;
}

export interface BundledUXSpec {
  $format: "uxspec-bundled";
  $version: "0.2";
  entry: string;
  modules: Record<string, CompiledUXSpec>;
}

// ── Unified diagnostics ──

export type CompilerIssueCode =
  | "UNDECLARED_CONTEXT_VAR"
  | "UNDECLARED_EVENT"
  | "UNDECLARED_TARGET"
  | "UNSUPPORTED_EXPR_OP"
  | "INVALID_ASSIGN_PATH"
  | "UNKNOWN_TOKEN_REFERENCE"
  | "UNKNOWN_ELEMENT_REFERENCE"
  | "INVALID_MACHINE_INITIAL"
  | "INVALID_COMPOUND_INITIAL"
  | "READ_FAILED"
  | "IMPORT_NOT_FOUND"
  | "IMPORT_READ_FAILED"
  | "IMPORT_PARSE_FAILED"
  | "IMPORT_CYCLE"
  | "IMPORT_ALIAS_CONFLICT"
  | "INVALID_IMPORT_SPEC"
  | "TOKEN_REFERENCE_CYCLE"
  | "ELEMENT_REFERENCE_CYCLE"
  | "UNKNOWN_IMPORTED_TOKEN_REFERENCE"
  | "UNKNOWN_IMPORTED_ELEMENT_REFERENCE"
  | "UNKNOWN_IMPORTED_MACHINE"
  | "CROSS_MODULE_TARGET_FORBIDDEN"
  | "INVALID_MACHINE_INVOKE"
  | "INVALID_INVOKE_INPUT"
  | "UNKNOWN_FINAL_STATE";

export type CompilerTracePhase =
  | "resolve"
  | "state-paths"
  | "validate"
  | "compile"
  | "cli"
  | "import";

export type CompilerTraceKind =
  | "token"
  | "ref"
  | "initial"
  | "target"
  | "io"
  | "summary"
  | "import"
  | "invoke"
  | "namespace";

export interface CompilerIssue {
  code: CompilerIssueCode;
  message: string;
  path: string;
  phase: "resolve" | "state-paths" | "validate" | "compile" | "cli" | "import";
}

export interface CompilerTraceEntry {
  phase: CompilerTracePhase;
  kind: CompilerTraceKind;
  path: string;
  input: string;
  output?: string;
  status?: "ok" | "error";
  code?: CompilerIssueCode;
  detail?: string;
  attempts?: string[];
}

export interface CompileResult {
  ok: boolean;
  compiled: CompiledUXSpec | null;
  issues: CompilerIssue[];
  trace: CompilerTraceEntry[];
}
