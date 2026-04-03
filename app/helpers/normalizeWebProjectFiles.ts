import { normalizeIncomingFileContent } from "../_services/fileUpdatesMobile";
import { normalizeWebProjectPath } from "./workspacePaths";

const MAIN_ENTRY_CANDIDATES = [
  "src/main.tsx",
  "src/main.jsx",
  "src/main.ts",
  "src/main.js",
  "src/index.tsx",
  "src/index.jsx",
  "src/index.ts",
  "src/index.js",
];

const normalizeFileContent = (value: unknown): string => {
  if (typeof value === "string") {
    return normalizeIncomingFileContent(value);
  }
  if (value && typeof value === "object" && "code" in value) {
    const code = (value as { code?: unknown }).code;
    if (typeof code === "string") return normalizeIncomingFileContent(code);
  }
  if (value && typeof value === "object" && "content" in value) {
    const content = (value as { content?: unknown }).content;
    if (typeof content === "string") return normalizeIncomingFileContent(content);
  }
  if (value && typeof value === "object" && "contents" in value) {
    const contents = (value as { contents?: unknown }).contents;
    if (typeof contents === "string") {
      return normalizeIncomingFileContent(contents);
    }
  }
  return JSON.stringify(value ?? "", null, 2);
};

const isTestScaffoldIndex = (content: string): boolean => {
  const lower = content.toLowerCase();
  return (
    lower.includes("data-sb-page=") ||
    lower.includes("sb:head-start") ||
    lower.includes("wysiwyg") ||
    lower.includes("superblocks") ||
    lower.includes("new page")
  );
};

const detectAppExtension = (fileMap: Record<string, string>): "tsx" | "jsx" => {
  if (fileMap["src/App.tsx"]) return "tsx";
  if (fileMap["src/App.jsx"]) return "jsx";
  if (fileMap["src/App.ts"]) return "tsx";
  if (fileMap["src/App.js"]) return "jsx";
  return "jsx";
};

const ensureViteEntryFiles = (fileMap: Record<string, string>) => {
  const generated: Record<string, string> = {};
  const appExt = detectAppExtension(fileMap);
  const existingMain =
    MAIN_ENTRY_CANDIDATES.find((path) => path in fileMap) || null;
  const mainPath = existingMain || `src/main.${appExt === "tsx" ? "tsx" : "jsx"}`;

  if (!existingMain) {
    const appImportExt = appExt === "tsx" ? "tsx" : "jsx";
    generated[mainPath] = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.${appImportExt}";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
`;
  }

  const existingIndex = fileMap["index.html"];
  const shouldReplaceIndex =
    typeof existingIndex === "string" && isTestScaffoldIndex(existingIndex);

  if (!fileMap["index.html"] || shouldReplaceIndex) {
    const entryPath = mainPath;
    generated["index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Superblocks App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entryPath}"></script>
  </body>
</html>
`;
  }

  return generated;
};

export const normalizeWebProjectFiles = (
  fileMap: Record<string, unknown> | null | undefined
): { files: Record<string, string>; didNormalizePaths: boolean } => {
  if (!fileMap || typeof fileMap !== "object") {
    return { files: {}, didNormalizePaths: false };
  }

  const normalized: Record<string, string> = {};
  let didNormalizePaths = false;

  for (const [rawPath, value] of Object.entries(fileMap)) {
    if (!rawPath) continue;
    const normalizedPath = normalizeWebProjectPath(rawPath);
    if (!normalizedPath) continue;
    if (normalizedPath !== rawPath.replace(/^\/+/, "")) {
      didNormalizePaths = true;
    }
    normalized[normalizedPath] = normalizeFileContent(value);
  }

  const generatedEntries = ensureViteEntryFiles(normalized);
  const files = { ...normalized, ...generatedEntries };
  return { files, didNormalizePaths };
};

export const isLikelyWebProject = (
  fileMap: Record<string, unknown> | null | undefined
): boolean => {
  if (!fileMap || typeof fileMap !== "object") return false;
  return Object.keys(fileMap).some((rawPath) => {
    if (!rawPath) return false;
    const normalized = rawPath.replace(/^\/+/, "").toLowerCase();
    return (
      normalized.endsWith("package.json") ||
      normalized.endsWith("index.html") ||
      normalized.includes("src/") ||
      normalized.endsWith("vite.config.js") ||
      normalized.endsWith("vite.config.ts")
    );
  });
};
