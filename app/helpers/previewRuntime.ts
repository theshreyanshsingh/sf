import { inferPreviewRuntime, type PreviewRuntime } from "@/default/mobile";

type PreviewRuntimeHint = {
  previewRuntime?: unknown;
  runtime?: unknown;
  platform?: unknown;
  projectRuntime?: unknown;
  framework?: unknown;
};

export const normalizePreviewRuntimeValue = (
  value: unknown,
): PreviewRuntime | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "web" || normalized === "mobile") return normalized;
  return null;
};

export const resolvePreviewRuntimeFromLooseHint = (
  hint: unknown,
): PreviewRuntime | null => {
  const explicit = normalizePreviewRuntimeValue(hint);
  if (explicit) return explicit;
  if (typeof hint !== "string") return null;
  const trimmed = hint.trim();
  if (!trimmed) return null;
  return inferPreviewRuntime(trimmed);
};

export const resolvePreviewRuntimeHint = (
  hint: PreviewRuntimeHint,
): PreviewRuntime | null => {
  const explicit =
    normalizePreviewRuntimeValue(hint.previewRuntime) ||
    normalizePreviewRuntimeValue(hint.runtime) ||
    normalizePreviewRuntimeValue(hint.platform) ||
    normalizePreviewRuntimeValue(hint.projectRuntime);
  if (explicit) return explicit;

  if (typeof hint.framework === "string" && hint.framework.trim()) {
    return inferPreviewRuntime(hint.framework);
  }

  return null;
};

const resolvePreviewRuntimeFromCandidate = (
  candidate: unknown,
): PreviewRuntime | null => {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  return resolvePreviewRuntimeHint({
    previewRuntime: record.previewRuntime,
    runtime: record.runtime,
    platform: record.platform,
    projectRuntime: record.projectRuntime,
    framework: record.framework,
  });
};

export const resolvePreviewRuntimeFromRecord = (
  record: Record<string, unknown>,
): PreviewRuntime | null => {
  const direct = resolvePreviewRuntimeFromCandidate(record);
  if (direct) return direct;

  const payloadRuntime = resolvePreviewRuntimeFromCandidate(record.payload);
  if (payloadRuntime) return payloadRuntime;

  const resultRuntime = resolvePreviewRuntimeFromCandidate(record.result);
  if (resultRuntime) return resultRuntime;

  const dataRuntime = resolvePreviewRuntimeFromCandidate(record.data);
  if (dataRuntime) return dataRuntime;

  return null;
};

export const readPreviewRuntimeFromSession = (
  projectId: string,
): PreviewRuntime | null => {
  if (typeof window === "undefined" || !projectId) return null;

  const cachedRuntime = normalizePreviewRuntimeValue(
    sessionStorage.getItem(`superblocksProjectRuntime_${projectId}`),
  );
  if (cachedRuntime) return cachedRuntime;

  const sessionKey = `superblocksMessage_${projectId}`;
  const storedData = sessionStorage.getItem(sessionKey);
  if (!storedData) return null;

  try {
    const parsed = JSON.parse(storedData) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return resolvePreviewRuntimeFromRecord(parsed as Record<string, unknown>);
  } catch (error) {
    console.error("Error reading pending preview runtime:", error);
    return null;
  }
};

export const persistProjectRuntime = (
  projectId?: string,
  runtime?: unknown,
) => {
  if (typeof window === "undefined") return;
  if (!projectId) return;
  const normalized = normalizePreviewRuntimeValue(runtime);
  if (!normalized) return;
  sessionStorage.setItem(`superblocksProjectRuntime_${projectId}`, normalized);
};
