import * as icons from "lucide-react";
import type { ComponentType } from "react";

/**
 * Resolve a UXSpec icon name (e.g. "Crop", "check-circle", "arrow_left")
 * to the corresponding lucide-react component.
 */
export function resolveIcon(name: string): ComponentType<any> | null {
  // Convert kebab-case or snake_case to PascalCase
  const pascalName = name.replace(/(^|[-_])(\w)/g, (_, __, c) =>
    c.toUpperCase(),
  );
  return (icons as any)[pascalName] ?? null;
}
