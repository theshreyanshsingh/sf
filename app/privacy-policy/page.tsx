import Header from "@/app/_components/Header";
import MarketingFooter from "@/app/_components/MarketingFooter";
import NavigationBanner from "@/app/_components/NavigationBanner";

const sections = [
  {
    title: "Information we collect",
    body: "We collect account details such as your name, email address, subscription information, project metadata, prompts, generated files, attachments, and service usage information needed to operate Superblocks.",
  },
  {
    title: "How we use information",
    body: "We use collected information to authenticate accounts, generate and restore projects, power previews, process billing, respond to support requests, improve the product, and protect the platform from misuse.",
  },
  {
    title: "Project content and attachments",
    body: "Prompts, uploaded references, generated code, and project files may be stored so your work can be restored, edited, shared, or deployed. Private-project settings only control product visibility and do not remove storage required to run the service.",
  },
  {
    title: "Sharing and service providers",
    body: "We may share limited data with service providers that help us run authentication, payments, hosting, analytics, storage, or customer support. We do not sell your personal data to third parties.",
  },
  {
    title: "Retention",
    body: "We keep information for as long as it is reasonably needed to operate your account, comply with legal obligations, resolve disputes, and enforce our terms. Some backups and logs may remain for a limited period after deletion.",
  },
  {
    title: "Your choices",
    body: "You can control project visibility, update account information, manage billing through Stripe, and contact support to request help with account or privacy questions.",
  },
  {
    title: "Contact",
    body: "For privacy questions or data requests, contact support@superblocks.xyz.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <NavigationBanner />
      <Header withBannerOffset />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-36 sm:px-6 sm:pt-40 lg:px-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
            Privacy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            This policy explains what information Superblocks collects, why we
            collect it, and how it is used to operate the product.
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
