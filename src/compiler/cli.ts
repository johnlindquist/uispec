import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "./compile";
import { makeIssue, traceError } from "./diagnostics";
import { buildStateIndex } from "./state-paths";
import { validateSpec } from "./validate";
import type { CompilerIssue, CompilerTraceEntry, UXSpecDocument } from "./types";

const cwd = process.cwd();

function isUXSpecFile(file: string): boolean {
  return file.endsWith(".uxspec.json");
}

async function readDocument(filePath: string): Promise<UXSpecDocument> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as UXSpecDocument;
}

async function listExampleSpecs(): Promise<string[]> {
  const examplesDir = path.join(cwd, "examples");
  const files = await readdir(examplesDir);
  return files
    .filter(isUXSpecFile)
    .sort()
    .map((file) => path.join(examplesDir, file));
}

async function listV02ExampleSpecs(): Promise<string[]> {
  const files = await listExampleSpecs();
  const matching: string[] = [];

  for (const file of files) {
    try {
      const document = await readDocument(file);
      if (document.$schema === "https://uxspec.dev/0.2/schema.json") {
        matching.push(file);
      }
    } catch {
      // Let the read failure surface during the actual command run.
    }
  }

  return matching;
}

function getCompileOutputPath(inputPath: string): string {
  const fileName = path.basename(inputPath, ".uxspec.json");
  return path.join(cwd, "dist", "compiled", `${fileName}.compiled.json`);
}

function createReadFailedIssue(
  error: unknown,
  phase: "compile" | "validate"
): CompilerIssue {
  return makeIssue(
    "READ_FAILED",
    error instanceof Error ? error.message : String(error),
    "$",
    phase
  );
}

function createReadFailedTrace(
  file: string,
  error: unknown
): CompilerTraceEntry {
  const detail = error instanceof Error ? error.message : String(error);
  const trace: CompilerTraceEntry[] = [];
  traceError(trace, "cli", "io", file, file, "READ_FAILED", detail);
  return trace[0]!;
}

async function runValidate(files: string[], enableTrace: boolean): Promise<number> {
  const targets = files.length > 0 ? files : await listV02ExampleSpecs();
  let hasErrors = false;

  for (const file of targets) {
    const relativeFile = path.relative(cwd, file);

    try {
      const document = await readDocument(file);
      const result = validateSpec(document, { trace: enableTrace });
      console.log(JSON.stringify({ file: relativeFile, ...result }));
      if (!result.ok) hasErrors = true;
    } catch (error) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: relativeFile,
          ok: false,
          issues: [createReadFailedIssue(error, "validate")],
          trace: enableTrace ? [createReadFailedTrace(relativeFile, error)] : [],
        })
      );
    }
  }

  return hasErrors ? 1 : 0;
}

function countCompiledSmells(node: unknown): {
  unresolvedRefs: number;
  unresolvedTokenAliases: number;
} {
  let unresolvedRefs = 0;
  let unresolvedTokenAliases = 0;

  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (/^\{[A-Za-z0-9_.-]+\}$/.test(value)) {
        unresolvedTokenAliases++;
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.$ref === "string") {
        unresolvedRefs++;
      }
      for (const child of Object.values(record)) visit(child);
    }
  };

  visit(node);
  return { unresolvedRefs, unresolvedTokenAliases };
}

async function runCompile(files: string[], enableTrace: boolean): Promise<number> {
  const targets = files.length > 0 ? files : await listV02ExampleSpecs();
  let hasErrors = false;

  for (const file of targets) {
    const relativeFile = path.relative(cwd, file);

    let document: UXSpecDocument;
    try {
      document = await readDocument(file);
    } catch (error) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: relativeFile,
          ok: false,
          issues: [createReadFailedIssue(error, "compile")],
          trace: enableTrace ? [createReadFailedTrace(relativeFile, error)] : [],
        })
      );
      continue;
    }

    const result = compile(document, { trace: enableTrace });

    if (!result.ok) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: relativeFile,
          ok: false,
          issues: result.issues,
          trace: result.trace,
        })
      );
      continue;
    }

    const compiled = result.compiled!;
    compiled.$source = relativeFile;

    const outputPath = getCompileOutputPath(file);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");

    const smells = countCompiledSmells(compiled);
    const leafInitial = Object.prototype.hasOwnProperty.call(
      compiled.states,
      compiled.initial
    );

    console.log(
      JSON.stringify({
        file: relativeFile,
        ok: true,
        output: path.relative(cwd, outputPath),
        states: Object.keys(compiled.states).length,
        assertions: compiled.assertions.length,
        unresolvedRefs: smells.unresolvedRefs,
        unresolvedTokenAliases: smells.unresolvedTokenAliases,
        leafInitial,
        trace: result.trace,
      })
    );

    if (
      !leafInitial ||
      smells.unresolvedRefs > 0 ||
      smells.unresolvedTokenAliases > 0
    ) {
      hasErrors = true;
    }
  }

  return hasErrors ? 1 : 0;
}

async function runInspect(files: string[], enableTrace: boolean): Promise<number> {
  const targets = files.length > 0 ? files : await listV02ExampleSpecs();
  let hasErrors = false;

  for (const file of targets) {
    const relativeFile = path.relative(cwd, file);

    let document: UXSpecDocument;
    try {
      document = await readDocument(file);
    } catch (error) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: relativeFile,
          ok: false,
          views: null,
          issues: [createReadFailedIssue(error, "compile")],
          trace: enableTrace ? [createReadFailedTrace(relativeFile, error)] : [],
        })
      );
      continue;
    }

    const result = compile(document, { trace: enableTrace });
    if (!result.ok || !result.compiled) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: relativeFile,
          ok: false,
          views: null,
          issues: result.issues,
          trace: result.trace,
        })
      );
      continue;
    }

    const indexIssues: CompilerIssue[] = [];
    const indexTrace: CompilerTraceEntry[] = [];
    const index = buildStateIndex(document.$machine.states, indexIssues, indexTrace);
    const smells = countCompiledSmells(result.compiled);
    const leafInitial = Object.prototype.hasOwnProperty.call(
      result.compiled.states,
      result.compiled.initial
    );

    const stateGraph = Object.fromEntries(
      Object.entries(result.compiled.states).map(([state, compiledState]) => [
        state,
        compiledState.transitions.map((transition) => ({
          event: transition.event,
          target: transition.target,
          guarded: transition.guard !== null,
          actionCount: transition.actions.length,
        })),
      ])
    );

    const visualTree = Object.fromEntries(
      Object.entries(result.compiled.states).map(([state, compiledState]) => [
        state,
        compiledState.visual,
      ])
    );

    console.log(
      JSON.stringify({
        file: relativeFile,
        ok: true,
        views: {
          resolvedInitial: result.compiled.initial,
          stateIndex: {
            all: [...index.all].sort(),
            leaf: [...index.leaf].sort(),
          },
          stateGraph,
          visualTree,
          assertions: result.compiled.assertions,
          conformance: {
            leafInitial,
            unresolvedRefs: smells.unresolvedRefs,
            unresolvedTokenAliases: smells.unresolvedTokenAliases,
            issueCount: indexIssues.length + result.issues.length,
          },
        },
        issues: [...indexIssues, ...result.issues],
        trace: enableTrace ? [...indexTrace, ...result.trace] : [],
      })
    );
  }

  return hasErrors ? 1 : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const enableTrace = args.includes("--trace");
  const files = args.slice(1).filter((a) => a !== "--trace");

  if (command === "validate") {
    process.exitCode = await runValidate(files, enableTrace);
    return;
  }

  if (command === "compile") {
    process.exitCode = await runCompile(files, enableTrace);
    return;
  }

  if (command === "inspect") {
    process.exitCode = await runInspect(files, enableTrace);
    return;
  }

  console.error("Usage: bun run src/compiler/cli.ts <validate|compile|inspect> [--trace] [file...]");
  process.exitCode = 1;
}

void main();
