import { notFound } from "next/navigation";

import Header from "@/app/_components/Header";
import MarketingFooter from "@/app/_components/MarketingFooter";
import NavigationBanner from "@/app/_components/NavigationBanner";
import { communityDtoToTemplateDefinition } from "@/app/helpers/communityTemplateAdapter";
import { fetchCommunityTemplate } from "@/app/helpers/fetchCommunityTemplate";
import { fetchPublicTemplateListServer } from "@/app/helpers/serverPublicTemplates";

import TemplateDetailClient from "./TemplateDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const dto = await fetchCommunityTemplate(resolvedParams.slug);
  if (!dto) {
    return {
      title: "Template not found | Superblocks",
    };
  }
  const t = communityDtoToTemplateDefinition(dto);
  return {
    title: `${t.title} | Superblocks Templates`,
    description: t.about,
  };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const dto = await fetchCommunityTemplate(resolvedParams.slug);
  if (!dto) {
    notFound();
  }

  const template = communityDtoToTemplateDefinition(dto);
  const relatedRaw = await fetchPublicTemplateListServer(template.category);
  const moreLikeThis = relatedRaw
    .filter((item) => item.slug !== template.slug)
    .slice(0, 4)
    .map(communityDtoToTemplateDefinition);

  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <NavigationBanner />
      <Header withBannerOffset />
      <TemplateDetailClient template={template} moreLikeThis={moreLikeThis} />
      <MarketingFooter />
    </main>
  );
}
