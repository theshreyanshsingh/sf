import type { AppDispatch } from "../redux/store";
import type { Message, ToolResult } from "../redux/reducers/chatSlice";
import type { Todo } from "../redux/reducers/todosSlice";
import { updateTodosFromTool } from "../redux/reducers/todosSlice";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { output: s };
  }
}

function normalizeToolResultShape(tr: unknown): ToolResult | undefined {
  if (!isRecord(tr)) return undefined;
  const UsedTool =
    typeof tr.UsedTool === "string"
      ? tr.UsedTool
      : typeof tr.usedTool === "string"
        ? tr.usedTool
        : undefined;
  if (!UsedTool && !tr.result && !tr.fileWrite && !tr.fileWrites) return undefined;
  return tr as ToolResult;
}

function collectFileWritesFromDb(raw: Record<string, unknown>): Array<{
  path: string;
  content: string;
}> {
  const out: Array<{ path: string; content: string }> = [];
  const push = (path: unknown, content: unknown) => {
    if (typeof path !== "string") return;
    if (typeof content === "string") {
      out.push({ path, content });
      return;
    }
    if (content != null && typeof content === "object") {
      try {
        out.push({ path, content: JSON.stringify(content, null, 2) });
      } catch {
        /* skip */
      }
    }
  };

  if (isRecord(raw.fileWrite)) {
    push(raw.fileWrite.path, raw.fileWrite.content);
  }

  const toolCalls = Array.isArray(raw.toolCalls) ? raw.toolCalls : [];
  for (const tc of toolCalls) {
    if (!isRecord(tc)) continue;
    if (tc.tool !== "code_write") continue;
    if (isRecord(tc.fileWrite)) {
      push(tc.fileWrite.path, tc.fileWrite.content);
    }
    const args = isRecord(tc.args) ? tc.args : null;
    if (
      args &&
      typeof args.path === "string" &&
      args.content !== undefined &&
      args.content !== null
    ) {
      push(args.path, args.content);
    }
    const files = args && isRecord(args.files) ? args.files : null;
    if (files) {
      for (const [p, c] of Object.entries(files)) {
        push(
          p,
          typeof c === "string" ? c : JSON.stringify(c, null, 2),
        );
      }
    }
  }

  const byPath = new Map<string, { path: string; content: string }>();
  out.forEach((w) => byPath.set(w.path, w));
  return Array.from(byPath.values());
}

function mergeResultFromToolCalls(
  usedTool: string | undefined,
  toolCalls: unknown[],
): ToolResult["result"] | undefined {
  let merged: ToolResult["result"] | undefined;
  for (const tc of toolCalls) {
    if (!isRecord(tc) || tc.result == null) continue;
    const r =
      typeof tc.result === "string" ? tryParseJson(tc.result) : tc.result;
    if (!isRecord(r)) continue;
    const meta = r.metadata;
    if (
      tc.tool === "todo_write" &&
      isRecord(meta) &&
      Array.isArray(meta.todos)
    ) {
      merged = { ...merged, ...r } as ToolResult["result"];
    }
    if (usedTool && tc.tool === usedTool) {
      merged = { ...merged, ...r } as ToolResult["result"];
    }
  }
  return merged;
}

/** Build `toolResult` for UI from Mongo/API message shape (`usedTool`, `fileWrite`, `toolCalls`). */
export function buildToolResultFromDbMessage(
  raw: Record<string, unknown>,
): ToolResult | undefined {
  const existing = normalizeToolResultShape(raw.toolResult);
  if (existing?.UsedTool) return existing;

  const usedTool =
    typeof raw.usedTool === "string" ? raw.usedTool : undefined;
  const toolCalls = Array.isArray(raw.toolCalls) ? raw.toolCalls : [];
  const fileWrites = collectFileWritesFromDb(raw);
  const result = mergeResultFromToolCalls(usedTool, toolCalls);

  const impliedTool =
    usedTool ||
    (fileWrites.length > 0 ? "code_write" : undefined) ||
    (result?.metadata?.todos ? "todo_write" : undefined);

  if (!impliedTool && !result && fileWrites.length === 0) return undefined;

  const tr: ToolResult = {
    UsedTool: impliedTool,
    result,
    ...(fileWrites.length === 1
      ? { fileWrite: fileWrites[0], fileWrites }
      : fileWrites.length > 1
        ? { fileWrites }
        : {}),
  };

  return tr;
}

export function dbMessageToUiMessage(chat: unknown): Message {
  const raw = chat as Record<string, unknown>;
  const roleRaw = typeof raw.role === "string" ? raw.role : "";
  const role: Message["role"] =
    roleRaw === "user" ? "user" : "assistant";

  const toolResult = buildToolResultFromDbMessage(raw);

  return {
    id: String(raw._id || raw.id || `msg-${Date.now()}-${Math.random()}`),
    _id: raw._id != null ? String(raw._id) : raw.id != null ? String(raw.id) : undefined,
    role,
    content: String(raw.content ?? raw.text ?? ""),
    createdAt: (raw.createdAt as string) || new Date().toISOString(),
    attachments: (raw.attachments as Message["attachments"]) || [],
    toolResult,
    codeUrl:
      typeof raw.codeUrl === "string"
        ? raw.codeUrl
        : typeof raw.code_url === "string"
          ? raw.code_url
          : undefined,
    chatId: typeof raw.chatId === "string" ? raw.chatId : undefined,
    agentRun:
      typeof raw.agentRunDurationMs === "number" &&
      raw.agentRunDurationMs > 0
        ? { durationMs: raw.agentRunDurationMs }
        : undefined,
  };
}

/** Map stream JSON payload to visible text + tool card (matches DB-backed `toolResult` shape). */
export function streamPayloadToAssistantParts(parsed: Record<string, unknown>): {
  userMessage: string;
  toolResult?: ToolResult;
  skipMessage: boolean;
} {
  if (
    parsed.tokenUsage &&
    typeof parsed.tokenUsage === "object" &&
    !parsed.UsedTool
  ) {
    return { userMessage: "", toolResult: undefined, skipMessage: true };
  }

  const userMessage =
    (typeof parsed.u_msg === "string" ? parsed.u_msg : "") ||
    (typeof parsed.content === "string" ? parsed.content : "") ||
    "";

  if (!parsed.UsedTool) {
    return {
      userMessage,
      toolResult: undefined,
      skipMessage: !userMessage.trim(),
    };
  }

  const toolResult: ToolResult = {
    UsedTool: parsed.UsedTool as string,
    result: parsed.result as ToolResult["result"],
    fileWrite: parsed.fileWrite as ToolResult["fileWrite"],
    fileWrites: parsed.fileWrites as ToolResult["fileWrites"],
  };

  return {
    userMessage,
    toolResult,
    skipMessage: !userMessage.trim() && !parsed.UsedTool,
  };
}

export type SseCarryState = { carry: string };

/** Reassemble SSE `data:` lines into a single string for `___start___` / `___end___` parsing. */
export function appendChunkToSsePayload(
  chunk: string,
  state: SseCarryState,
): string {
  state.carry += chunk;
  let out = "";
  while (true) {
    const idx = state.carry.indexOf("\n\n");
    if (idx === -1) break;
    const event = state.carry.slice(0, idx);
    state.carry = state.carry.slice(idx + 2);
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]" || data === "stream_start") continue;
      out += data;
    }
  }
  return out;
}

export function flushSseCarry(state: SseCarryState): string {
  const rest = state.carry;
  state.carry = "";
  if (!rest.trim()) return "";
  let out = "";
  for (const line of rest.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]" || data === "stream_start") continue;
    out += data;
  }
  return out;
}

/** Apply latest todo snapshot from hydrated history (any message carrying `metadata.todos`). */
export function syncTodosFromHydratedMessages(
  messages: Message[],
  dispatch: AppDispatch,
): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const todos = m.toolResult?.result?.metadata?.todos;
    if (!todos?.length || !m.toolResult?.result?.metadata) continue;
    const md = m.toolResult.result.metadata;
    dispatch(
      updateTodosFromTool({
        todos: todos.map((t) => {
          const pr = t.priority;
          const priority: Todo["priority"] =
            pr === "low" || pr === "medium" || pr === "high" ? pr : undefined;
          return {
            ...t,
            status: (t.status || "pending") as Todo["status"],
            priority,
          };
        }),
        total: md.total,
        pending: md.pending,
        completed: md.completed,
      }),
    );
    return;
  }
}
