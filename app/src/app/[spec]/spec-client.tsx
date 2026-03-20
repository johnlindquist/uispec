"use client";

import { useEffect, useState } from "react";
import type { CompiledUXSpec } from "@/lib/types";
import { UXRunner } from "@/lib/render/ux-runner";

export function SpecClient({ slug }: { slug: string }) {
  const [spec, setSpec] = useState<CompiledUXSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let mod: any;
        switch (slug) {
          case "recording-overlay":
            mod = await import("../../../generated/specs/recording-overlay");
            break;
          case "auth-flow":
            mod = await import("../../../generated/specs/auth-flow");
            break;
          case "toast-notifications":
            mod = await import("../../../generated/specs/toast-notifications");
            break;
          case "form-validation":
            mod = await import("../../../generated/specs/form-validation");
            break;
          case "media-player":
            mod = await import("../../../generated/specs/media-player");
            break;
          case "data-resource-page":
            mod = await import("../../../generated/specs/data-resource-page");
            break;
          default:
            throw new Error(`Unknown spec: ${slug}`);
        }
        if (!cancelled) setSpec(mod.default);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#ee5555",
          fontSize: 14,
          padding: 32,
        }}
      >
        Failed to load spec: {error}
      </div>
    );
  }

  if (!spec) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  return <UXRunner spec={spec} />;
}
