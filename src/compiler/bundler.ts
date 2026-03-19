import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { compile } from "./compile";
import { resolveImports } from "./import-resolver";
import type {
  BundledUXSpec,
  CompiledUXSpec,
  CompilerIssue,
  CompilerTraceEntry,
  UXSpecDocument,
} from "./types";

export interface BundleResult {
  ok: boolean;
  bundled: BundledUXSpec | null;
  issues: CompilerIssue[];
  trace: CompilerTraceEntry[];
}

export async function bundle(
  entryPath: string,
  options: { trace?: boolean } = {}
): Promise<BundleResult> {
  const issues: CompilerIssue[] = [];
  const trace: CompilerTraceEntry[] = [];
  const absoluteEntry = nodePath.resolve(entryPath);

  let entryDoc: UXSpecDocument;
  try {
    const raw = await readFile(absoluteEntry, "utf8");
    entryDoc = JSON.parse(raw) as UXSpecDocument;
  } catch (error) {
    issues.push({
      code: "IMPORT_READ_FAILED",
      message: `Cannot read entry file: ${error instanceof Error ? error.message : String(error)}`,
      path: "$",
      phase: "import",
    });
    return { ok: false, bundled: null, issues, trace };
  }

  // Resolve imports for entry
  const imports = await resolveImports(entryDoc, absoluteEntry, issues, trace);
  if (issues.length > 0) {
    return { ok: false, bundled: null, issues, trace };
  }

  // Compile entry
  const entryResult = compile(entryDoc, { trace: options.trace, imports });
  if (!entryResult.ok || !entryResult.compiled) {
    return {
      ok: false,
      bundled: null,
      issues: entryResult.issues,
      trace: entryResult.trace,
    };
  }

  const modules: Record<string, CompiledUXSpec> = {};
  const entryId = entryDoc.$machine.id;
  modules[entryId] = entryResult.compiled;

  // Compile each dependency
  for (const ns of imports.namespaces.values()) {
    if (!ns.machineDocument) continue;

    const depDoc = ns.machineDocument;
    const depIssues: CompilerIssue[] = [];
    const depTrace: CompilerTraceEntry[] = [];

    // Resolve the dependency's own imports
    const depImports = await resolveImports(depDoc, ns.sourcePath, depIssues, depTrace);
    if (depIssues.length > 0) {
      issues.push(...depIssues);
      trace.push(...depTrace);
      return { ok: false, bundled: null, issues, trace };
    }

    const depResult = compile(depDoc, { trace: options.trace, imports: depImports });
    if (!depResult.ok || !depResult.compiled) {
      issues.push(...depResult.issues);
      trace.push(...depResult.trace);
      return { ok: false, bundled: null, issues, trace };
    }

    modules[depDoc.$machine.id] = depResult.compiled;
  }

  const bundled: BundledUXSpec = {
    $format: "uxspec-bundled",
    $version: "0.2",
    entry: entryId,
    modules,
  };

  return { ok: true, bundled, issues: [], trace: options.trace ? trace : [] };
}
