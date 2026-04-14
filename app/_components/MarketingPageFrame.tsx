import { type ReactNode } from "react";

import Header from "./Header";
import NavigationBanner from "./NavigationBanner";
import MarketingFooter from "./MarketingFooter";

export default function MarketingPageFrame({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <NavigationBanner />
      <Header withBannerOffset />
      <section className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 pt-36 sm:px-6 sm:pt-40 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(74,144,226,0.18),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-10 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:px-10 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_24%)]" />
          <div className="relative max-w-3xl">
            {eyebrow ? (
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#4a90e2]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-10">{children}</div>
      </section>
      <MarketingFooter />
    </main>
  );
}
