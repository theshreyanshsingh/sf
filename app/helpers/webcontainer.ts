"use client";

import type {
  FileSystemTree,
  WebContainer,
} from "@webcontainer/api";

import { mergePreviewBridgeScripts } from "./mergePreviewBridgeScripts";

/* ------------------------------------------------------------------ */
/*  Singleton                                                          */
/* ------------------------------------------------------------------ */

let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;
let previewForwardingAttached = false;

async function attachPreviewForwardingIfNeeded(wc: WebContainer): Promise<void> {
  if (typeof window === "undefined" || previewForwardingAttached) return;
  previewForwardingAttached = true;
  const {
    dispatchPreviewRuntimeError,
    previewMessageToDetail,
  } = await import("@/app/helpers/previewRuntimeErrorEvents");
  wc.on("preview-message", (msg) => {
    dispatchPreviewRuntimeError(previewMessageToDetail(msg));
  });
  wc.on("error", (err) => {
    dispatchPreviewRuntimeError({
      id: `wc-int-${Date.now()}`,
      source: "webcontainer-internal",
      title: "WebContainer error",
      body: err.message || "Unknown internal error",
    });
  });
}

const normalizeProjectPath = (path: string): string =>
  (path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^workspace\//, "");

export async function boot(): Promise<WebContainer> {
  if (instance) {
    await attachPreviewForwardingIfNeeded(instance);
    return instance;
  }
  if (booting) return booting;

  booting = (async () => {
    try {
      const { WebContainer: WC } = await import("@webcontainer/api");
      const wc = await WC.boot({ forwardPreviewErrors: true });
      instance = wc;
      await attachPreviewForwardingIfNeeded(wc);
      return wc;
    } catch (err) {
      booting = null;
      throw err;
    }
  })();

  return booting;
}

export function getContainer(): WebContainer | null {
  return instance;
}

/* ------------------------------------------------------------------ */
/*  CRUD — every operation awaits boot() first, fully promise-based    */
/* ------------------------------------------------------------------ */

export async function writeFile(
  path: string,
  content: string | Uint8Array,
): Promise<void> {
  const wc = await boot();
  const normalized = normalizeProjectPath(path);
  const abs = normalized ? `/${normalized}` : "/";
  const dir = abs.substring(0, abs.lastIndexOf("/"));
  if (dir && dir !== "/") {
    await wc.fs.mkdir(dir, { recursive: true }).catch(() => {});
  }
  await wc.fs.writeFile(abs, content);
}

export async function readFile(
  path: string,
  encoding: "utf-8" | null = "utf-8",
): Promise<string | Uint8Array> {
  const wc = await boot();
  const normalized = normalizeProjectPath(path);
  const abs = normalized ? `/${normalized}` : "/";
  return encoding ? wc.fs.readFile(abs, encoding) : wc.fs.readFile(abs);
}

export async function mkdirp(path: string): Promise<void> {
  const wc = await boot();
  const normalized = normalizeProjectPath(path);
  const abs = normalized ? `/${normalized}` : "/";
  await wc.fs.mkdir(abs, { recursive: true });
}

export async function rm(
  path: string,
  opts: { recursive?: boolean; force?: boolean } = {},
): Promise<void> {
  const wc = await boot();
  const normalized = normalizeProjectPath(path);
  const abs = normalized ? `/${normalized}` : "/";
  await wc.fs.rm(abs, { recursive: opts.recursive ?? false, force: opts.force ?? true });
}

export async function readdir(path: string): Promise<string[]> {
  const wc = await boot();
  const normalized = normalizeProjectPath(path);
  const abs = normalized ? `/${normalized}` : "/";
  return wc.fs.readdir(abs);
}

export async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path, null);
    return true;
  } catch {
    try {
      await readdir(path);
      return true;
    } catch {
      return false;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Mount — write a flat {path: content} map into the container FS     */
/*  Converts flat paths into nested FileSystemTree for mount()         */
/* ------------------------------------------------------------------ */

type TreeNode = {
  file?: { contents: string };
  directory?: Record<string, TreeNode>;
};

function buildTree(files: Record<string, string>): FileSystemTree {
  const root: Record<string, TreeNode> = {};

  for (const [filePath, contents] of Object.entries(files)) {
    const clean = normalizeProjectPath(filePath);
    if (!clean) continue;

    const parts = clean.split("/");
    let cursor = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        cursor[part] = { file: { contents } };
      } else {
        if (!cursor[part] || !cursor[part].directory) {
          cursor[part] = { directory: {} };
        }
        cursor = cursor[part].directory!;
      }
    }
  }

  return root as FileSystemTree;
}

export async function mountFiles(
  files: Record<string, string>,
): Promise<void> {
  const wc = await boot();
  const tree = buildTree(files);
  await wc.mount(tree);
}

/* ------------------------------------------------------------------ */
/*  Fetch test-files from the local API and mount them                 */
/* ------------------------------------------------------------------ */

export async function fetchAndMountTestFiles(): Promise<Record<string, string> | null> {
  console.log("[webcontainer] fetching test files...");
  const res = await fetch("/api/test-files");
  if (!res.ok) {
    console.error("[webcontainer] test-files fetch failed:", res.status);
    return null;
  }

  const files = (await res.json()) as Record<string, string>;
  if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
    console.error("[webcontainer] test-files response empty");
    return null;
  }

  const merged = await mergePreviewBridgeScripts(files);
  console.log(
    "[webcontainer] mounting",
    Object.keys(merged).length,
    "files:",
    Object.keys(merged).join(", "),
  );
  await mountFiles(merged);
  console.log("[webcontainer] mount complete");
  return merged;
}

/* ------------------------------------------------------------------ */
/*  Sync files — write individual files into the container FS           */
/*  Additive only: overwrites matching paths, never deletes existing    */
/* ------------------------------------------------------------------ */

export async function syncFiles(
  files: Record<string, string>,
): Promise<void> {
  const wc = await boot();

  for (const [rawPath, content] of Object.entries(files)) {
    const normalizedPath = normalizeProjectPath(rawPath);
    if (!normalizedPath) continue;

    // Don't overwrite the Vite entry index.html with a static HTML page
    if (
      normalizedPath === "index.html" &&
      typeof content === "string" &&
      !content.includes('<script type="module"')
    ) continue;

    const abs = `/${normalizedPath}`;
    const dir = abs.substring(0, abs.lastIndexOf("/"));
    try {
      if (dir && dir !== "/") {
        await wc.fs.mkdir(dir, { recursive: true });
      }
      await wc.fs.writeFile(abs, content);
    } catch {
      /* non-fatal — skip files that fail */
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Server-ready listener                                              */
/*  Call once after boot — fires cb whenever a dev server starts        */
/* ------------------------------------------------------------------ */

let serverReadyRegistered = false;
const serverReadyCallbacks = new Set<(port: number, url: string) => void>();

export async function onServerReady(
  cb: (port: number, url: string) => void,
): Promise<() => void> {
  serverReadyCallbacks.add(cb);
  if (!serverReadyRegistered) {
    const wc = await boot();
    serverReadyRegistered = true;
    wc.on("server-ready", (port, url) => {
      serverReadyCallbacks.forEach((callback) => callback(port, url));
    });
  }

  return () => {
    serverReadyCallbacks.delete(cb);
  };
}
