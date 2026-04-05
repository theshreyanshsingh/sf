/**
 * Ensures WebContainer Vite previews load `public/wysiwyg-editor.js` and inject a script tag
 * into `index.html`. React/Vite `index.html` from the worker omits this script (see worker.js),
 * so parent postMessage for Inspector / WYSIWYG had no listener in the iframe.
 */
let wysiwygEditorSource: string | null = null;

export async function mergePreviewBridgeScripts(
  files: Record<string, string>,
): Promise<Record<string, string>> {
  const out = { ...files };

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
