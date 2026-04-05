"use client";

import type { PreviewMessage } from "@webcontainer/api";
import { PreviewMessageType } from "@webcontainer/api";

/** Fired when the WebContainer preview (or embedded app) reports an error. */
export const SB_PREVIEW_RUNTIME_ERROR = "SB_PREVIEW_RUNTIME_ERROR";

/**
 * Prefill the project chat composer (Keyboard listens).
 * `detail`: `{ text: string; autoSubmit?: boolean }` — when `autoSubmit` is true, Keyboard sends the agent request immediately (one-click fix from preview bar).
 */
export const SB_COMPOSER_PREFILL = "SB_COMPOSER_PREFILL";

export type PreviewRuntimeErrorSource =
  | "webcontainer-preview"
  | "webcontainer-internal"
  | "preview-postmessage";

export type PreviewRuntimeErrorDetail = {
  id: string;
  source: PreviewRuntimeErrorSource;
  title: string;
  body: string;
  stack?: string;
  port?: number;
  pathname?: string;
};

let lastFingerprint = "";
let lastAt = 0;
const DEDUPE_MS = 2000;

function fingerprint(d: PreviewRuntimeErrorDetail): string {
  return `${d.source}:${d.title}:${d.body.slice(0, 800)}`;
}

/**
 * React warns when JSX uses `data-Superblocks-code` instead of `data-superblocks-code`.
 * 1) If the invalid casing appears literally, always hide (matches React's warning args).
 * 2) Otherwise hide known full-message patterns mentioning superblocks-code.
 */
function shouldSuppressPreviewRuntimeError(d: PreviewRuntimeErrorDetail): boolean {
  const combined = `${d.title}\n${d.body}\n${d.stack ?? ""}`;

  // Exact bad attribute from codegen (capital S). React echoes this even when the template uses %s.
  if (/data-Superblocks-code/.test(combined)) return true;

  if (!/superblocks-code/i.test(combined)) return false;

  return (
    /does not recognize/i.test(combined) ||
    /spell it as lowercase/i.test(combined) ||
    /Invalid DOM property/i.test(combined) ||
    /React does not understand/i.test(combined) ||
    /passed it from a parent/i.test(combined) ||
    /remove it from the DOM/i.test(combined) ||
    /on a DOM element/i.test(combined) ||
    /custom attribute/i.test(combined)
  );
}

/** De-duplicated dispatch so Vite overlay polling / duplicate events do not spam the UI. */
export function dispatchPreviewRuntimeError(detail: PreviewRuntimeErrorDetail): void {
  if (typeof window === "undefined") return;
  if (shouldSuppressPreviewRuntimeError(detail)) return;
  const fp = fingerprint(detail);
  const now = Date.now();
  if (fp === lastFingerprint && now - lastAt < DEDUPE_MS) return;
  lastFingerprint = fp;
  lastAt = now;
  window.dispatchEvent(
    new CustomEvent(SB_PREVIEW_RUNTIME_ERROR, { detail }),
  );
}

export function previewMessageToDetail(msg: PreviewMessage): PreviewRuntimeErrorDetail {
  const id = `wc-pv-${msg.previewId}-${Date.now()}`;
  const base = {
    id,
    source: "webcontainer-preview" as const,
    port: msg.port,
    pathname: msg.pathname,
  };

  switch (msg.type) {
    case PreviewMessageType.UncaughtException:
      return {
        ...base,
        title: "Uncaught exception in preview",
        body: msg.message,
        stack: msg.stack,
      };
    case PreviewMessageType.UnhandledRejection:
      return {
        ...base,
        title: "Unhandled promise rejection in preview",
        body: msg.message,
        stack: msg.stack,
      };
    case PreviewMessageType.ConsoleError:
      return {
        ...base,
        title: "Console error in preview",
        body: formatConsoleArgs(msg.args),
        stack: msg.stack,
      };
    default:
      return {
        ...base,
        title: "Preview error",
        body: String(msg),
      };
  }
}

function formatConsoleArgs(args: unknown[]): string {
  if (!args?.length) return "(console.error with no message)";
  try {
    return args
      .map((a) =>
        typeof a === "string"
          ? a
          : a instanceof Error
            ? `${a.message}\n${a.stack || ""}`
            : JSON.stringify(a),
      )
      .join(" ");
  } catch {
    return String(args);
  }
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  react_component_error: "React error",
  javascript_runtime_error: "JavaScript error",
  resource_loading_error: "Resource failed to load",
  unhandled_promise_rejection: "Unhandled rejection",
  vite_module_error: "Vite / module error",
  api_request_error: "API error",
};

/** Normalize `ErrorReporter` / SUPERBLOCKS postMessage payloads from the preview iframe. */
export function superblocksErrorsPayloadToDetail(data: unknown): PreviewRuntimeErrorDetail | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== "SUPERBLOCKS_ERRORS") return null;
  const err = d.error as Record<string, unknown> | undefined;
  const errorType =
    typeof d.errorType === "string" ? d.errorType : "preview_error";
  const title =
    ERROR_TYPE_LABELS[errorType] ||
    errorType.replace(/_/g, " ");
  const message =
    typeof err?.message === "string"
      ? err.message
      : typeof d.message === "string"
        ? d.message
        : "Unknown preview error";
  const stack = typeof err?.stack === "string" ? err.stack : undefined;
  const ts =
    typeof d.timestamp === "number" ? d.timestamp : Date.now();
  return {
    id: `pm-${ts}-${Math.random().toString(36).slice(2, 9)}`,
    source: "preview-postmessage",
    title,
    body: message,
    stack,
  };
}

export function buildTryFixPrompt(detail: PreviewRuntimeErrorDetail): string {
  const lines = [
    "Please fix this preview/runtime error in the project. Make the smallest change that resolves it and keeps the Vite dev preview running.",
    "",
    `— ${detail.title} —`,
    detail.body,
  ];
  if (detail.stack?.trim()) {
    lines.push("", "Stack trace:", detail.stack.trim());
  }
  if (detail.pathname) {
    lines.push("", `Preview path: ${detail.pathname}`);
  }
  return lines.join("\n");
}
