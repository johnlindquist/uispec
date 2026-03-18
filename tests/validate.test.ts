import { describe, expect, it } from "bun:test";
import { validateSpec } from "../src/compiler/validate";
import type { UISpecDocument } from "../src/compiler/types";

function minimalDoc(overrides: Partial<UISpecDocument> = {}): UISpecDocument {
  return {
    $schema: "https://uispec.dev/0.2/schema.json",
    $description: "test",
    $context: {},
    $events: {},
    $machine: {
      id: "test",
      initial: "idle",
      states: {
        idle: {},
      },
    },
    ...overrides,
  };
}

describe("validateSpec", () => {
  it("returns ok for a valid minimal spec", () => {
    const result = validateSpec(minimalDoc());
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("is deterministic: same input produces same output", () => {
    const doc = minimalDoc({
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            on: {
              SUBMIT: { target: "missing", guard: ["==", ["var", "context.email"], ""] },
            },
          },
        },
      },
    });
    const r1 = validateSpec(doc);
    const r2 = validateSpec(doc);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  describe("UNDECLARED_CONTEXT_VAR", () => {
    it("detects undeclared context variable in guard", () => {
      const result = validateSpec(
        minimalDoc({
          $context: {},
          $events: { SUBMIT: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  SUBMIT: {
                    target: "idle",
                    guard: ["==", ["var", "context.email"], ""],
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_CONTEXT_VAR",
          message: "Context variable not declared: context.email",
        })
      );
    });

    it("passes when context variable is declared", () => {
      const result = validateSpec(
        minimalDoc({
          $context: { email: { type: "string", default: "" } },
          $events: { SUBMIT: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  SUBMIT: {
                    target: "idle",
                    guard: ["==", ["var", "context.email"], ""],
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("UNDECLARED_EVENT", () => {
    it("detects undeclared event in transition", () => {
      const result = validateSpec(
        minimalDoc({
          $events: {},
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: { SUBMIT: "idle" },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_EVENT",
          path: "$machine.states.idle.on.SUBMIT",
        })
      );
    });

    it("detects undeclared event in emit action", () => {
      const result = validateSpec(
        minimalDoc({
          $events: { CLICK: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  CLICK: {
                    target: "idle",
                    actions: [{ kind: "emit", event: "UNKNOWN" }],
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_EVENT",
          message: "Event not declared in $events: UNKNOWN",
        })
      );
    });
  });

  describe("UNDECLARED_TARGET", () => {
    it("detects target that does not exist", () => {
      const result = validateSpec(
        minimalDoc({
          $events: { GO: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: { GO: "nonexistent" },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_TARGET",
          phase: "state-paths",
        })
      );
    });

    it("resolves nested state paths", () => {
      const result = validateSpec(
        minimalDoc({
          $events: { GO: { source: "user" } },
          $machine: {
            id: "test",
            initial: "parent",
            states: {
              parent: {
                initial: "child",
                states: {
                  child: {
                    on: { GO: "parent.child" },
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("UNSUPPORTED_EXPR_OP", () => {
    it("detects unsupported operator", () => {
      const result = validateSpec(
        minimalDoc({
          $events: { GO: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  GO: {
                    target: "idle",
                    guard: ["NOPE", 1, 2] as any,
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNSUPPORTED_EXPR_OP",
          message: "Unsupported expression operator: NOPE",
        })
      );
    });

    it("accepts all supported operators", () => {
      const ops = [
        "var", "get", "+", "-", "*", "/", "pow", "min", "max",
        "==", "!=", "<", "<=", ">", ">=", "!", "&&", "||", "coalesce",
      ];
      for (const op of ops) {
        const args = op === "!" ? [true] : op === "var" ? ["context.x"] : [1, 2];
        const result = validateSpec(
          minimalDoc({
            $context: { x: { type: "string" } },
            $events: { GO: { source: "user" } },
            $machine: {
              id: "test",
              initial: "idle",
              states: {
                idle: {
                  on: {
                    GO: {
                      target: "idle",
                      guard: [op, ...args] as any,
                    },
                  },
                },
              },
            },
          })
        );
        const exprIssues = result.issues.filter(
          (i) => i.code === "UNSUPPORTED_EXPR_OP"
        );
        expect(exprIssues).toEqual([]);
      }
    });
  });

  describe("INVALID_ASSIGN_PATH", () => {
    it("detects assign path not starting with context.", () => {
      const result = validateSpec(
        minimalDoc({
          $events: { GO: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  GO: {
                    target: "idle",
                    actions: [{ kind: "assign", path: "email", value: "" }],
                  },
                },
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "INVALID_ASSIGN_PATH",
        })
      );
    });
  });

  describe("entry/exit validation", () => {
    it("validates actions in entry arrays", () => {
      const result = validateSpec(
        minimalDoc({
          $events: {},
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                entry: [{ kind: "emit", event: "MISSING" }],
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_EVENT",
        })
      );
    });
  });

  describe("always transitions", () => {
    it("validates targets in always transitions", () => {
      const result = validateSpec(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                always: [{ target: "nowhere", guard: null, actions: [] }],
              },
            },
          },
        })
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "UNDECLARED_TARGET",
          phase: "state-paths",
        })
      );
    });
  });

  describe("combined failure case", () => {
    it("reports multiple issues for a malformed spec", () => {
      const result = validateSpec({
        $schema: "https://uispec.dev/0.2/schema.json",
        $description: "bad example",
        $context: {},
        $events: {},
        $machine: {
          id: "bad",
          initial: "idle",
          states: {
            idle: {
              on: {
                SUBMIT: {
                  target: "missing",
                  guard: ["==", ["var", "context.email"], ""],
                },
              },
            },
          },
        },
      } as any);

      expect(result.ok).toBe(false);
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain("UNDECLARED_EVENT");
      expect(codes).toContain("UNDECLARED_TARGET");
      expect(codes).toContain("UNDECLARED_CONTEXT_VAR");
    });
  });
});
