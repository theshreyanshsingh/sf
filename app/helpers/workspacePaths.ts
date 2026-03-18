export const ensureWorkspacePath = (rawPath: string): string => {
  let next = (rawPath || "").trim();
  if (!next) return "";
  next = next.replace(/^\/+/, "");
  if (!next.startsWith("workspace/")) {
    next = `workspace/${next}`;
  }
  return next;
};

export const resolveWebContainerWorkspaceDir = (
  workdir?: string | null,
): string => {
  if (typeof window !== "undefined") {
    try {
      const { getContainer } = require("./webcontainer");
      const wc = getContainer();
      if (wc?.workdir) return wc.workdir;
    } catch { /* fallback */ }
  }
  const raw = (workdir || "").replace(/\/$/, "");
  if (raw) return raw.startsWith("/") ? raw : `/${raw}`;
  return "/home/user";
};

export const toWebContainerPath = (
  rawPath: string,
  workdir?: string | null,
): string => {
  const normalized = ensureWorkspacePath(rawPath);
  if (!normalized) return "";
  const relative = normalized.replace(/^workspace\//, "");
  const baseDir = resolveWebContainerWorkspaceDir(workdir).replace(/\/$/, "");
  return `${baseDir}/${relative}`.replace(/\/{2,}/g, "/");
};
