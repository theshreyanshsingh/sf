import { Suspense } from "react";

import TemplatesPageClient from "./TemplatesPageClient";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ runtime?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const runtime =
    resolvedSearchParams.runtime === "web" ||
    resolvedSearchParams.runtime === "mobile"
      ? resolvedSearchParams.runtime
      : "all";

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#06070a]" />}>
      <TemplatesPageClient initialRuntime={runtime} />
    </Suspense>
  );
}
