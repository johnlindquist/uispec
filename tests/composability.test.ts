import { describe, expect, it } from "bun:test";
import path from "node:path";
import { compile } from "../src/compiler/compile";
import { resolveImports } from "../src/compiler/import-resolver";
import { bundle } from "../src/compiler/bundler";
import type { UXSpecDocument, CompiledUXSpec, ResolvedImports } from "../src/compiler/types";

const FIXTURES = path.join(import.meta.dir, "fixtures", "imports");

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

async function loadAndCompile(
  filename: string
): Promise<{ compiled: CompiledUXSpec; imports: ResolvedImports }> {
  const filePath = path.join(FIXTURES, filename);
  const raw = await Bun.file(filePath).text();
  const doc = JSON.parse(raw) as UXSpecDocument;
  const issues: any[] = [];
  const trace: any[] = [];
  const imports = await resolveImports(doc, filePath, issues, trace);
  if (issues.length > 0) throw new Error(`Import issues: ${JSON.stringify(issues)}`);
  const result = compile(doc, { imports });
  if (!result.ok || !result.compiled) {
    throw new Error(`Compile failed: ${JSON.stringify(result.issues)}`);
  }
  return { compiled: result.compiled, imports };
}

describe("import resolution", () => {
  it("returns empty namespaces for docs without imports", async () => {
    const doc = minimalDoc();
    const issues: any[] = [];
    const imports = await resolveImports(doc, "/fake/path.uxspec.json", issues, []);
    expect(issues).toHaveLength(0);
    expect(imports.namespaces.size).toBe(0);
  });

  it("loads tokens from an imported file", async () => {
    const doc = minimalDoc({
      $imports: {
        ui: { from: "./shared-ui.uxspec.json", tokens: true },
      },
    });
    const issues: any[] = [];
    const imports = await resolveImports(
      doc,
      path.join(FIXTURES, "test.uxspec.json"),
      issues,
      []
    );
    expect(issues).toHaveLength(0);
    expect(imports.namespaces.has("ui")).toBe(true);
    const ns = imports.namespaces.get("ui")!;
    expect(ns.tokens).toBeDefined();
    expect((ns.tokens as any).color.brand.primary.$value).toBe("#2563eb");
  });

  it("loads elements from an imported file", async () => {
    const doc = minimalDoc({
      $imports: {
        ui: { from: "./shared-ui.uxspec.json", elements: true },
      },
    });
    const issues: any[] = [];
    const imports = await resolveImports(
      doc,
      path.join(FIXTURES, "test.uxspec.json"),
      issues,
      []
    );
    expect(issues).toHaveLength(0);
    const ns = imports.namespaces.get("ui")!;
    expect(ns.elements).toBeDefined();
    expect((ns.elements as any).primaryButton).toBeDefined();
  });

  it("loads machine from an imported file", async () => {
    const doc = minimalDoc({
      $imports: {
        auth: { from: "./auth-machine.uxspec.json", machine: true },
      },
    });
    const issues: any[] = [];
    const imports = await resolveImports(
      doc,
      path.join(FIXTURES, "test.uxspec.json"),
      issues,
      []
    );
    expect(issues).toHaveLength(0);
    const ns = imports.namespaces.get("auth")!;
    expect(ns.machineId).toBe("auth");
    expect(ns.machineDocument).toBeDefined();
  });

  it("reports IMPORT_NOT_FOUND for missing file", async () => {
    const doc = minimalDoc({
      $imports: {
        missing: { from: "./nonexistent.uxspec.json", tokens: true },
      },
    });
    const issues: any[] = [];
    await resolveImports(
      doc,
      path.join(FIXTURES, "test.uxspec.json"),
      issues,
      []
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("IMPORT_NOT_FOUND");
  });

  it("reports INVALID_IMPORT_SPEC when no section requested", async () => {
    const doc = minimalDoc({
      $imports: {
        bad: { from: "./shared-ui.uxspec.json" },
      },
    });
    const issues: any[] = [];
    await resolveImports(
      doc,
      path.join(FIXTURES, "test.uxspec.json"),
      issues,
      []
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("INVALID_IMPORT_SPEC");
  });

  it("reports IMPORT_CYCLE for self-import", async () => {
    const selfPath = path.join(FIXTURES, "shared-ui.uxspec.json");
    const doc = minimalDoc({
      $imports: {
        self: { from: "./shared-ui.uxspec.json", tokens: true },
      },
    });
    const issues: any[] = [];
    await resolveImports(doc, selfPath, issues, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("IMPORT_CYCLE");
  });
});

describe("qualified token resolution", () => {
  it("resolves {ui:color.brand.primary} from imported tokens", async () => {
    const { compiled } = await loadAndCompile("auth-machine.uxspec.json");
    const signIn = compiled.states["signIn"];
    expect(signIn).toBeDefined();
    // Token should be resolved to the actual value
    // auth-machine uses {ui:color.brand.surface} for background
    expect(signIn.visual.container?.background).toBe("#eff6ff");
  });

  it("resolves {ui:space.md} dimension token", async () => {
    const { compiled } = await loadAndCompile("auth-machine.uxspec.json");
    const signIn = compiled.states["signIn"];
    // Dimension tokens resolve to their numeric value
    expect(signIn.visual.container?.padding).toBe(16);
  });

  it("reports UNKNOWN_IMPORTED_TOKEN_REFERENCE for bad namespace", () => {
    const doc = minimalDoc({
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            $visual: {
              container: {
                color: "{bad:color.missing}" as any,
              },
            },
          },
        },
      },
    });
    const result = compile(doc);
    // Should have an issue about the unresolved imported token
    expect(result.ok).toBe(false);
    const issue = result.issues.find(
      (i) => i.code === "UNKNOWN_IMPORTED_TOKEN_REFERENCE"
    );
    expect(issue).toBeDefined();
  });
});

describe("qualified element resolution", () => {
  it("resolves $ref: 'ui:primaryButton' from imported elements", async () => {
    const { compiled } = await loadAndCompile("auth-machine.uxspec.json");
    const signIn = compiled.states["signIn"];
    const content = signIn.visual.slots?.content;
    expect(content).toBeDefined();
    expect(Array.isArray(content)).toBe(true);
    // The $ref should be expanded — button type from the element definition
    const btn = (content as any[])[0];
    expect(btn.type).toBe("button");
    expect(btn.testId).toBe("auth-submit");
  });

  it("reports UNKNOWN_IMPORTED_ELEMENT_REFERENCE for bad ref", () => {
    const doc = minimalDoc({
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            $visual: {
              slots: {
                content: [{ $ref: "bad:nope" }] as any,
              },
            },
          },
        },
      },
    });
    const result = compile(doc);
    expect(result.ok).toBe(false);
    const issue = result.issues.find(
      (i) => i.code === "UNKNOWN_IMPORTED_ELEMENT_REFERENCE"
    );
    expect(issue).toBeDefined();
  });
});

describe("final states", () => {
  it("emits type: 'final' on compiled final states", async () => {
    const { compiled } = await loadAndCompile("auth-machine.uxspec.json");
    expect(compiled.states["success"]?.type).toBe("final");
    expect(compiled.states["cancelled"]?.type).toBe("final");
    expect(compiled.states["signIn"]?.type).toBeUndefined();
  });
});

describe("machine invoke", () => {
  it("preserves invoke metadata and emits dependencies", async () => {
    const { compiled } = await loadAndCompile("app-shell.uxspec.json");
    const authFlow = compiled.states["authFlow"];
    expect(authFlow).toBeDefined();
    expect(authFlow.invoke).toHaveLength(1);
    expect(authFlow.invoke[0].kind).toBe("machine");
    expect(authFlow.invoke[0].src).toBe("auth");

    // Dependencies should be populated
    expect(compiled.dependencies).toBeDefined();
    expect(compiled.dependencies!["authFlow"]).toBeDefined();
    expect(compiled.dependencies!["authFlow"].kind).toBe("machine");
  });

  it("resolves qualified tokens across import chain", async () => {
    const { compiled } = await loadAndCompile("app-shell.uxspec.json");
    const landing = compiled.states["landing"];
    // Tokens from ui import should be resolved
    expect(landing.visual.container?.background).toBe("#eff6ff");
    expect(landing.visual.container?.padding).toBe(16);
  });

  it("reports UNKNOWN_IMPORTED_MACHINE for bad src", () => {
    const doc = minimalDoc({
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            invoke: [
              { kind: "machine", src: "nonexistent", id: "x", onDone: {} },
            ],
          },
        },
      },
    });
    const result = compile(doc);
    expect(result.ok).toBe(false);
    const issue = result.issues.find(
      (i) => i.code === "UNKNOWN_IMPORTED_MACHINE"
    );
    expect(issue).toBeDefined();
  });
});

describe("bundle mode", () => {
  it("bundles app-shell with its auth dependency", async () => {
    const entryPath = path.join(FIXTURES, "app-shell.uxspec.json");
    const result = await bundle(entryPath);
    expect(result.ok).toBe(true);
    expect(result.bundled).toBeDefined();
    expect(result.bundled!.$format).toBe("uxspec-bundled");
    expect(result.bundled!.entry).toBe("app");
    expect(Object.keys(result.bundled!.modules)).toContain("app");
    expect(Object.keys(result.bundled!.modules)).toContain("auth");
  });

  it("each bundled module has correct format", async () => {
    const entryPath = path.join(FIXTURES, "app-shell.uxspec.json");
    const result = await bundle(entryPath);
    const appModule = result.bundled!.modules["app"];
    expect(appModule.$format).toBe("uxspec-compiled");
    expect(appModule.initial).toBe("landing");

    const authModule = result.bundled!.modules["auth"];
    expect(authModule.$format).toBe("uxspec-compiled");
    expect(authModule.initial).toBe("signIn");
    // Auth module should have final states
    expect(authModule.states["success"]?.type).toBe("final");
  });
});

describe("backwards compatibility", () => {
  it("compiles docs without $imports unchanged", () => {
    const doc = minimalDoc({
      $tokens: {
        color: { primary: { $type: "color", $value: "#ff0000" } },
      },
      $elements: {
        btn: { type: "button", content: "Click" },
      },
      $machine: {
        id: "test",
        initial: "idle",
        states: {
          idle: {
            $visual: {
              container: { color: "{color.primary}" },
              slots: {
                content: [{ $ref: "btn" }],
              },
            },
          },
        },
      },
    });
    const result = compile(doc);
    expect(result.ok).toBe(true);
    expect(result.compiled!.states["idle"].visual.container?.color).toBe("#ff0000");
    expect(result.compiled!.dependencies).toBeUndefined();
  });
});
