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
  if (siteGraph.pageRoot) return siteGraph.pageRoot;
  if (siteGraph.pages?.some((p) => p.path?.startsWith("workspace/"))) {
    return "workspace/";
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
  const safeTitle = title || "New Page";
  const safeSlug = slug || "page";
  const headEmbeds = (embeds?.head || []).join("\n");
  const bodyEmbeds = (embeds?.body || []).join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <!-- sb:head-start -->
    ${headEmbeds}
    <!-- sb:head-end -->
  </head>
  <body data-sb-page="${safeSlug}">
    <main style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; color: #ffffff; background: #0f0f10; min-height: 100vh; padding: 64px 24px;">
      <section data-sb-block-id="hero-${safeSlug}" style="max-width: 960px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; color: #4a90e2; font-weight: 600;">NEW PAGE</p>
        <h1 style="font-size: 42px; line-height: 1.1; margin: 16px 0 12px 0;">${safeTitle}</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #b1b1b7; max-width: 560px;">
          Edit this content in the WYSIWYG editor or by selecting the block and asking the assistant to refine it.
        </p>
        <div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
          <a href="#" style="background: #4a90e2; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 600;">Primary action</a>
          <a href="#" style="border: 1px solid #2a2a2b; color: #e0e0e6; padding: 10px 18px; border-radius: 999px; text-decoration: none;">Secondary link</a>
        </div>
      </section>
    </main>
    <!-- sb:body-start -->
    ${bodyEmbeds}
    <!-- sb:body-end -->
    <script src="/wysiwyg-editor.js"></script>
  </body>
</html>`;
};
