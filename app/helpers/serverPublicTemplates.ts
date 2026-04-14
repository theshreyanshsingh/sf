import { getPublicEnv } from "@/app/config/publicEnv";

import { type CommunityTemplateDto } from "@/app/helpers/communityTemplateAdapter";

/**
 * Server-side list for template detail “more like this” and metadata.
 */
export async function fetchPublicTemplateListServer(
  category?: string,
): Promise<CommunityTemplateDto[]> {
  const api = getPublicEnv().NEXT_PUBLIC_API;
  if (!api) return [];
  const q = category
    ? `?category=${encodeURIComponent(category)}`
    : "";
  try {
    const res = await fetch(`${api}/v1/templates${q}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      success?: boolean;
      templates?: CommunityTemplateDto[];
    };
    return data.success && Array.isArray(data.templates) ? data.templates : [];
  } catch {
    return [];
  }
}
