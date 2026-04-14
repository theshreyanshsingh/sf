"use client";

import { useEffect, useMemo, useState } from "react";

import { communityDtoToTemplateDefinition } from "@/app/helpers/communityTemplateAdapter";
import { fetchPublicTemplates } from "@/app/_services/templatesApi";
import {
  IoBrowsersOutline,
  IoGridOutline,
  IoPhonePortraitOutline,
  IoStatsChartOutline,
} from "react-icons/io5";

import Header from "@/app/_components/Header";
import NavigationBanner from "@/app/_components/NavigationBanner";
import MarketingFooter from "@/app/_components/MarketingFooter";
import TemplateCard from "@/app/_components/templates/TemplateCard";
import {
  type TemplateCategory,
  type TemplateDefinition,
  type TemplateRuntime,
} from "@/app/config/templates";

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 6;

const CATEGORY_ORDER: TemplateCategory[] = [
  "Landing Pages",
  "Components",
  "Dashboards",
  "Apps & Games",
  "Mobile Apps",
];

function getCategoryIcon(category: TemplateCategory) {
  switch (category) {
    case "Landing Pages":
      return <IoBrowsersOutline className="text-sm" />;
    case "Components":
      return <IoGridOutline className="text-sm" />;
    case "Dashboards":
      return <IoStatsChartOutline className="text-sm" />;
    case "Apps & Games":
      return <IoGridOutline className="text-sm" />;
    case "Mobile Apps":
      return <IoPhonePortraitOutline className="text-sm" />;
    default:
      return null;
  }
}

export default function TemplatesPageClient({
  initialRuntime = "all",
}: {
  initialRuntime?: "all" | TemplateRuntime;
}) {
  const [selectedCategory, setSelectedCategory] =
    useState<"All" | TemplateCategory>("All");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [communityRows, setCommunityRows] = useState<TemplateDefinition[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (initialRuntime === "mobile") {
      setCommunityRows([]);
      return () => {
        cancelled = true;
      };
    }
    void fetchPublicTemplates().then((rows) => {
      if (cancelled) return;
      setCommunityRows(rows.map(communityDtoToTemplateDefinition));
    });
    return () => {
      cancelled = true;
    };
  }, [initialRuntime]);

  const runtimeTemplates = useMemo(() => {
    if (initialRuntime === "mobile") {
      return [] as TemplateDefinition[];
    }
    return communityRows;
  }, [initialRuntime, communityRows]);

  const availableCategories = useMemo(() => {
    const categorySet = new Set(runtimeTemplates.map((template) => template.category));
    return CATEGORY_ORDER.filter((category) => categorySet.has(category));
  }, [runtimeTemplates]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "All") {
      return runtimeTemplates;
    }

    return runtimeTemplates.filter((template) => template.category === selectedCategory);
  }, [runtimeTemplates, selectedCategory]);

  const visibleTemplates = filteredTemplates.slice(0, visibleCount);
  const hasMoreTemplates = visibleTemplates.length < filteredTemplates.length;

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [selectedCategory, initialRuntime]);

  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <NavigationBanner />
      <Header withBannerOffset />

      <section className="mx-auto flex w-full max-w-[1380px] flex-col px-4 pb-20 pt-36 sm:px-6 sm:pt-40 lg:px-8">
        <div className="mx-auto w-full max-w-4xl text-center">
          <h1 className="font-[insSerifIt] text-4xl font-semibold tracking-tight text-white sm:text-6xl">
           Curated list of Templates
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-white/55 sm:text-sm">
            Discover the best landing pages, components, and starters from superblocks.
          </p>
        </div>

        <div className="mt-12 h-px w-full bg-white/10" />

        <section className="mt-8 flex flex-col gap-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === "All"
                  ? "border-[#4a90e2] bg-[#172234] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
              }`}
            >
              All
            </button>

            {availableCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? "border-[#4a90e2] bg-[#172234] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white"
                }`}
              >
                {getCategoryIcon(category)}
                {category}
              </button>
            ))}
          </div>

          {visibleTemplates.length ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => (
                <TemplateCard
                  key={template.slug}
                  template={template}
                  href={`/templates/${template.slug}`}
                  variant="home"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-[#0b0d12] px-6 py-10 text-center text-sm text-white/55">
              {initialRuntime === "mobile"
                ? "Gallery templates are web projects. Switch to “All” or web to browse published sites."
                : runtimeTemplates.length === 0
                  ? "No templates yet. Publish a public web project and it will appear here."
                  : "No templates match this category yet."}
            </div>
          )}

          {hasMoreTemplates ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
                className="inline-flex cursor-pointer items-center rounded-full border border-white/12 bg-white px-3 py-1 text-xs font-medium text-black transition hover:bg-white/90"
              >
                Load more
              </button>
            </div>
          ) : null}
        </section>
      </section>

      <MarketingFooter />
    </main>
  );
}
