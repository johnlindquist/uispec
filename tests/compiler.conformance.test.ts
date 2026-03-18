import { describe, expect, it } from "bun:test";
import { compile } from "../src/compiler/compile";
import type { UISpecDocument, CompiledUISpec } from "../src/compiler/types";

function hasAliasLikeString(node: unknown): boolean {
  if (typeof node === "string") {
    return /^\{[A-Za-z0-9_.-]+\}$/.test(node);
  }
  if (Array.isArray(node)) return node.some(hasAliasLikeString);
  if (node && typeof node === "object") {
    return Object.values(node as Record<string, unknown>).some(hasAliasLikeString);
  }
  return false;
}

const doc: UISpecDocument = {
  $schema: "schema",
  $description: "compiler conformance",
  $tokens: {
    color: {
      accent: { $type: "color", $value: "#2563eb" },
    },
    spacing: {
      sm: { $type: "dimension", $value: { value: 8, unit: "px" } },
    },
  } as any,
  $elements: {
    cta: {
      type: "button",
      content: "Save",
      style: {
        background: "{color.accent}",
        padding: "{spacing.sm}",
      },
    },
  } as any,
  $context: {},
  $events: {
    SUBMIT: { source: "user", payload: {} },
    RESET: { source: "user", payload: {} },
  },
  $machine: {
    id: "auth",
    initial: "flow",
    states: {
      flow: {
        initial: "idle",
        on: { RESET: "done" },
        states: {
          idle: {
            on: { SUBMIT: "loading" },
            $visual: {
              slots: {
                content: [{ $ref: "cta" } as any],
              },
            },
          },
          loading: {},
        },
      },
      done: {},
    },
  },
};

function compileOk(document: UISpecDocument): CompiledUISpec {
  const result = compile(document);
  if (!result.ok || !result.compiled) {
    throw new Error(`Expected compile to succeed, got issues: ${JSON.stringify(result.issues)}`);
  }
  return result.compiled;
}

describe("compiler conformance", () => {
  it("resolves machine initial to a leaf path", () => {
    const result = compileOk(doc);
    console.log(JSON.stringify({ check: "leaf-initial", initial: result.initial }));
    expect(result.initial).toBe("flow.idle");
  });

  it("canonicalizes relative targets and inherits parent transitions", () => {
    const result = compileOk(doc);
    const idleTransitions = result.states["flow.idle"].transitions;
    console.log(
      JSON.stringify({
        check: "inherited-transitions",
        transitions: idleTransitions.map((t) => `${t.event}->${t.target}`),
      })
    );
    expect(idleTransitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "SUBMIT", target: "flow.loading" }),
        expect.objectContaining({ event: "RESET", target: "done" }),
      ])
    );
  });

  it("emits flat runtime artifacts with no token aliases or $ref", () => {
    const result = compileOk(doc);
    const serialized = JSON.stringify(result);
    const hasRef = serialized.includes('"$ref"');
    const hasAlias = hasAliasLikeString(result);
    console.log(JSON.stringify({ check: "no-aliases-no-refs", hasRef, hasAlias }));
    expect(serialized).not.toContain('"$ref"');
    expect(hasAlias).toBe(false);
  });
});
