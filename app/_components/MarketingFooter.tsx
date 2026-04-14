"use client";

import Link from "next/link";

import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { MorphingText } from "@/components/magicui/morphing-text";

const footerLinks = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export default function MarketingFooter() {
  const { isAuthenticated } = useAuthenticated();

  const visibleLinks = isAuthenticated.value
    ? footerLinks.filter((link) => link.label !== "Pricing")
    : footerLinks;

  return (
    <footer className="mt-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-5 sm:px-6 lg:px-8">
        <div className="w-full border-t border-[#1c1c1d]" />

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-[#71717A] transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-4 flex w-full justify-center pb-4">
          <span className="text-sm text-[#71717A]">
            © {new Date().getFullYear()} Superblocks. All rights reserved.
          </span>
        </div>
      </div>

      <div className="w-full pt-20 text-center">
        <MorphingText
          texts={["Superblocks", "Vibe coding platform"]}
          className="text-6xl text-white sm:text-8xl lg:text-9xl"
        />
      </div>
    </footer>
  );
}
