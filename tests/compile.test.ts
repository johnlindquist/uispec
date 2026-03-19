import { describe, expect, it } from "bun:test";
import { compile } from "../src/compiler/compile";
import type { UXSpecDocument, CompiledUXSpec } from "../src/compiler/types";

function minimalDoc(overrides: Partial<UXSpecDocument> = {}): UXSpecDocument {
  return {
    $schema: "https://raw.githubusercontent.com/johnlindquist/uxspec/main/schema/uxspec.schema.json",
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

function compileOk(doc: UXSpecDocument): CompiledUXSpec {
  const result = compile(doc);
  if (!result.ok || !result.compiled) {
    throw new Error(`Expected compile to succeed, got issues: ${JSON.stringify(result.issues)}`);
  }
  return result.compiled;
}

describe("compile", () => {
  it("emits $format and $version", () => {
    const result = compileOk(minimalDoc());
    expect(result.$format).toBe("uxspec-compiled");
    expect(result.$version).toBe("0.2");
  });

  it("emits initial state", () => {
    const result = compileOk(minimalDoc());
    expect(result.initial).toBe("idle");
  });

  it("emits contextSchema from $context", () => {
    const result = compileOk(
      minimalDoc({
        $context: {
          email: { type: "string", default: "" },
          submitting: { type: "boolean", default: false },
        },
      })
    );
    expect(result.contextSchema).toEqual({
      email: { type: "string", default: "" },
      submitting: { type: "boolean", default: false },
    });
  });

  it("emits eventSchema from $events", () => {
    const result = compileOk(
      minimalDoc({
        $events: {
          SUBMIT: { source: "user", payload: {} },
        },
      })
    );
    expect(result.eventSchema).toEqual({
      SUBMIT: { source: "user", payload: {} },
    });
  });

  it("defaults contextSchema and eventSchema to empty objects", () => {
    const doc = minimalDoc();
    delete doc.$context;
    delete doc.$events;
    const result = compileOk(doc);
    expect(result.contextSchema).toEqual({});
    expect(result.eventSchema).toEqual({});
  });

  describe("state compilation", () => {
    it("compiles leaf states with visual", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                $visual: { $description: "Ready" },
              },
            },
          },
        })
      );
      expect(result.states.idle).toEqual({
        path: "idle",
        visual: { $description: "Ready" },
        transitions: [],
        entry: [],
        exit: [],
        invoke: [],
      });
    });

    it("preserves transitions with guards and actions", () => {
      const result = compileOk(
        minimalDoc({
          $context: { submitting: { type: "boolean", default: false } },
          $events: { SUBMIT: { source: "user" } },
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                on: {
                  SUBMIT: {
                    target: "submitting",
                    guard: ["==", ["var", "context.submitting"], false],
                    actions: [
                      {
                        kind: "assign",
                        path: "context.submitting",
                        value: true,
                      },
                    ],
                  },
                },
              },
              submitting: {
                $visual: { $description: "Spinner visible" },
              },
            },
          },
        })
      );
      expect(result.states.idle.transitions).toEqual([
        {
          event: "SUBMIT",
          target: "submitting",
          guard: ["==", ["var", "context.submitting"], false],
          actions: [
            { kind: "assign", path: "context.submitting", value: true },
          ],
        },
      ]);
    });

    it("normalizes string transitions to full form", () => {
      const result = compileOk(
        minimalDoc({
          $events: { GO: { source: "user" } },
          $machine: {
            id: "test",
            initial: "a",
            states: {
              a: { on: { GO: "b" } },
              b: {},
            },
          },
        })
      );
      expect(result.states.a.transitions).toEqual([
        { event: "GO", target: "b", guard: null, actions: [] },
      ]);
    });

    it("preserves entry and exit actions", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "loading",
            states: {
              loading: {
                entry: [{ kind: "http", request: "loadResource" }],
                exit: [
                  {
                    kind: "log",
                    level: "info",
                    message: "leaving_loading",
                  },
                ],
              },
            },
          },
        })
      );
      expect(result.states.loading.entry).toEqual([
        { kind: "http", request: "loadResource" },
      ]);
      expect(result.states.loading.exit).toEqual([
        { kind: "log", level: "info", message: "leaving_loading" },
      ]);
    });

    it("compiles always (transient) transitions with null event", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "check",
            states: {
              check: {
                always: [
                  {
                    target: "done",
                    guard: ["==", true, true],
                    actions: [],
                  },
                ],
              },
              done: {},
            },
          },
        })
      );
      expect(result.states.check.transitions).toEqual([
        {
          event: null,
          target: "done",
          guard: ["==", true, true],
          actions: [],
        },
      ]);
    });
  });

  describe("nested state flattening", () => {
    it("flattens nested states to dot-separated keys", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "parent",
            states: {
              parent: {
                initial: "child",
                states: {
                  child: {
                    $visual: { $description: "Nested" },
                  },
                },
              },
            },
          },
        })
      );
      expect(result.states["parent.child"]).toBeDefined();
      expect(result.states["parent"]).toBeUndefined();
      expect(result.states["parent.child"].path).toBe("parent.child");
    });

    it("inherits parent visual into child", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "parent",
            states: {
              parent: {
                $visual: {
                  $description: "Parent desc",
                  container: { background: "#fff" },
                },
                initial: "child",
                states: {
                  child: {
                    $visual: { $description: "Child desc" },
                  },
                },
              },
            },
          },
        })
      );
      const child = result.states["parent.child"];
      expect(child.visual.$description).toBe("Child desc");
      expect(child.visual.container).toEqual({ background: "#fff" });
    });

    it("child slots override parent slots", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "parent",
            states: {
              parent: {
                $visual: {
                  slots: { main: [{ type: "text", name: "parent" }] },
                },
                initial: "child",
                states: {
                  child: {
                    $visual: {
                      slots: { main: [{ type: "text", name: "child" }] },
                    },
                  },
                },
              },
            },
          },
        })
      );
      const child = result.states["parent.child"];
      expect(child.visual.slots).toEqual({
        main: [{ type: "text", name: "child" }],
      });
    });

    it("inherits parent entry/exit into children", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "parent",
            states: {
              parent: {
                entry: [
                  {
                    kind: "log",
                    level: "info",
                    message: "enter_parent",
                  },
                ],
                exit: [
                  {
                    kind: "log",
                    level: "info",
                    message: "exit_parent",
                  },
                ],
                initial: "child",
                states: {
                  child: {
                    entry: [
                      {
                        kind: "log",
                        level: "info",
                        message: "enter_child",
                      },
                    ],
                  },
                },
              },
            },
          },
        })
      );
      const child = result.states["parent.child"];
      expect(child.entry).toEqual([
        { kind: "log", level: "info", message: "enter_parent" },
        { kind: "log", level: "info", message: "enter_child" },
      ]);
      expect(child.exit).toEqual([
        { kind: "log", level: "info", message: "exit_parent" },
      ]);
    });

    it("deeply nested states flatten correctly", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "a",
            states: {
              a: {
                initial: "b",
                states: {
                  b: {
                    initial: "c",
                    states: {
                      c: { $visual: { $description: "deep" } },
                    },
                  },
                },
              },
            },
          },
        })
      );
      expect(result.states["a.b.c"]).toBeDefined();
      expect(result.states["a.b.c"].path).toBe("a.b.c");
      expect(result.states["a.b.c"].visual.$description).toBe("deep");
    });
  });

  describe("machine-level visual inheritance", () => {
    it("inherits $machine.$visual into top-level states", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "idle",
            $visual: { container: { padding: 16 } },
            states: {
              idle: {
                $visual: { $description: "Idle state" },
              },
            },
          },
        })
      );
      expect(result.states.idle.visual).toEqual({
        container: { padding: 16 },
        $description: "Idle state",
      });
    });
  });

  describe("idempotency", () => {
    it("produces identical output on repeated calls", () => {
      const doc = minimalDoc({
        $context: { x: { type: "string", default: "" } },
        $events: { GO: { source: "user" } },
        $machine: {
          id: "test",
          initial: "a",
          states: {
            a: {
              $visual: { $description: "A" },
              on: { GO: { target: "b", actions: [{ kind: "assign", path: "context.x", value: "done" }] } },
            },
            b: { $visual: { $description: "B" } },
          },
        },
      });
      const r1 = compile(doc);
      const r2 = compile(doc);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });

  describe("full integration", () => {
    it("compiles the submit flow example from the research context", () => {
      const doc: UXSpecDocument = {
        $schema: "https://raw.githubusercontent.com/johnlindquist/uxspec/main/schema/uxspec.schema.json",
        $description: "submit flow",
        $context: {
          submitting: { type: "boolean", default: false },
        },
        $events: {
          SUBMIT: { source: "user", payload: {} },
        },
        $machine: {
          id: "auth",
          initial: "idle",
          $visual: { $description: "root" },
          states: {
            idle: {
              $visual: { $description: "ready" },
              on: {
                SUBMIT: {
                  target: "submitting",
                  actions: [
                    {
                      kind: "assign",
                      path: "context.submitting",
                      value: true,
                    },
                  ],
                },
              },
            },
            submitting: {
              $visual: { $description: "spinner" },
            },
          },
        },
      };

      const result = compileOk(doc);

      expect(result.$format).toBe("uxspec-compiled");
      expect(result.$version).toBe("0.2");
      expect(result.initial).toBe("idle");
      expect(result.contextSchema).toEqual({
        submitting: { type: "boolean", default: false },
      });
      expect(result.eventSchema).toEqual({
        SUBMIT: { source: "user", payload: {} },
      });
      expect(Object.keys(result.states)).toEqual(["idle", "submitting"]);
      expect(result.states.idle.transitions[0]).toEqual({
        event: "SUBMIT",
        target: "submitting",
        guard: null,
        actions: [
          { kind: "assign", path: "context.submitting", value: true },
        ],
      });
      expect(result.states.submitting.visual.$description).toBe("spinner");
    });
  });

  describe("invoke preservation", () => {
    it("preserves invoke array on leaf states", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "active",
            states: {
              active: {
                invoke: [
                  { src: "pollingService", id: "poller" },
                ],
              },
            },
          },
        })
      );
      expect(result.states.active.invoke).toEqual([
        { src: "pollingService", id: "poller" },
      ]);
    });

    it("defaults invoke to empty array when not defined", () => {
      const result = compileOk(minimalDoc());
      expect(result.states.idle.invoke).toEqual([]);
    });
  });

  describe("assertions extraction", () => {
    it("extracts testId from visual slots into assertions", () => {
      const result = compileOk(
        minimalDoc({
          $machine: {
            id: "test",
            initial: "idle",
            states: {
              idle: {
                $visual: {
                  slots: {
                    main: [
                      { type: "button", name: "submit", testId: "auth-submit" },
                    ],
                  },
                },
              },
            },
          },
        })
      );
      expect(result.assertions).toEqual([
        {
          id: "auth-submit-exists",
          type: "element-present",
          testId: "auth-submit",
        },
      ]);
    });

    it("returns empty assertions when no testIds exist", () => {
      const result = compileOk(minimalDoc());
      expect(result.assertions).toEqual([]);
    });
  });
});
