/**
 * build-specs.ts
 *
 * Compiles UXSpec examples into generated TypeScript modules for the Next.js app.
 *
 * Usage:  bun run app/scripts/build-specs.ts
 */

import * as path from "path";
import * as fs from "fs";
import { compile } from "../../src/compiler/compile";
import type { UXSpecDocument } from "../../src/compiler/types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const EXAMPLES_DIR = path.resolve(__dirname, "../../examples");
const GENERATED_DIR = path.resolve(__dirname, "../generated");
const SPECS_DIR = path.resolve(GENERATED_DIR, "specs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a slug from a filename like "02-auth-flow.uxspec.json" → "auth-flow" */
function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.uxspec\.json$/, "")
    .replace(/^\d+-/, "");
}

/** Derive a human-readable title from a slug like "auth-flow" → "Auth Flow" */
function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Animation CSS generation
// ---------------------------------------------------------------------------

interface AnimationKeyframeValue {
  value: number;
  unit: string;
}

type PropValue = number | string | AnimationKeyframeValue;

/**
 * Convert a single keyframe property into a CSS declaration.
 *
 * Handles:
 *   opacity        → opacity: N
 *   rotate         → transform: rotate(Ndeg)
 *   scale          → transform: scale(N)
 *   scaleX         → transform: scaleX(N)
 *   translateX     → transform: translateX(Npx) or translateX(N%)
 *   translateY     → transform: translateY(Npx) or translateY(N%)
 *   height         → height: value
 *   background     → background: value
 */
function cssDeclaration(prop: string, val: PropValue): { property: string; value: string } | null {
  // Skip description fields
  if (prop.startsWith("$")) return null;

  const resolveUnit = (v: PropValue, fallbackUnit: string): string => {
    if (typeof v === "object" && v !== null && "value" in v) {
      return `${v.value}${v.unit}`;
    }
    return `${v}${fallbackUnit}`;
  };

  switch (prop) {
    case "opacity":
      return { property: "opacity", value: String(val) };
    case "rotate":
      return { property: "transform", value: `rotate(${resolveUnit(val, "deg")})` };
    case "scale":
      return { property: "transform", value: `scale(${val})` };
    case "scaleX":
      return { property: "transform", value: `scaleX(${val})` };
    case "scaleY":
      return { property: "transform", value: `scaleY(${val})` };
    case "translateX":
      return { property: "transform", value: `translateX(${resolveUnit(val, "px")})` };
    case "translateY":
      return { property: "transform", value: `translateY(${resolveUnit(val, "px")})` };
    case "height":
      return { property: "height", value: resolveUnit(val, "px") };
    case "background":
      return { property: "background", value: String(val) };
    default:
      // Pass through unknown properties as-is (e.g. color, width, etc.)
      return { property: prop, value: resolveUnit(val, "") };
  }
}

/**
 * Build CSS text for a single @keyframes block.
 * Groups transform sub-properties into a single `transform` declaration per stop.
 */
function buildKeyframeCSS(
  specSlug: string,
  animName: string,
  keyframes: Record<string, Record<string, PropValue>>
): string {
  const cssName = `ux-${specSlug}-${animName}`;
  const stops: string[] = [];

  for (const [pct, props] of Object.entries(keyframes)) {
    const declarations: Map<string, string> = new Map();
    const transforms: string[] = [];

    for (const [prop, val] of Object.entries(props)) {
      const decl = cssDeclaration(prop, val as PropValue);
      if (!decl) continue;

      if (decl.property === "transform") {
        transforms.push(decl.value);
      } else {
        declarations.set(decl.property, decl.value);
      }
    }

    if (transforms.length > 0) {
      declarations.set("transform", transforms.join(" "));
    }

    const lines = Array.from(declarations.entries())
      .map(([p, v]) => `    ${p}: ${v};`)
      .join("\n");

    stops.push(`  ${pct}% {\n${lines}\n  }`);
  }

  return `@keyframes ${cssName} {\n${stops.join("\n")}\n}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Ensure output directories exist
  fs.mkdirSync(SPECS_DIR, { recursive: true });

  // Discover example files
  const allFiles = fs.readdirSync(EXAMPLES_DIR).filter(
    (f) => f.endsWith(".uxspec.json")
  );

  // Skip multi-file composable app
  const files = allFiles.filter((f) => !f.startsWith("07-"));

  const manifestEntries: Array<{
    slug: string;
    title: string;
    stateCount: number;
  }> = [];

  const allAnimationCSS: string[] = [];

  for (const file of files) {
    const filePath = path.join(EXAMPLES_DIR, file);
    const slug = slugFromFilename(file);
    const title = titleFromSlug(slug);

    // Read and parse the source JSON
    let sourceDoc: UXSpecDocument;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      sourceDoc = JSON.parse(raw) as UXSpecDocument;
    } catch (err) {
      console.error(`[skip] ${file}: failed to read/parse — ${err}`);
      continue;
    }

    // Compile
    const result = compile(sourceDoc);

    if (!result.ok || !result.compiled) {
      console.error(`[skip] ${file}: compilation failed`);
      for (const issue of result.issues) {
        console.error(`  ${issue.code}: ${issue.message} (${issue.path})`);
      }
      continue;
    }

    const compiled = result.compiled;
    const stateCount = Object.keys(compiled.states).length;

    // Write generated spec module
    const specOutPath = path.join(SPECS_DIR, `${slug}.ts`);
    const specContent = `export default ${JSON.stringify(compiled, null, 2)};\n`;
    fs.writeFileSync(specOutPath, specContent, "utf-8");
    console.log(`[ok]   ${file} → generated/specs/${slug}.ts  (${stateCount} states)`);

    // Collect animation CSS from source (not compiled)
    const animations = (sourceDoc as any).$animations as
      | Record<string, any>
      | undefined;

    if (animations) {
      for (const [animName, animDef] of Object.entries(animations)) {
        if (animDef && typeof animDef === "object" && animDef.keyframes) {
          allAnimationCSS.push(
            buildKeyframeCSS(slug, animName, animDef.keyframes)
          );
        }
      }
    }

    manifestEntries.push({ slug, title, stateCount });
  }

  // -------------------------------------------------------------------------
  // Write generated/animations.css
  // -------------------------------------------------------------------------

  const animCSS = [
    "/* Auto-generated by build-specs.ts — do not edit */",
    "",
    ...allAnimationCSS,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(GENERATED_DIR, "animations.css"), animCSS, "utf-8");
  console.log(`[ok]   animations.css  (${allAnimationCSS.length} @keyframes)`);

  // -------------------------------------------------------------------------
  // Write generated/manifest.ts
  // -------------------------------------------------------------------------

  const manifestObj: Record<
    string,
    { title: string; slug: string; stateCount: number }
  > = {};
  for (const entry of manifestEntries) {
    manifestObj[entry.slug] = {
      title: entry.title,
      slug: entry.slug,
      stateCount: entry.stateCount,
    };
  }

  const switchCases = manifestEntries
    .map(
      (e) =>
        `      case "${e.slug}": return (await import("./specs/${e.slug}")).default;`
    )
    .join("\n");

  const manifestTS = `// Auto-generated by build-specs.ts — do not edit

export const manifest = ${JSON.stringify(manifestObj, null, 2)} as const;

export type SpecSlug = keyof typeof manifest;

export async function loadSpec(slug: SpecSlug) {
  switch (slug) {
${switchCases}
    default: {
      const _exhaustive: never = slug;
      throw new Error(\`Unknown spec: \${_exhaustive}\`);
    }
  }
}
`;

  fs.writeFileSync(
    path.join(GENERATED_DIR, "manifest.ts"),
    manifestTS,
    "utf-8"
  );
  console.log(`[ok]   manifest.ts  (${manifestEntries.length} specs)`);
}

main().catch((err) => {
  console.error("build-specs failed:", err);
  process.exit(1);
});
