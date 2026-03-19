import { describe, expect, it } from "bun:test";
import { spawnSync } from "bun";

describe("compiler CLI", () => {
  it("prints structured failure JSON for invalid specs", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "compile",
      "tests/fixtures/bad-initial.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.issues[0].code).toBe("INVALID_MACHINE_INITIAL");
  });

  it("prints structured success JSON for valid specs", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "compile",
      "examples/02-auth-flow.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(0);
    expect(json.ok).toBe(true);
    expect(json).toHaveProperty("file");
    expect(json).toHaveProperty("output");
    expect(json).toHaveProperty("states");
    expect(json).toHaveProperty("leafInitial");
  });

  it("validate prints trace field in output", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "validate",
      "examples/02-auth-flow.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(0);
    expect(json.ok).toBe(true);
    expect(json).toHaveProperty("trace");
    expect(Array.isArray(json.trace)).toBe(true);
  });

  it("validate includes trace data with --trace flag", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "validate",
      "--trace",
      "examples/02-auth-flow.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(0);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.trace)).toBe(true);
    expect(json.trace.length).toBeGreaterThan(0);
  });

  it("validate emits READ_FAILED issue for missing file", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "validate",
      "tests/fixtures/nonexistent.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.issues[0].code).toBe("READ_FAILED");
  });

  it("compile emits READ_FAILED issue for missing file", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "compile",
      "tests/fixtures/nonexistent.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.issues[0].code).toBe("READ_FAILED");
  });

  it("includes trace data with --trace flag", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "compile",
      "--trace",
      "examples/02-auth-flow.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(0);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.trace)).toBe(true);
    expect(json.trace.length).toBeGreaterThan(0);
  });

  it("inspect prints JSON with views for valid specs", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "inspect",
      "--trace",
      "examples/02-auth-flow.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(0);
    expect(json.ok).toBe(true);
    expect(json.views).toHaveProperty("resolvedInitial");
    expect(json.views).toHaveProperty("stateIndex");
    expect(json.views).toHaveProperty("stateGraph");
    expect(json.views).toHaveProperty("visualTree");
    expect(json.views).toHaveProperty("assertions");
    expect(json.views).toHaveProperty("conformance");
    expect(json.views.conformance.leafInitial).toBe(true);
    expect(json.views.conformance.unresolvedRefs).toBe(0);
    expect(json.views.conformance.unresolvedTokenAliases).toBe(0);
    expect(Array.isArray(json.views.stateIndex.all)).toBe(true);
    expect(Array.isArray(json.views.stateIndex.leaf)).toBe(true);
    expect(Array.isArray(json.trace)).toBe(true);
    expect(json.trace.length).toBeGreaterThan(0);
  });

  it("inspect returns ok:false with views:null for invalid specs", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "inspect",
      "tests/fixtures/bad-initial.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.views).toBeNull();
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it("inspect returns ok:false for unreadable files", () => {
    const proc = spawnSync([
      "bun",
      "run",
      "src/compiler/cli.ts",
      "inspect",
      "tests/fixtures/nonexistent.uxspec.json",
    ]);

    const line = proc.stdout.toString().trim().split("\n").at(-1)!;
    const json = JSON.parse(line);

    expect(proc.exitCode).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.views).toBeNull();
    expect(json.issues[0].code).toBe("READ_FAILED");
  });
});
