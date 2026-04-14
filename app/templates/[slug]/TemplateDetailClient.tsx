"use client";

import Link from "next/link";

import TemplateCard from "@/app/_components/templates/TemplateCard";
import TemplatePreviewActions from "@/app/_components/templates/TemplatePreviewActions";
import TemplatePreviewViewport from "@/app/_components/templates/TemplatePreviewViewport";
import { type TemplateDefinition } from "@/app/config/templates";

export default function TemplateDetailClient({
  template,
  moreLikeThis,
}: {
  template: TemplateDefinition;
  moreLikeThis: TemplateDefinition[];
}) {
  const previewTargetId = `template-preview-${template.slug}`;

  return (
    <section className="mx-auto flex w-full max-w-[1520px] flex-col px-4 pb-16 pt-36 sm:px-6 sm:pt-40 lg:px-8">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-sm text-white/35">
              <Link href="/templates" className="hover:text-white">
                Templates
              </Link>
              <span className="px-2">›</span>
              <span>{template.category}</span>
              <span className="px-2">›</span>
              <span className="truncate text-white/65">{template.title}</span>
            </div>
            <div className="space-y-1">
              <h1 className="w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-semibold tracking-tight text-white sm:text-3xl lg:max-w-[28ch] lg:text-[2.8rem] xl:max-w-[32ch]">
                {template.title}
              </h1>
            </div>
          </div>

          <TemplatePreviewActions templateSlug={template.slug} />
        </div>

        <TemplatePreviewViewport
          template={template}
          previewTargetId={previewTargetId}
        />
      </div>

      <div className="mt-10 space-y-10">
        {template.about ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">About</h2>
              <p className="mt-4 text-sm leading-7 text-white/60 sm:text-base">
                {template.about}
              </p>
            </div>

            <div className="space-y-6">
              <dl className="flex flex-wrap items-start gap-8 text-sm text-white/60">
                <div>
                  <dt className="text-white/35">Runtime</dt>
                  <dd className="mt-1 capitalize text-white">
                    {template.runtime}
                  </dd>
                </div>
                <div>
                  <dt className="text-white/35">Last updated</dt>
                  <dd className="mt-1 text-white">{template.lastUpdated}</dd>
                </div>
              </dl>
            </div>
          </section>
        ) : null}

        <section className="space-y-7 pt-10">
          {moreLikeThis.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-white">
                More templates like this
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {moreLikeThis.map((item) => (
                  <TemplateCard
                    key={item.slug}
                    template={item}
                    href={`/templates/${item.slug}`}
                    compact
                    variant="home"
                  />
                ))}
              </div>
            </>
          )}
          <div className="flex justify-center pt-4">
            <Link
              href="/templates"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-md bg-white px-3 py-1 text-xs font-medium text-black transition hover:bg-white/90 sm:w-auto"
            >
              Browse all
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
