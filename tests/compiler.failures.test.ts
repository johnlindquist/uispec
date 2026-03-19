import { describe, expect, it } from "bun:test";
import { compile } from "../src/compiler/compile";

describe("compiler failure diagnostics", () => {
  it("returns INVALID_MACHINE_INITIAL instead of throwing", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "bad initial",
      $machine: {
        id: "test",
        initial: "missing",
        states: { idle: {} },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.compiled).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_MACHINE_INITIAL",
        path: "$machine.initial",
        phase: "state-paths",
      })
    );
  });

  it("returns UNKNOWN_ELEMENT_REFERENCE instead of throwing", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "bad ref",
      $elements: {},
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            $visual: {
              slots: {
                content: [{ $ref: "missing-element" }],
              },
            },
          },
        },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_ELEMENT_REFERENCE",
        phase: "resolve",
      })
    );
  });

  it("returns UNKNOWN_TOKEN_REFERENCE instead of throwing", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "bad token",
      $tokens: {},
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            $visual: {
              container: { color: "{color.missing}" },
            },
          },
        },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_TOKEN_REFERENCE",
        phase: "resolve",
      })
    );
  });

  it("returns INVALID_COMPOUND_INITIAL for bad compound state initial", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "bad compound initial",
      $machine: {
        id: "test",
        initial: "parent",
        states: {
          parent: {
            initial: "nonexistent",
            states: {
              child: {},
            },
          },
        },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "INVALID_COMPOUND_INITIAL",
        phase: "state-paths",
      })
    );
  });

  it("returns UNDECLARED_TARGET for bad transition target", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "bad target",
      $events: { GO: { source: "user" } },
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            on: { GO: "nowhere" },
          },
        },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "UNDECLARED_TARGET",
        phase: "state-paths",
      })
    );
  });

  it("includes trace entries when trace option is enabled", () => {
    const result = compile(
      {
        $schema: "https://uxspec.dev/0.2/schema.json",
        $description: "trace test",
        $tokens: {
          color: { accent: { $type: "color", $value: "#ff0000" } },
        } as any,
        $machine: {
          id: "test",
          initial: "idle",
          states: { idle: {} },
        },
      } as any,
      { trace: true }
    );

    expect(result.ok).toBe(true);
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.trace[0]).toHaveProperty("phase");
    expect(result.trace[0]).toHaveProperty("kind");
    expect(result.trace[0]).toHaveProperty("path");
  });

  it("returns empty trace when trace option is disabled", () => {
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "no trace",
      $machine: {
        id: "test",
        initial: "idle",
        states: { idle: {} },
      },
    } as any);

    expect(result.ok).toBe(true);
    expect(result.trace).toEqual([]);
  });

  it("emits failure trace for invalid machine initial", () => {
    const result = compile(
      {
        $schema: "https://uxspec.dev/0.2/schema.json",
        $description: "bad initial",
        $machine: {
          id: "test",
          initial: "missing",
          states: { idle: {} },
        },
      } as any,
      { trace: true }
    );

    expect(result.ok).toBe(false);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        phase: "state-paths",
        kind: "initial",
        status: "error",
        code: "INVALID_MACHINE_INITIAL",
        path: "$machine.initial",
        input: "missing",
      })
    );
  });

  it("emits failure trace for unresolved target", () => {
    const result = compile(
      {
        $schema: "https://uxspec.dev/0.2/schema.json",
        $description: "bad target",
        $events: { GO: { source: "user" } },
        $machine: {
          id: "test",
          initial: "idle",
          states: {
            idle: { on: { GO: "nowhere" } },
          },
        },
      } as any,
      { trace: true }
    );

    expect(result.ok).toBe(false);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        phase: "state-paths",
        kind: "target",
        status: "error",
        code: "UNDECLARED_TARGET",
        input: "nowhere",
      })
    );
  });

  it("includes attempts array in target failure trace", () => {
    const result = compile(
      {
        $schema: "https://uxspec.dev/0.2/schema.json",
        $description: "bad target with attempts",
        $events: { GO: { source: "user" } },
        $machine: {
          id: "test",
          initial: "idle",
          states: {
            idle: { on: { GO: "nowhere" } },
          },
        },
      } as any,
      { trace: true }
    );

    const targetTrace = result.trace.find(
      (t) => t.kind === "target" && t.status === "error"
    );
    expect(targetTrace).toBeDefined();
    expect(targetTrace!.attempts).toBeDefined();
    expect(targetTrace!.attempts!.length).toBeGreaterThan(0);
    expect(targetTrace!.attempts).toContain("nowhere");
  });

  it("emits success trace entries with status ok", () => {
    const result = compile(
      {
        $schema: "https://uxspec.dev/0.2/schema.json",
        $description: "good trace",
        $events: { GO: { source: "user" } },
        $machine: {
          id: "test",
          initial: "idle",
          states: {
            idle: { on: { GO: "idle" } },
          },
        },
      } as any,
      { trace: true }
    );

    expect(result.ok).toBe(true);
    expect(result.trace.length).toBeGreaterThan(0);
    for (const entry of result.trace) {
      expect(entry.status).toBe("ok");
    }
  });

  it("never throws for any combination of authoring errors", () => {
    // This should NOT throw - it should return structured issues
    const result = compile({
      $schema: "https://uxspec.dev/0.2/schema.json",
      $description: "everything wrong",
      $tokens: {},
      $elements: {},
      $machine: {
        id: "test",
        initial: "missing",
        states: {
          idle: {
            $visual: {
              slots: {
                content: [{ $ref: "nope" }],
              },
              container: { color: "{color.nope}" },
            },
          },
        },
      },
    } as any);

    expect(result.ok).toBe(false);
    expect(result.compiled).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue).toHaveProperty("code");
      expect(issue).toHaveProperty("message");
      expect(issue).toHaveProperty("path");
      expect(issue).toHaveProperty("phase");
    }
  });
});
