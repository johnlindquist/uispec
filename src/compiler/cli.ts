import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "./compile";
import { validateSpec } from "./validate";
import type { UISpecDocument } from "./types";

const cwd = process.cwd();

function isUISpecFile(file: string): boolean {
  return file.endsWith(".uispec.json");
}

async function readDocument(filePath: string): Promise<UISpecDocument> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as UISpecDocument;
}

async function listExampleSpecs(): Promise<string[]> {
  const examplesDir = path.join(cwd, "examples");
  const files = await readdir(examplesDir);
  return files
    .filter(isUISpecFile)
    .sort()
    .map((file) => path.join(examplesDir, file));
}

async function listV02ExampleSpecs(): Promise<string[]> {
  const files = await listExampleSpecs();
  const matching: string[] = [];

  for (const file of files) {
    try {
      const document = await readDocument(file);
      if (document.$schema === "https://uispec.dev/0.2/schema.json") {
        matching.push(file);
      }
    } catch {
      // Let the read failure surface during the actual command run.
    }
  }

  return matching;
}

function getCompileOutputPath(inputPath: string): string {
  const fileName = path.basename(inputPath, ".uispec.json");
  return path.join(cwd, "dist", "compiled", `${fileName}.compiled.json`);
}

async function runValidate(files: string[]): Promise<number> {
  const targets = files.length > 0 ? files : await listV02ExampleSpecs();
  let hasErrors = false;

  for (const file of targets) {
    try {
      const document = await readDocument(file);
      const result = validateSpec(document);
      const relativeFile = path.relative(cwd, file);
      console.log(JSON.stringify({ file: relativeFile, ...result }));
      if (!result.ok) hasErrors = true;
    } catch (error) {
      hasErrors = true;
      console.log(
        JSON.stringify({
          file: path.relative(cwd, file),
          ok: false,
          issues: [
            {
              code: "READ_FAILED",
              path: "$",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        })
      );
    }
  }

  return hasErrors ? 1 : 0;
}

async function runCompile(files: string[]): Promise<number> {
  const targets = files.length > 0 ? files : await listV02ExampleSpecs();

  for (const file of targets) {
    const document = await readDocument(file);
    const compiled = compile(document);
    compiled.$source = path.relative(cwd, file);

    const outputPath = getCompileOutputPath(file);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify({
        input: path.relative(cwd, file),
        output: path.relative(cwd, outputPath),
        states: Object.keys(compiled.states).length,
        assertions: compiled.assertions.length,
      })
    );
  }

  return 0;
}

async function main(): Promise<void> {
  const [, , command, ...files] = process.argv;

  if (command === "validate") {
    process.exitCode = await runValidate(files);
    return;
  }

  if (command === "compile") {
    process.exitCode = await runCompile(files);
    return;
  }

  console.error("Usage: bun run src/compiler/cli.ts <validate|compile> [file...]");
  process.exitCode = 1;
}

void main();
