import Link from "next/link";
import { FaHeart, FaRegEye } from "react-icons/fa6";

import { type TemplateDefinition } from "@/app/config/templates";
import TemplateArtwork from "./TemplateArtwork";

function TemplateMeta({ template }: { template: TemplateDefinition }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[11px] font-semibold text-white"
        style={{
          background: `linear-gradient(135deg, ${template.accentFrom}33, ${template.accentTo}33)`,
        }}
      >
        {template.author.avatarLabel}
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-medium text-white">
          {template.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/45">
          <span className="truncate">{template.author.handle}</span>
          <span className="inline-flex items-center gap-1">
            <FaRegEye className="text-[10px]" />
            {template.stats.views}
          </span>
          <span className="inline-flex items-center gap-1">
            <FaHeart className="text-[10px]" />
            {template.stats.likes}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TemplateCard({
  template,
  href,
  compact = false,
  variant = "library",
}: {
  template: TemplateDefinition;
  href: string;
  compact?: boolean;
  variant?: "library" | "home";
}) {
  if (variant === "home") {
    return (
      <article className="group space-y-3">
        <Link href={href} className="relative block overflow-hidden rounded-md">
          <TemplateArtwork
            template={template}
            className={compact ? "aspect-[1.26/1]" : "aspect-[1.45/1]"}
          />
          <div className="absolute inset-0 hidden items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-black shadow-lg">
              More Details
            </span>
          </div>
        </Link>
        <div className="px-1">
          <Link
            href={href}
            className="line-clamp-2 text-xs font-semibold text-white transition-colors hover:text-white/80"
          >
            {template.title}
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="group space-y-3">
      <Link href={href} className="block overflow-hidden rounded-md bg-[#0d0f14]">
        <TemplateArtwork
          template={template}
          className={compact ? "aspect-[1.35/1]" : "aspect-[1.56/1]"}
        />
      </Link>
      <div className="flex items-start justify-between gap-4 px-1">
        <TemplateMeta template={template} />
        <div className="shrink-0 pt-0.5 text-sm font-medium text-white/65">
          {template.pricingLabel}
        </div>
      </div>
    </article>
  );
}
