import MarketingPageFrame from "@/app/_components/MarketingPageFrame";

export default function AIPolicyPage() {
  return (
    <MarketingPageFrame
      eyebrow="Policy"
      title="AI Policy"
      description="How Superblocks uses AI systems, handles generated output, and sets expectations for responsible use."
    >
      <div className="space-y-6 rounded-[28px] border border-white/10 bg-[#0b0d11] p-6 text-sm leading-7 text-white/60">
        <section>
          <h2 className="text-lg font-semibold text-white">Generated output</h2>
          <p className="mt-3">
            AI output can still require review. You should verify business logic, copy, and external claims before publishing or deploying generated work.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">Reference material</h2>
          <p className="mt-3">
            When you provide screenshots, links, or designs, Superblocks uses them to infer structure and style. You should only upload content you are allowed to use.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white">Safety boundaries</h2>
          <p className="mt-3">
            We apply guardrails to reduce harmful, abusive, or deceptive usage. Repeated attempts to bypass those boundaries may result in restricted access.
          </p>
        </section>
      </div>
    </MarketingPageFrame>
  );
}
