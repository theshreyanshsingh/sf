import Header from "@/app/_components/Header";
import MarketingFooter from "@/app/_components/MarketingFooter";
import NavigationBanner from "@/app/_components/NavigationBanner";

const sections = [
  {
    title: "Acceptance of these terms",
    body: "By using Superblocks, you agree to these Terms & Conditions and our related policies. If you do not agree, do not use the platform.",
  },
  {
    title: "Accounts and access",
    body: "You are responsible for keeping your login credentials secure and for all activity that happens through your account. You must provide accurate information when creating or maintaining an account.",
  },
  {
    title: "Subscriptions and billing",
    body: "Paid plans renew automatically on the billing cycle shown at checkout unless you cancel before renewal. Usage limits, credits, and feature access depend on the plan you select and may change if you upgrade, downgrade, or cancel.",
  },
  {
    title: "Generated projects and content",
    body: "You are responsible for the prompts, files, media, and project content you upload, generate, publish, or share through Superblocks. You must have the rights needed to use any content you submit to the service.",
  },
  {
    title: "Acceptable use",
    body: "You may not use Superblocks to create unlawful content, abuse third-party services, violate intellectual property rights, attempt to break security controls, or interfere with the platform or other users.",
  },
  {
    title: "Availability and changes",
    body: "We may update features, pricing, integrations, model availability, and project limits from time to time. We aim to keep the service available, but we do not promise uninterrupted access or error-free operation.",
  },
  {
    title: "Termination",
    body: "We may suspend or terminate access if we reasonably believe you violated these terms, created material risk for the service, or used the platform in a way that harms other users or our infrastructure.",
  },
  {
    title: "Contact",
    body: "For questions about these Terms & Conditions, billing, or account access, contact support@superblocks.xyz.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <NavigationBanner />
      <Header withBannerOffset />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-36 sm:px-6 sm:pt-40 lg:px-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Terms & Conditions
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            These terms explain how Superblocks can be used, how billing works,
            and what responsibilities stay with the account owner.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                {section.title}
              </h2>
              <p className="text-sm leading-7 text-white/65 sm:text-base">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
