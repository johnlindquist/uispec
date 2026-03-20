import { notFound } from "next/navigation";
import { SpecClient } from "./spec-client";

const VALID_SPECS = [
  "recording-overlay",
  "auth-flow",
  "toast-notifications",
  "form-validation",
  "media-player",
  "data-resource-page",
] as const;

type SpecSlug = (typeof VALID_SPECS)[number];

export default async function SpecPage({
  params,
}: {
  params: Promise<{ spec: string }>;
}) {
  const { spec } = await params;
  if (!VALID_SPECS.includes(spec as SpecSlug)) {
    notFound();
  }
  return <SpecClient slug={spec} />;
}
