export const normalizeWebProjectPath = (rawPath: string): string => {
  let next = (rawPath || "").trim();
  if (!next) return "";
  next = next.replace(/^\/+/, "");
  next = next.replace(/^workspace\//, "");
  return next;
};

export const ensureWorkspacePath = (rawPath: string): string =>
  normalizeWebProjectPath(rawPath);

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
  const normalized = normalizeWebProjectPath(rawPath);
  if (!normalized) return "";
  const baseDir = resolveWebContainerWorkspaceDir(workdir).replace(/\/$/, "");
  return `${baseDir}/${normalized}`.replace(/\/{2,}/g, "/");
};
