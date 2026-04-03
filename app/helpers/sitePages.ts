export type SiteGraphPage = {
  path: string;
  title?: string;
};

export type SiteGraph = {
  pageRoot?: string;
  pages?: SiteGraphPage[];
};

export type EmbedState = {
  head?: string[];
  body?: string[];
};

export const resolvePageRoot = (siteGraph?: SiteGraph | null) => {
  if (!siteGraph) return "";
  if (siteGraph.pageRoot && siteGraph.pageRoot !== "workspace/") {
    return siteGraph.pageRoot;
  }
  if (siteGraph.pages?.some((p) => p.path?.startsWith("pages/"))) {
    return "pages/";
  }
  return "";
};

export const normalizePagePath = (
  value: string | undefined,
  siteGraph?: SiteGraph | null
) => {
  const pageRoot = resolvePageRoot(siteGraph);
  let next = (value || "").trim();
  if (!next) {
    next = `${pageRoot}index.html`;
  }
  next = next.replace(/^\/+/, "");
  if (pageRoot && !next.startsWith(pageRoot)) {
    next = `${pageRoot}${next}`;
  }
  if (!next.endsWith(".html")) {
    next = `${next}.html`;
  }
  return next;
};

export const ensureUniquePagePath = (
  path: string,
  pages?: SiteGraphPage[]
) => {
  if (!pages || pages.length === 0) return path;
  const exists = pages.some((p) => p.path === path);
  if (!exists) return path;
  const base = path.replace(/\.html$/, "");
  let counter = 1;
  let candidate = `${base}-${counter}.html`;
  while (pages.some((p) => p.path === candidate)) {
    counter += 1;
    candidate = `${base}-${counter}.html`;
  }
  return candidate;
};

export const createBasicPageHtml = ({
  title,
  slug,
  embeds,
}: {
  title: string;
  slug: string;
  embeds?: EmbedState;
}) => {
  return "";
};
