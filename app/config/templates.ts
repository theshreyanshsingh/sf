/** Types only — template data is loaded from the API (`/v1/templates`). */

export type TemplateRuntime = "web" | "mobile";

export type TemplateCategory =
  | "Apps & Games"
  | "Landing Pages"
  | "Components"
  | "Dashboards"
  | "Mobile Apps";

export type TemplateAuthor = {
  name: string;
  handle: string;
  avatarLabel: string;
};

export type TemplateStats = {
  views: string;
  likes: string;
};

export type TemplateVisual =
  | "collage"
  | "paper"
  | "gallery"
  | "orbital"
  | "dashboard"
  | "studio"
  | "signal"
  | "mobile";

export type TemplateDefinition = {
  id: string;
  slug: string;
  label: string;
  title: string;
  description: string;
  prompt: string;
  runtime: TemplateRuntime;
  category: TemplateCategory;
  about: string;
  tags: string[];
  lastUpdated: string;
  pricingLabel: string;
  author: TemplateAuthor;
  stats: TemplateStats;
  visual: TemplateVisual;
  accentFrom: string;
  accentTo: string;
  heroEyebrow: string;
  heroSubtitle: string;
  /** Deployed site URL (HTTPS) — live iframe preview when set. */
  previewUrl: string | null;
  /** Screenshot / OG image from last deploy — fallback when no iframe URL. */
  previewImageUrl: string | null;
};
