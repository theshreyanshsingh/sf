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
    // Never default to root index.html: static HTML would be skipped by WebContainer
    // sync (Vite entry must keep a module script), so "New page" looked broken.
    next = pageRoot ? `${pageRoot}new-page.html` : `pages/new-page.html`;
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

function pathExistsInProject(
  path: string,
  projectFiles?: Record<string, string> | null,
): boolean {
  if (!projectFiles) return false;
  const normalized = path.replace(/^\/+/, "");
  const variants = new Set([
    normalized,
    `/${normalized}`,
    path,
  ]);
  for (const v of variants) {
    if (v in projectFiles) return true;
  }
  return false;
}

export const ensureUniquePagePath = (
  path: string,
  pages?: SiteGraphPage[],
  projectFiles?: Record<string, string> | null,
) => {
  const taken = (p: string) =>
    Boolean(pages?.some((x) => x.path === p)) ||
    pathExistsInProject(p, projectFiles);

  if (!taken(path)) return path;
  const base = path.replace(/\.html$/, "");
  let counter = 1;
  let candidate = `${base}-${counter}.html`;
  while (taken(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}.html`;
  }
  return candidate;
};

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function embedSlot(slot: "head" | "body", embeds?: EmbedState) {
  const lines = (embeds?.[slot] || []).join("\n");
  return `<!-- sb:${slot}-start -->\n${lines}\n<!-- sb:${slot}-end -->`;
}

/** Default `pages/` when the graph is empty but the repo already uses a pages directory. */
export const inferPageRootFromProjectFiles = (
  files?: Record<string, string> | null,
): string => {
  if (!files) return "";
  for (const raw of Object.keys(files)) {
    const k = raw.replace(/^\/+/, "");
    if (k.startsWith("pages/") && k.endsWith(".html")) return "pages/";
  }
  return "";
};

export const createBasicPageHtml = ({
  title,
  slug,
  filePath,
  embeds,
}: {
  title: string;
  slug: string;
  /** Full path for WYSIWYG routing, e.g. pages/about.html */
  filePath?: string;
  embeds?: EmbedState;
}) => {
  const safeTitle = escapeHtml(title);
  const relative = (filePath || `${slug.replace(/\.html$/i, "")}.html`).replace(
    /^\/+/,
    "",
  );
  const dataPage = escapeHtml(relative);
  const headEmbeds = embedSlot("head", embeds);
  const bodyEmbeds = embedSlot("body", embeds);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    ${headEmbeds}
  </head>
  <body data-sb-page="${dataPage}">
    <main style="min-height:100vh;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;padding:48px 24px;background:#0a0a0b;color:#f5f5f7;box-sizing:border-box;">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);margin:0 0 12px;line-height:1.2;">${safeTitle}</h1>
      <p style="margin:0;opacity:0.75;max-width:42rem;line-height:1.6;font-size:15px;">Edit this page in Edit mode, or open it in Code to customize.</p>
    </main>
    ${bodyEmbeds}
  </body>
</html>
`;
};
