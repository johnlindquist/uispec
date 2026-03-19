import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { makeIssue, traceError, traceOk } from "./diagnostics";
import type {
  CompilerIssue,
  CompilerTraceEntry,
  Json,
  ResolvedImportNamespace,
  ResolvedImports,
  UXSpecDocument,
} from "./types";

export async function resolveImports(
  document: UXSpecDocument,
  documentPath: string,
  issues: CompilerIssue[],
  trace: CompilerTraceEntry[],
  ancestorPaths?: Set<string>
): Promise<ResolvedImports> {
  const result: ResolvedImports = { namespaces: new Map() };
  const imports = document.$imports;
  if (!imports || Object.keys(imports).length === 0) return result;

  const docDir = nodePath.dirname(documentPath);
  const ancestors = ancestorPaths ?? new Set<string>();
  ancestors.add(nodePath.resolve(documentPath));

  for (const [alias, spec] of Object.entries(imports)) {
    if (!spec.from) {
      issues.push(
        makeIssue(
          "INVALID_IMPORT_SPEC",
          `Import "${alias}" is missing required "from" field`,
          `$imports.${alias}`,
          "import"
        )
      );
      continue;
    }

    if (!spec.tokens && !spec.elements && !spec.animations && !spec.machine) {
      issues.push(
        makeIssue(
          "INVALID_IMPORT_SPEC",
          `Import "${alias}" must request at least one of: tokens, elements, animations, machine`,
          `$imports.${alias}`,
          "import"
        )
      );
      continue;
    }

    const resolvedPath = nodePath.resolve(docDir, spec.from);

    if (ancestors.has(resolvedPath)) {
      issues.push(
        makeIssue(
          "IMPORT_CYCLE",
          `Import cycle detected: "${alias}" (${spec.from})`,
          `$imports.${alias}`,
          "import"
        )
      );
      traceError(
        trace,
        "import",
        "import",
        `$imports.${alias}`,
        spec.from,
        "IMPORT_CYCLE",
        `Cycle: file already in ancestor chain`
      );
      continue;
    }

    let raw: string;
    try {
      raw = await readFile(resolvedPath, "utf8");
    } catch (error: unknown) {
      const isNotFound =
        error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
      issues.push(
        makeIssue(
          isNotFound ? "IMPORT_NOT_FOUND" : "IMPORT_READ_FAILED",
          `Cannot read import "${alias}": ${error instanceof Error ? error.message : String(error)}`,
          `$imports.${alias}.from`,
          "import"
        )
      );
      traceError(
        trace,
        "import",
        "import",
        `$imports.${alias}.from`,
        spec.from,
        isNotFound ? "IMPORT_NOT_FOUND" : "IMPORT_READ_FAILED",
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }

    let importedDoc: UXSpecDocument;
    try {
      importedDoc = JSON.parse(raw) as UXSpecDocument;
    } catch (error: unknown) {
      issues.push(
        makeIssue(
          "IMPORT_PARSE_FAILED",
          `Cannot parse import "${alias}": ${error instanceof Error ? error.message : String(error)}`,
          `$imports.${alias}.from`,
          "import"
        )
      );
      traceError(
        trace,
        "import",
        "import",
        `$imports.${alias}.from`,
        spec.from,
        "IMPORT_PARSE_FAILED",
        error instanceof Error ? error.message : String(error)
      );
      continue;
    }

    const ns: ResolvedImportNamespace = {
      alias,
      sourcePath: resolvedPath,
    };

    if (spec.tokens && importedDoc.$tokens) {
      ns.tokens = importedDoc.$tokens as Record<string, Json>;
    }
    if (spec.elements && importedDoc.$elements) {
      ns.elements = importedDoc.$elements as Record<string, Json>;
    }
    if (spec.animations && importedDoc.$animations) {
      ns.animations = importedDoc.$animations as Record<string, Json>;
    }
    if (spec.machine && importedDoc.$machine) {
      ns.machineId = importedDoc.$machine.id;
      ns.machineDocument = importedDoc;
    }

    result.namespaces.set(alias, ns);
    traceOk(
      trace,
      "import",
      "import",
      `$imports.${alias}`,
      spec.from,
      resolvedPath
    );
  }

  return result;
}
