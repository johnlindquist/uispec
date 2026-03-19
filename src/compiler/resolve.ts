import type {
  CompilerIssue,
  CompilerTraceEntry,
  Json,
  ResolvedImports,
  UXSpecDocument,
} from "./types";

type JsonRecord = Record<string, Json>;
const TOKEN_REF_RE = /^\{((?:[A-Za-z0-9_-]+:)?[A-Za-z0-9_.-]+)\}$/;

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
  path: string,
  imports?: ResolvedImports
): Json {
  if (typeof value === "string") {
    const match = value.match(TOKEN_REF_RE);
    if (match) return resolveToken(tokens, match[1]!, issues, trace, path, imports);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      resolveTokenValue(tokens, item, issues, trace, `${path}[${i}]`, imports)
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
      out[key] = resolveTokenValue(tokens, child, issues, trace, `${path}.${key}`, imports);
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
  contextPath: string,
  imports?: ResolvedImports
): Json {
  const colonIdx = tokenPath.indexOf(":");
  let lookupTokens = tokens;
  let lookupPath = tokenPath;

  if (colonIdx !== -1) {
    const alias = tokenPath.slice(0, colonIdx);
    lookupPath = tokenPath.slice(colonIdx + 1);
    const ns = imports?.namespaces.get(alias);
    if (!ns || !ns.tokens) {
      issues.push({
        code: "UNKNOWN_IMPORTED_TOKEN_REFERENCE",
        message: `Unknown imported token reference: ${tokenPath}`,
        path: contextPath,
        phase: "resolve",
      });
      return `{${tokenPath}}` as Json;
    }
    lookupTokens = ns.tokens as JsonRecord;
  }

  let current: any = lookupTokens;

  for (const part of lookupPath.split(".")) {
    current = current?.[part];
  }

  if (!isObject(current) || !("$value" in current)) {
    const code = colonIdx !== -1 ? "UNKNOWN_IMPORTED_TOKEN_REFERENCE" : "UNKNOWN_TOKEN_REFERENCE";
    issues.push({
      code,
      message: `Unknown token reference: ${tokenPath}`,
      path: contextPath,
      phase: "resolve",
    });
    return `{${tokenPath}}` as Json;
  }

  const resolved = resolveTokenValue(lookupTokens, current.$value, issues, trace, contextPath, imports);
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
  path: string,
  imports?: ResolvedImports
): Json {
  if (typeof node === "string") {
    const match = node.match(TOKEN_REF_RE);
    return match ? resolveToken(tokens, match[1]!, issues, trace, path, imports) : node;
  }

  if (Array.isArray(node)) {
    return node.map((item, i) =>
      resolveNodeTokens(item, tokens, issues, trace, `${path}[${i}]`, imports)
    ) as Json;
  }

  if (isObject(node)) {
    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(node)) {
      out[key] = resolveNodeTokens(child, tokens, issues, trace, `${path}.${key}`, imports);
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

/**
 * Qualify unqualified token references in an imported element
 * so they resolve against the source namespace's tokens.
 * e.g., "{color.brand.primary}" becomes "{ui:color.brand.primary}"
 */
function qualifyTokenRefs(node: unknown, alias: string): Json {
  if (typeof node === "string") {
    const match = node.match(TOKEN_REF_RE);
    if (match && !match[1]!.includes(":")) {
      return `{${alias}:${match[1]}}` as Json;
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item) => qualifyTokenRefs(item, alias)) as Json;
  }
  if (isObject(node)) {
    const out: JsonRecord = {};
    for (const [key, child] of Object.entries(node)) {
      out[key] = qualifyTokenRefs(child, alias);
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
  path: string,
  imports?: ResolvedImports
): Json {
  if (Array.isArray(node)) {
    return node.map((item, i) =>
      expandRefs(item, elements, issues, trace, `${path}[${i}]`, imports)
    ) as Json;
  }

  if (!isObject(node)) return node as Json;

  if (typeof node.$ref === "string") {
    const refName = node.$ref as string;
    const colonIdx = refName.indexOf(":");
    let lookupElements = elements;

    if (colonIdx !== -1) {
      const alias = refName.slice(0, colonIdx);
      const elementName = refName.slice(colonIdx + 1);
      const ns = imports?.namespaces.get(alias);
      if (!ns || !ns.elements) {
        issues.push({
          code: "UNKNOWN_IMPORTED_ELEMENT_REFERENCE",
          message: `Unknown imported element reference: ${refName}`,
          path,
          phase: "resolve",
        });
        return node as Json;
      }
      lookupElements = ns.elements as JsonRecord;
      const rawBase = lookupElements[elementName];
      if (rawBase === undefined || !isObject(rawBase)) {
        issues.push({
          code: "UNKNOWN_IMPORTED_ELEMENT_REFERENCE",
          message: `Unknown imported element reference: ${refName}`,
          path,
          phase: "resolve",
        });
        return node as Json;
      }
      // Qualify unqualified token refs in the imported element so they
      // resolve against the source namespace's tokens, not the local file's.
      const base = qualifyTokenRefs(clone(rawBase), alias) as JsonRecord;

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
        ...base,
        ...refArgs,
      };

      const paramNames = Array.isArray((base as Record<string, unknown>).params)
        ? ((base as Record<string, unknown>).params as string[])
        : [];

      const params: JsonRecord = {};
      for (const name of paramNames) {
        params[name] = clone(refArgs[name] ?? merged[name] ?? null);
      }

      return expandRefs(substituteParams(merged, params), elements, issues, trace, path, imports);
    }

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

    return expandRefs(substituteParams(merged, params), elements, issues, trace, path, imports);
  }

  const out: JsonRecord = {};
  for (const [key, child] of Object.entries(node)) {
    out[key] = expandRefs(child, elements, issues, trace, `${path}.${key}`, imports);
  }
  return out;
}

export function resolveDocument(
  document: UXSpecDocument,
  issues: CompilerIssue[] = [],
  trace: CompilerTraceEntry[] = [],
  imports?: ResolvedImports
): UXSpecDocument {
  const cloned = clone(document);
  const expanded = expandRefs(
    cloned,
    (cloned.$elements ?? {}) as JsonRecord,
    issues,
    trace,
    "$",
    imports
  );
  return resolveNodeTokens(
    expanded,
    cloned.$tokens as JsonRecord | undefined,
    issues,
    trace,
    "$",
    imports
  ) as unknown as UXSpecDocument;
}
