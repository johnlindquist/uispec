import type { CompilerIssue, CompilerTraceEntry, Json, UXSpecDocument } from "./types";

type JsonRecord = Record<string, Json>;
const TOKEN_REF_RE = /^\{([A-Za-z0-9_.-]+)\}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function resolveTokenValue(
  tokens: JsonRecord | undefined,
  value: unknown,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  path: string
): Json {
  if (typeof value === "string") {
    const match = value.match(TOKEN_REF_RE);
    if (match) return resolveToken(tokens, match[1]!, issues, trace, path);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      resolveTokenValue(tokens, item, issues, trace, `${path}[${i}]`)
    ) as Json;
  }

  if (isObject(value)) {
    if (
      typeof value.value === "number" &&
      typeof value.unit === "string" &&
      Object.keys(value).length === 2
    ) {
      return value.value as Json;
    }

    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = resolveTokenValue(tokens, child, issues, trace, `${path}.${key}`);
    }
    return out;
  }

  return value as Json;
}

function resolveToken(
  tokens: JsonRecord | undefined,
  tokenPath: string,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  contextPath: string
): Json {
  let current: any = tokens;

  for (const part of tokenPath.split(".")) {
    current = current?.[part];
  }

  if (!isObject(current) || !("$value" in current)) {
    issues.push({
      code: "UNKNOWN_TOKEN_REFERENCE",
      message: `Unknown token reference: ${tokenPath}`,
      path: contextPath,
      phase: "resolve",
    });
    return `{${tokenPath}}` as Json;
  }

  const resolved = resolveTokenValue(tokens, current.$value, issues, trace, contextPath);
  trace.push({
    phase: "resolve",
    kind: "token",
    path: contextPath,
    input: `{${tokenPath}}`,
    output: JSON.stringify(resolved),
  });
  return resolved;
}

function resolveNodeTokens(
  node: unknown,
  tokens: JsonRecord | undefined,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  path: string
): Json {
  if (typeof node === "string") {
    const match = node.match(TOKEN_REF_RE);
    return match ? resolveToken(tokens, match[1]!, issues, trace, path) : node;
  }

  if (Array.isArray(node)) {
    return node.map((item, i) =>
      resolveNodeTokens(item, tokens, issues, trace, `${path}[${i}]`)
    ) as Json;
  }

  if (isObject(node)) {
    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(node)) {
      out[key] = resolveNodeTokens(child, tokens, issues, trace, `${path}.${key}`);
    }
    return out;
  }

  return node as Json;
}

function substituteParams(node: unknown, params: JsonRecord): Json {
  if (Array.isArray(node)) {
    if (node[0] === "param" && typeof node[1] === "string") {
      return clone(params[node[1]] ?? null);
    }
    return node.map((item) => substituteParams(item, params)) as Json;
  }

  if (isObject(node)) {
    if (typeof node.$bind === "string") {
      return clone(params[node.$bind] ?? null) as Json;
    }

    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(node)) {
      if (key === "params") continue;
      out[key] = substituteParams(child, params);
    }
    return out;
  }

  return node as Json;
}

function expandRefs(
  node: unknown,
  elements: JsonRecord,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  path: string
): Json {
  if (Array.isArray(node)) {
    return node.map((item, i) =>
      expandRefs(item, elements, issues, trace, `${path}[${i}]`)
    ) as Json;
  }

  if (!isObject(node)) return node as Json;

  if (typeof node.$ref === "string") {
    const refName = node.$ref as string;
    const rawBase = elements[refName];
    if (rawBase === undefined || !isObject(rawBase)) {
      issues.push({
        code: "UNKNOWN_ELEMENT_REFERENCE",
        message: `Unknown element reference: ${refName}`,
        path,
        phase: "resolve",
      });
      return node as Json;
    }
    const base = clone(rawBase);

    trace.push({
      phase: "resolve",
      kind: "ref",
      path,
      input: refName,
      output: undefined,
    });

    const refArgs = clone(node) as JsonRecord;
    delete refArgs.$ref;

    const merged: JsonRecord = {
      ...(base as JsonRecord),
      ...refArgs,
    };

    const paramNames = Array.isArray((base as Record<string, unknown>).params)
      ? ((base as Record<string, unknown>).params as string[])
      : [];

    const params: JsonRecord = {};
    for (const name of paramNames) {
      params[name] = clone(refArgs[name] ?? merged[name] ?? null);
    }

    return expandRefs(substituteParams(merged, params), elements, issues, trace, path);
  }

  const out: JsonRecord = {};
  for (const [key, child] of Object.entries(node)) {
    out[key] = expandRefs(child, elements, issues, trace, `${path}.${key}`);
  }
  return out;
}

export function resolveDocument(
  document: UXSpecDocument,
  issues: CompilerIssue[] = [],
  trace: CompilerTraceEntry[] = []
): UXSpecDocument {
  const cloned = clone(document);
  const expanded = expandRefs(
    cloned,
    (cloned.$elements ?? {}) as JsonRecord,
    issues,
    trace,
    "$"
  );
  return resolveNodeTokens(
    expanded,
    cloned.$tokens as JsonRecord | undefined,
    issues,
    trace,
    "$"
  ) as UXSpecDocument;
}
