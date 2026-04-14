import { getPublicEnv } from "@/app/config/publicEnv";

import { type CommunityTemplateDto } from "@/app/helpers/communityTemplateAdapter";

export async function fetchCommunityTemplate(
  slug: string,
): Promise<CommunityTemplateDto | null> {
  const api = getPublicEnv().NEXT_PUBLIC_API;
  if (!api) return null;
  try {
    const res = await fetch(
      `${api}/v1/templates/by-slug/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      template?: CommunityTemplateDto;
    };
    return data.success && data.template ? data.template : null;
  } catch {
    return null;
  }
}
