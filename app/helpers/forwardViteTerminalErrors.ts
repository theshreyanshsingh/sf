"use client";

import { dispatchPreviewRuntimeError } from "./previewRuntimeErrorEvents";

/** Rolling tail of primary shell output — Vite logs compile errors here, not in the iframe. */
const MAX_WINDOW = 20000;

let windowBuf = "";

const MARKERS = [
  "[vite] internal server error",
  "[vite] pre-transform error",
  "[vite] (client) pre-transform error",
  "[vite] (ssr) pre-transform error",
] as const;

export function resetViteTerminalErrorBuffer(): void {
  windowBuf = "";
}

/**
 * Call for each stdout/stderr chunk from WebContainer terminal-1 (where `npm run dev` runs).
 * When Vite prints a compile/transform error, dispatches `SB_PREVIEW_RUNTIME_ERROR` on `window`
 * so PreviewRuntimeErrorBar can show Try fixing.
 */
export function ingestPrimaryTerminalOutputChunk(chunk: string): void {
  if (!chunk) return;
  windowBuf += chunk;
  if (windowBuf.length > MAX_WINDOW) {
    windowBuf = windowBuf.slice(-MAX_WINDOW);
  }

  const lower = windowBuf.toLowerCase();
  let start = -1;
  for (const m of MARKERS) {
    const idx = lower.lastIndexOf(m);
    if (idx > start) start = idx;
  }
  if (start === -1) return;

  const body = windowBuf.slice(start).trim();
  if (body.length < 24) return;

  dispatchPreviewRuntimeError({
    id: `vite-term-${start}-${body.length}`,
    source: "vite-terminal",
    title: "Vite dev server error (terminal)",
    body: body.slice(0, 14000),
  });
}
