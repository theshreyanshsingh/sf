import {
  type TemplateCategory,
  type TemplateDefinition,
} from "@/app/config/templates";

const WEB_CATEGORIES = new Set<string>([
  "Landing Pages",
  "Components",
  "Dashboards",
  "Apps & Games",
]);

export type CommunityTemplateDto = {
  slug: string;
  title: string;
  description: string;
  /** Original project prompt — for builder / ?template= deep links. */
  seedPrompt?: string;
  category: string;
  runtime: "web";
  deployed_image: string | null;
  deployed_url: string | null;
  lastUpdated?: string;
  author: {
    name: string;
    handle: string;
    avatarLabel: string;
  };
  source?: string;
};

function formatUpdated(iso?: string) {
  if (!iso) return "Recently";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function communityDtoToTemplateDefinition(
  d: CommunityTemplateDto,
): TemplateDefinition {
  const category = (WEB_CATEGORIES.has(d.category)
    ? d.category
    : "Landing Pages") as TemplateCategory;

  const seed =
    typeof d.seedPrompt === "string" && d.seedPrompt.trim()
      ? d.seedPrompt.trim()
      : d.description;
  return {
    id: `community-${d.slug}`,
    slug: d.slug,
    label: category,
    title: d.title,
    description: d.description,
    prompt: seed,
    runtime: "web",
    category,
    about: d.description,
    tags: ["community"],
    lastUpdated: formatUpdated(d.lastUpdated),
    pricingLabel: "Free",
    author: d.author,
    stats: { views: "—", likes: "—" },
    visual: "paper",
    accentFrom: "#64748b",
    accentTo: "#0f172a",
    heroEyebrow: category,
    heroSubtitle: d.description.slice(0, 120),
    previewUrl: normalizePreviewUrl(d.deployed_url),
    previewImageUrl: normalizeImageUrl(d.deployed_image),
  };
}

/** Normalize to https for iframe src (avoids mixed content).
 *  Handles bare hostnames like "mysite.netlify.app" that the worker stores. */
function normalizePreviewUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  let candidate = t;
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.href;
  } catch {
    return null;
  }
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  let candidate = t;
  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    return null;
  } catch {
    return null;
  }
}

/** Hub “Your templates” cards — same artwork shape as community templates. */
export function myTemplateRowToDefinition(row: {
  slug: string;
  title: string;
  category: string | null;
  previewUrl?: string | null;
}): TemplateDefinition {
  const cat = (row.category && WEB_CATEGORIES.has(row.category)
    ? row.category
    : "Landing Pages") as TemplateCategory;
  const title = row.title?.trim() || row.slug;
  return {
    id: `mine-${row.slug}`,
    slug: row.slug,
    label: cat,
    title,
    description: title,
    prompt: "",
    runtime: "web",
    category: cat,
    about: "",
    tags: ["mine"],
    lastUpdated: "",
    pricingLabel: "Yours",
    author: { name: "You", handle: "you", avatarLabel: "Y" },
    stats: { views: "—", likes: "—" },
    visual: "paper",
    accentFrom: "#64748b",
    accentTo: "#0f172a",
    heroEyebrow: cat,
    heroSubtitle: title.slice(0, 120),
    previewUrl: normalizePreviewUrl(row.previewUrl ?? null),
    previewImageUrl: null,
  };
}
