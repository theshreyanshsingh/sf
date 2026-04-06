/**
 * Ensures WebContainer Vite previews load `public/wysiwyg-editor.js` and inject a script tag
 * into `index.html`. React/Vite `index.html` from the worker omits this script (see worker.js),
 * so parent postMessage for Inspector / WYSIWYG had no listener in the iframe.
 */
let wysiwygEditorSource: string | null = null;

/**
 * WebContainer dev preview runs in the Superblocks desktop/agent UI — hide the
 * "Made by Superblocks" badge there. Production `vite build` (e.g. worker
 * deploy) still uses the project's vite.config unchanged.
 */
function stripSuperblocksBadgePluginFromViteConfigs(
  files: Record<string, string>,
): void {
  const keys = [
    "vite.config.js",
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.mjs",
  ];
  for (const key of keys) {
    const src = files[key];
    if (typeof src !== "string" || !src.includes("SuperblocksBadgePlugin")) {
      continue;
    }
    let next = src.replace(/\r\n/g, "\n");
    next = next.replace(/\n[ \t]*SuperblocksBadgePlugin\(\)[ \t]*,?[ \t]*/g, "\n");
    next = next.replace(/,\s*,(\s*\n)/g, ",$1");
    next = next.replace(/\[\s*,/g, "[");
    files[key] = next;
  }
}

export async function mergePreviewBridgeScripts(
  files: Record<string, string>,
): Promise<Record<string, string>> {
  const out = { ...files };
  stripSuperblocksBadgePluginFromViteConfigs(out);

  try {
    if (wysiwygEditorSource === null) {
      const res = await fetch("/wysiwyg-editor.js");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      wysiwygEditorSource = await res.text();
    }
    out["public/wysiwyg-editor.js"] = wysiwygEditorSource;
  } catch (err) {
    console.warn("[preview-bridge] failed to bundle wysiwyg-editor.js", err);
    return out;
  }

  const idx = out["index.html"];
  if (typeof idx !== "string" || /wysiwyg-editor\.js/i.test(idx)) {
    return out;
  }

  const hasReactRoot =
    idx.includes('id="root"') || idx.includes("id='root'");
  if (!hasReactRoot) {
    return out;
  }

  const lower = idx.toLowerCase();
  const closeBody = lower.lastIndexOf("</body>");
  if (closeBody === -1) {
    return out;
  }

  out["index.html"] =
    idx.slice(0, closeBody) +
    `  <script src="/wysiwyg-editor.js" defer></script>\n` +
    idx.slice(closeBody);

  return out;
}
