"use client";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState, store } from "../redux/store";
import { API } from "../config/publicEnv";
import { setNotification } from "../redux/reducers/NotificationModalReducer";
import {
  setStreamActive,
  setGenerating,
  setModel,
  setPreviewRuntime,
  lockPreviewRuntime,
  setTitle,
  setTokenUsage,
  setUrl,
  setPromptCount,
  setPreviewSnackFiles,
  setPreviewSnackDependencies,
  updatePreviewSnackFiles,
  updatePreviewSnackDependencies,
} from "../redux/reducers/projectOptions";
import { setPricingModalOpen } from "../redux/reducers/basicData";
import {
  addMessage,
  setChatId as setChatIdInChatSlice,
  setStreamChatId,
  updateMessageAgentRun,
} from "../redux/reducers/chatSlice";
import {
  appendChunkToSsePayload,
  flushSseCarry,
  streamPayloadToAssistantParts,
  type SseCarryState,
} from "./agentMessageNormalize";
import { clearTodos, updateTodosFromTool } from "../redux/reducers/todosSlice";
import {
  setFetchedProjectData,
  updateSpecificFile,
  updateSpecificFilesBatch,
} from "../redux/reducers/projectFiles";
import type { AttachmentType } from "../../app/_components/AttachmentPreview";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  extractFileWritesFromToolResult,
  extractFileWritesFromSnapshot,
  dedupeFileWrites,
  normalizeIncomingFileContent,
  normalizeWorkspacePathForSnack,
  resolveDependencyUpdatesForWrites,
  sanitizeFileWriteContent,
} from "./fileUpdatesMobile";
import {
  DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
  DEFAULT_PREVIEW_SNACK_FILES,
} from "@/default/mobile";
const schedulePostStreamCommands = async (packageJsonPath?: string | null) => {
  if (typeof window !== "undefined") {
    const path = packageJsonPath?.trim() || null;
    window.dispatchEvent(
      new CustomEvent("SB_WEB_RUNTIME_RETRY", {
        detail: {
          packageJsonPath: path,
          /** Stream-only: WebRuntimeManager runs `exit` + fresh shell before npm when true. */
          exitBeforeNpm: Boolean(path),
        },
      }),
    );
  }
  return true;
};
const normalizeFileContent = (v: unknown): string =>
  typeof v === "string" ? v : JSON.stringify(v ?? "", null, 2);
import {
  normalizePreviewRuntimeValue,
  persistProjectRuntime,
  readPreviewRuntimeFromSession,
  resolvePreviewRuntimeFromLooseHint,
  resolvePreviewRuntimeFromRecord,
} from "@/app/helpers/previewRuntime";
import { normalizeWebProjectPath } from "@/app/helpers/workspacePaths";
import { fetchProjectSnapshot } from "@/app/helpers/fetchProjectSnapshot";

export const useCreateResponse = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data: session } = useSession();
  const previewSnackDependencies = useSelector(
    (state: RootState) => state.projectOptions.previewSnackDependencies,
  );
  const previewRuntime = useSelector(
    (state: RootState) => state.projectOptions.previewRuntime,
  );
  const currentProjectId = useSelector(
    (state: RootState) => state.projectOptions.projectId,
  );
  const activeChatId = useSelector(
    (state: RootState) => state.messagesprovider.chatId,
  );
  const previewSnackDependenciesRef = useRef(previewSnackDependencies);
  const previewRuntimeRef = useRef(previewRuntime);
  const explicitRuntimeRef = useRef<"web" | "mobile" | null>(null);
  const sseCarryRef = useRef<SseCarryState>({ carry: "" });
  const streamStartedAtMsRef = useRef<number | null>(null);
  const lastStreamAssistantMessageIdRef = useRef<string | null>(null);

  const shouldDebugWebContainerWrites = () => {
    if (typeof window === "undefined") return false;
    return (window as any).__SB_DEBUG_WC_WRITES__ === true;
  };

  const debugWc = (...args: unknown[]) => {
    if (!shouldDebugWebContainerWrites()) return;
    console.debug("[WC-WRITE-DEBUG]", ...args);
  };

  const logWc = (...args: unknown[]) => {
    if (!shouldDebugWebContainerWrites()) return;
    console.log("[WC-WRITE-DEBUG]", ...args);
  };

  const warnWc = (...args: unknown[]) => {
    if (!shouldDebugWebContainerWrites()) return;
    console.warn("[WC-WRITE-DEBUG]", ...args);
  };

  useEffect(() => {
    previewSnackDependenciesRef.current = previewSnackDependencies;
  }, [previewSnackDependencies]);

  useEffect(() => {
    previewRuntimeRef.current = previewRuntime;
  }, [previewRuntime]);

  const applyPreviewDependencyUpdates = (
    updates: Record<string, string | null>,
  ) => {
    if (!Object.keys(updates).length) return;

    dispatch(updatePreviewSnackDependencies(updates));
    const nextDependencies = { ...previewSnackDependenciesRef.current };
    Object.entries(updates).forEach(([name, version]) => {
      if (version === null) {
        delete nextDependencies[name];
      } else {
        nextDependencies[name] = version;
      }
    });
    previewSnackDependenciesRef.current = nextDependencies;
  };

  const applyPreviewRuntimeHint = (runtimeHint?: string | null) => {
    const nextRuntime = resolvePreviewRuntimeFromLooseHint(runtimeHint);
    if (!nextRuntime) {
      return previewRuntimeRef.current;
    }
    const state = store.getState();
    if (state.projectOptions.runtimeLocked) {
      return previewRuntimeRef.current;
    }
    previewRuntimeRef.current = nextRuntime;
    dispatch(lockPreviewRuntime(nextRuntime));
    return nextRuntime;
  };

  const WEB_BUILD_TOOL_REGEX =
    /(?:^|\/)(?:vite|next|webpack|nuxt|angular)\.config\.(js|ts|mjs|cjs)$/i;

  const validateRuntimeFromHydratedFiles = (projectId: string) => {
    if (previewRuntimeRef.current !== "mobile") return;
    if (explicitRuntimeRef.current === "mobile") return;
    const projectData = store.getState().projectFiles.data;
    if (!projectData || typeof projectData !== "object") return;
    const fileKeys = Object.keys(projectData as Record<string, unknown>);
    const hasWebBuildTool = fileKeys.some((k) => WEB_BUILD_TOOL_REGEX.test(k));
    if (hasWebBuildTool) {
      debugWc("runtime override: files indicate web, not mobile", { fileKeys });
      previewRuntimeRef.current = "web";
      dispatch(lockPreviewRuntime("web"));
      persistProjectRuntime(projectId, "web");
    }
  };

  const shouldHydrateFromSnapshot = () => {
    const state = store.getState();
    const projectData = state.projectFiles.data;
    if (!projectData || typeof projectData !== "object") return true;
    const keys = Object.keys(projectData as Record<string, unknown>);
    const hasPackageJson =
      keys.some((key) => normalizeWebProjectPath(key) === "package.json");
    return keys.length === 0 || !hasPackageJson;
  };

  const finalizeStreamAgentRun = () => {
    const id = lastStreamAssistantMessageIdRef.current;
    const startMs = streamStartedAtMsRef.current;
    if (!id || startMs == null) {
      lastStreamAssistantMessageIdRef.current = null;
      streamStartedAtMsRef.current = null;
      return;
    }
    const ended = Date.now();
    dispatch(
      updateMessageAgentRun({
        id,
        agentRun: {
          startedAt: new Date(startMs).toISOString(),
          endedAt: new Date(ended).toISOString(),
          durationMs: Math.max(0, ended - startMs),
        },
      }),
    );
    lastStreamAssistantMessageIdRef.current = null;
    streamStartedAtMsRef.current = null;
  };

  const PROMPT_QUOTA_DEFAULT_MESSAGE =
    "You've used all prompts for your current plan. Upgrade to continue with the agent.";

  /** Returns true if handled (caller should return early). */
  const applyPromptQuotaExhausted = (
    body: Record<string, unknown>,
    opts: { chatId?: string | null },
  ): boolean => {
    const upgradeNeeded = body.upgradeNeeded === true;
    const errorCode =
      typeof body.errorCode === "string" ? body.errorCode : "";
    if (!upgradeNeeded && errorCode !== "PROMPT_QUOTA_EXHAUSTED") {
      return false;
    }

    const text =
      typeof body.message === "string" && body.message.trim().length > 0
        ? body.message.trim()
        : PROMPT_QUOTA_DEFAULT_MESSAGE;
    const nextCount =
      typeof body.promptCount === "number" && Number.isFinite(body.promptCount)
        ? body.promptCount
        : 0;

    finalizeStreamAgentRun();
    dispatch(setPromptCount(nextCount));
    dispatch(clearTodos());
    dispatch(setStreamActive(false));
    dispatch(setStreamChatId(null));

    dispatch(
      addMessage({
        id: `msg-quota-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "assistant",
        content: text,
        createdAt: new Date().toISOString(),
        chatId: opts.chatId ?? undefined,
      }),
    );
    dispatch(setPricingModalOpen(true));
    return true;
  };

  const persistChatId = (nextChatId?: string | null, projectId?: string) => {
    if (!nextChatId) return;
    dispatch(setChatIdInChatSlice(nextChatId));
    if (typeof window !== "undefined") {
      sessionStorage.setItem("chatId", nextChatId);
      if (projectId) {
        sessionStorage.setItem(`superblocksChatId_${projectId}`, nextChatId);
      }
    }
  };

  const maybeRunWebCommandsAfterStream = async (
    packageJsonPath: string | null,
  ) => {
    if (previewRuntimeRef.current === "mobile") return;
    await schedulePostStreamCommands(packageJsonPath);
  };

  const resolveCodeUrlFromPayload = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;

    const record = payload as Record<string, unknown>;
    const toolName =
      typeof record.UsedTool === "string"
        ? record.UsedTool
        : typeof record.usedTool === "string"
          ? record.usedTool
          : typeof record.tool === "string"
            ? record.tool
            : null;
    const canUseGenericUrl =
      toolName === "code_write" || toolName === "save_code";

    const directCodeUrl =
      typeof record.codeUrl === "string"
        ? record.codeUrl
        : typeof record.code_url === "string"
          ? record.code_url
          : canUseGenericUrl && typeof record.url === "string"
            ? record.url
          : null;

    if (directCodeUrl?.trim()) {
      return directCodeUrl.trim();
    }

    const result = record.result;
    if (!result || typeof result !== "object") return null;

    const resultRecord = result as Record<string, unknown>;
    const nestedCodeUrl =
      typeof resultRecord.codeUrl === "string"
        ? resultRecord.codeUrl
        : typeof resultRecord.code_url === "string"
          ? resultRecord.code_url
          : canUseGenericUrl && typeof resultRecord.url === "string"
            ? resultRecord.url
          : null;

    return nestedCodeUrl?.trim() || null;
  };

  const normalizeFileMap = (
    fileMap: Record<string, any>,
  ): Record<string, string> => {
    const normalized: Record<string, string> = {};
    for (const [path, value] of Object.entries(fileMap)) {
      normalized[path] = normalizeFileContent(value);
    }
    return normalized;
  };

  const buildFileMapFromWrites = (
    writes: Array<{ path: string; content: string }>,
  ): Record<string, string> => {
    const next: Record<string, string> = {};
    writes.forEach((write) => {
      const normalizedPath =
        previewRuntimeRef.current === "web"
          ? normalizeWebProjectPath(write.path)
          : write.path.replace(/^\/+/, "");
      if (!normalizedPath) return;
      next[normalizedPath] = write.content;
    });
    return next;
  };

  const applyIncomingWrites = async (
    writes: Array<{ path: string; content: string }>,
    toolContext?: unknown,
  ): Promise<string | null> => {
    if (!writes.length) {
      debugWc("applyIncomingWrites: no writes", {
        previewRuntime: previewRuntimeRef.current,
        hasToolContext: !!toolContext,
      });
      if (toolContext) {
        const backendDependencyUpdates = resolveDependencyUpdatesForWrites({
          toolResult: toolContext,
          currentDependencies: previewSnackDependenciesRef.current,
          allowRemovals: false,
        });

        logWc("[mobile-deps] backend-only updates", backendDependencyUpdates);

        if (
          Object.keys(backendDependencyUpdates).length > 0 &&
          previewRuntimeRef.current === "mobile"
        ) {
          applyPreviewDependencyUpdates(backendDependencyUpdates);
        }
      }
      return null;
    }

    const dedupedWrites = dedupeFileWrites(writes);
    debugWc("applyIncomingWrites", {
      writes: dedupedWrites.length,
      previewRuntime: previewRuntimeRef.current,
    });

    let updatedPackageJsonPath: string | null = null;
    const batchedProjectUpdates: Array<{ filePath: string; content: string }> =
      [];
    const batchedPreviewUpdates: Record<string, string> = {};

    for (const write of dedupedWrites) {
      const isPackageJson = write.path.toLowerCase().endsWith("package.json");
      if (isPackageJson) {
        updatedPackageJsonPath = write.path;
      }

      const normalizedContent = normalizeIncomingFileContent(write.content);
      const normalizedPath =
        previewRuntimeRef.current === "web"
          ? normalizeWebProjectPath(write.path)
          : write.path.replace(/^\/+/, "");

      if (!normalizedPath) continue;

      const previewPath = normalizeWorkspacePathForSnack(normalizedPath);
      const sanitizedPreviewContent = sanitizeFileWriteContent(
        previewPath,
        normalizedContent,
      );
      const shouldUseMobileRuntime = previewRuntimeRef.current === "mobile";
      const contentForStorage = shouldUseMobileRuntime
        ? sanitizedPreviewContent
        : normalizedContent;

      batchedProjectUpdates.push({
        filePath: normalizedPath,
        content: contentForStorage,
      });

      if (shouldUseMobileRuntime) {
        batchedPreviewUpdates[previewPath] = sanitizedPreviewContent;
      }
    }

    if (batchedProjectUpdates.length > 0) {
      if (batchedProjectUpdates.length === 1) {
        const [singleUpdate] = batchedProjectUpdates;
        dispatch(
          updateSpecificFile({
            filePath: singleUpdate.filePath,
            content: singleUpdate.content,
            createDirectories: true,
          }),
        );
      } else {
        dispatch(
          updateSpecificFilesBatch(
            batchedProjectUpdates.map((update) => ({
              ...update,
              createDirectories: true,
            })),
          ),
        );
      }
    }

    if (
      previewRuntimeRef.current === "mobile" &&
      Object.keys(batchedPreviewUpdates).length > 0
    ) {
      dispatch(updatePreviewSnackFiles(batchedPreviewUpdates));
    }

    if (toolContext && previewRuntimeRef.current === "mobile") {
      const backendDependencyUpdates = resolveDependencyUpdatesForWrites({
        toolResult: toolContext,
        fileWrites: dedupedWrites,
        currentDependencies: previewSnackDependenciesRef.current,
        allowRemovals: false,
      });

      logWc("[mobile-deps] backend+writes updates", backendDependencyUpdates);

      applyPreviewDependencyUpdates(backendDependencyUpdates);
    }

    return updatedPackageJsonPath;
  };

  const hydrateFromCodeUrl = async ({
    codeUrl,
    hydratedCodeUrls,
    projectId,
    email,
  }: {
    codeUrl?: string | null;
    hydratedCodeUrls: Set<string>;
    projectId?: string | null;
    email?: string | null;
  }): Promise<{ writesCount: number; packageJsonPath: string | null }> => {
    const normalizedCodeUrl = codeUrl?.trim();
    if (!normalizedCodeUrl) {
      return { writesCount: 0, packageJsonPath: null };
    }
    if (hydratedCodeUrls.has(normalizedCodeUrl)) {
      return { writesCount: 0, packageJsonPath: null };
    }

    hydratedCodeUrls.add(normalizedCodeUrl);

    try {
      const resolvedProjectId = projectId?.trim() || currentProjectId?.trim();
      const resolvedEmail = email?.trim() || session?.user?.email?.trim();
      if (!resolvedProjectId || !resolvedEmail) {
        console.warn("Skipping code snapshot hydration: missing project context.");
        return { writesCount: 0, packageJsonPath: null };
      }
      debugWc("hydrateFromCodeUrl", { codeUrl: normalizedCodeUrl });
      const snapshot = await fetchProjectSnapshot({
        projectId: resolvedProjectId,
        userEmail: resolvedEmail,
        codeUrl: normalizedCodeUrl,
      });
      const writes = dedupeFileWrites(
        extractFileWritesFromSnapshot(snapshot),
      );
      debugWc("hydrateFromCodeUrl -> snapshot", {
        writes: writes.length,
      });
      if (!writes.length) {
        return { writesCount: 0, packageJsonPath: null };
      }
      dispatch(setFetchedProjectData(buildFileMapFromWrites(writes)));

      const packageJsonPath = await applyIncomingWrites(writes);
      return { writesCount: writes.length, packageJsonPath };
    } catch (error) {
      console.error("Error fetching or applying code snapshot:", error);
      return { writesCount: 0, packageJsonPath: null };
    }
  };

  const hydrateFromProjectSnapshot = async ({
    projectId,
    email,
  }: {
    projectId: string;
    email: string;
  }): Promise<{ writesCount: number; packageJsonPath: string | null }> => {
    void projectId;
    void email;
    const snapshotUrl = store.getState().projectOptions.url;
    if (!snapshotUrl || typeof snapshotUrl !== "string") {
      return { writesCount: 0, packageJsonPath: null };
    }

    return await hydrateFromCodeUrl({
      codeUrl: snapshotUrl,
      hydratedCodeUrls: new Set<string>(),
      projectId,
      email,
    });
  };

  const createResponse = async ({
    input,
    email,
    projectId,
    attachments,
    chatId,
    model,
    save,
    blockContext,
    previewRuntime,
  }: {
    input?: string;
    email: string;
    projectId: string;
    fix?: boolean;
    attachments?: AttachmentType[];
    chatId?: string;
    model?: string;
    save?: boolean;
    previewRuntime?: "web" | "mobile";
    blockContext?: {
      id: string;
      html: string;
      selector?: string;
      page?: string;
    };
  }): Promise<void> => {
    if (!email) return;
    explicitRuntimeRef.current = normalizePreviewRuntimeValue(previewRuntime);
    try {
      let effectiveChatId = chatId || activeChatId || undefined;
      const hydratedCodeUrls = new Set<string>();

      if (effectiveChatId) {
        persistChatId(effectiveChatId, projectId);
      }

      const currentReduxRuntime = store.getState().projectOptions.previewRuntime;
      previewRuntimeRef.current = currentReduxRuntime;

      const runtimeHint =
        explicitRuntimeRef.current ||
        readPreviewRuntimeFromSession(projectId) ||
        currentReduxRuntime;

      if (explicitRuntimeRef.current) {
        previewRuntimeRef.current = explicitRuntimeRef.current;
        if (!store.getState().projectOptions.runtimeLocked) {
          dispatch(lockPreviewRuntime(explicitRuntimeRef.current));
        }
        persistProjectRuntime(projectId, explicitRuntimeRef.current);
      } else {
        previewRuntimeRef.current = runtimeHint;
      }

      const requestBody: Record<string, unknown> = {
        prompt: input || "",
        projectId: projectId || "",
        owner: email || "",
        model,
        attachments,
        chatId: effectiveChatId,
        fix: false,
        save,
        blockContext,
      };
      if (explicitRuntimeRef.current) {
        requestBody.previewRuntime = explicitRuntimeRef.current;
        requestBody.platform = explicitRuntimeRef.current;
      }
      const rawString = JSON.stringify(requestBody);

      const res = await fetch(`${API}/v3/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: rawString,
      });

      if (!res.ok) {
        if (res.status === 403) {
          let body: Record<string, unknown> = {};
          try {
            body = (await res.json()) as Record<string, unknown>;
          } catch {
            /* ignore */
          }
          if (applyPromptQuotaExhausted(body, { chatId: effectiveChatId })) {
            return;
          }
          throw new Error(
            `API Error: 403 ${Object.keys(body).length ? JSON.stringify(body) : "Forbidden"}`,
          );
        }
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
      }
      if (!res.body) throw new Error("Response body is null");

      const responseChatIdHeader = res.headers.get("x-chat-id");
      const responseChatId = responseChatIdHeader?.trim() || null;
      if (responseChatId) {
        effectiveChatId = responseChatId;
        persistChatId(responseChatId, projectId);
      }

      //no stream needed
      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          if (typeof data.promptCount === "number") {
            dispatch(setPromptCount(data.promptCount));
          }
          const resolvedRuntimeHint =
            resolvePreviewRuntimeFromRecord(data as Record<string, unknown>);

          const applyRuntimeHintsIfNeeded = () => {
            if (previewRuntime) return;
            if (!resolvedRuntimeHint) return;
            // Do not auto-downgrade an already-mobile project to web from generic hints.
            if (
              explicitRuntimeRef.current === "mobile" &&
              resolvedRuntimeHint === "web"
            ) {
              persistProjectRuntime(projectId, "mobile");
              return;
            }
            const nextRuntime = applyPreviewRuntimeHint(resolvedRuntimeHint);
            persistProjectRuntime(projectId, nextRuntime);
          };

          if (data.chatId) {
            effectiveChatId = data.chatId;
            persistChatId(data.chatId, projectId);

            dispatch(setTitle(data.projectTitle)); // Set in chatSlice
          }

          if (data.title) {
            dispatch(setTitle(data.title));
          }
          if (data.model) {
            dispatch(setModel(data.model));
          }

          const latestMessageCodeUrl = Array.isArray(data.messages)
            ? data.messages
                .slice()
                .reverse()
                .map((message: Record<string, unknown>) => {
                  if (typeof message?.codeUrl === "string")
                    return message.codeUrl;
                  if (typeof message?.code_url === "string")
                    return message.code_url;
                  return null;
                })
                .find(
                  (value: string | null): value is string =>
                    typeof value === "string",
                )
            : null;

          const primaryCodeUrl =
            resolveCodeUrlFromPayload(data) || latestMessageCodeUrl;

          const urlCandidate =
            // Prefer effective snapshot URL (backend resolves restoredMessageId)
            // over the project's canonical `url` (latest snapshot pointer).
            (typeof data?.codeUrl === "string" && data.codeUrl.trim()) ||
            (typeof data?.code_url === "string" && data.code_url.trim()) ||
            primaryCodeUrl ||
            (typeof data?.url === "string" && data.url.trim()) ||
            null;

          const setUrlIfWeb = () => {
            if (urlCandidate && previewRuntimeRef.current !== "mobile") {
              const currentUrl = store.getState().projectOptions.url;
              if (currentUrl !== urlCandidate) {
                debugWc("setUrl from json", { urlCandidate });
                dispatch(setUrl(urlCandidate));
              }
            }
          };

          if (primaryCodeUrl) {
            await hydrateFromCodeUrl({
              codeUrl: primaryCodeUrl,
              hydratedCodeUrls,
            });
            applyRuntimeHintsIfNeeded();
            validateRuntimeFromHydratedFiles(projectId);
            setUrlIfWeb();
          } else if (save === false) {
            applyRuntimeHintsIfNeeded();
            // Initial load but no codeUrl (fresh project)
            if (previewRuntimeRef.current === "mobile") {
              dispatch(
                setPreviewSnackFiles({ ...DEFAULT_PREVIEW_SNACK_FILES }),
              );
              dispatch(
                setPreviewSnackDependencies({
                  ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
                }),
              );
              previewSnackDependenciesRef.current = {
                ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
              };
            }
          }

          // Start SSE connection for app deployment
          const currentChatId = data.chatId || effectiveChatId;
          if (data.codeUrl && currentChatId && projectId && email) {
          }

          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach((msg: any) => {
              if (
                msg.toolResult?.UsedTool === "todo_write" &&
                msg.toolResult?.result?.metadata?.todos
              ) {
                dispatch(
                  updateTodosFromTool({
                    todos: msg.toolResult.result.metadata.todos.map(
                      (todo: any) => ({
                        ...todo,
                        status: todo.status || "pending",
                      }),
                    ),
                    total: msg.toolResult.result.metadata.total,
                    pending: msg.toolResult.result.metadata.pending,
                    completed: msg.toolResult.result.metadata.completed,
                  }),
                );
              }
            });

            // Map API response messages (with 'text') to Redux messages (with 'content')
            // const mappedMessages = data.messages.map((msg: any) => ({
            //   ...msg,
            //   content: msg.text || msg.content || "",
            //   createdAt: msg.createdAt || new Date(),
            //   chatId: data.chatId || chatId, // Ensure chatId is set
            //   // Remove toolResult from message if it's todo_write (we handle it separately)
            //   toolResult:
            //     msg.toolResult?.UsedTool === "todo_write"
            //       ? undefined
            //       : msg.toolResult,
            // }));

            // Set all messages (replace existing) if messages array is provided
            // This happens BEFORE chatId is set to prevent race condition
            // if (mappedMessages.length > 0) {
            //   dispatch(setMessages(mappedMessages));
            // }
          }

          // THEN: Store chatId, chatTitle, projectTitle (title), and model in Redux
          // Setting chatId AFTER messages ensures Messages.tsx won't try to fetch
          // messages that are already in Redux

          dispatch(setStreamActive(false));
          dispatch(setStreamChatId(null)); // Clear stream chat ID
          dispatch(
            setGenerating({
              generating: false,
              isResponseCompleted: true,
              generationSuccess: "success",
            }),
          );
        }
      }
      //stream needed
      else {
        console.warn("Stream start");
        {
          const prevPc = store.getState().projectOptions.promptCount;
          if (typeof prevPc === "number" && prevPc > 0) {
            dispatch(setPromptCount(prevPc - 1));
          }
        }
        sseCarryRef.current = { carry: "" };
        streamStartedAtMsRef.current = Date.now();
        lastStreamAssistantMessageIdRef.current = null;
        dispatch(clearTodos());
        dispatch(setStreamActive(true));
        dispatch(setStreamChatId(effectiveChatId || null)); // Set stream chat ID
        warnWc("stream needed-");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let markerBuffer = "";
        let updatedPackageJsonPath: string | null = null;
        let receivedWrites = false;
        let lastStreamCodeUrl: string | null = null;

        const extractContent = (text: string): string | null => {
          const startMarker = "___start___";
          const endMarker = "___end___";
          const startIndex = text.indexOf(startMarker);
          const endIndex = text.indexOf(endMarker);
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            return text
              .substring(startIndex + startMarker.length, endIndex)
              .trim();
          }
          return null;
        };

        const processExtractedContent = async (jsonStr: string) => {
          try {
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

            if (
              parsed.tokenUsage &&
              typeof (parsed.tokenUsage as { totalTokens?: number }).totalTokens ===
                "number"
            ) {
              const delta = Math.max(
                0,
                (parsed.tokenUsage as { totalTokens: number }).totalTokens,
              );
              if (delta > 0) {
                const state = store.getState();
                const current = state.projectOptions;
                const currentUsed =
                  typeof current.tokensUsed === "number"
                    ? current.tokensUsed
                    : 0;
                const currentLimit =
                  typeof current.tokenLimit === "number"
                    ? current.tokenLimit
                    : 0;
                const currentRemaining =
                  typeof current.tokensRemaining === "number"
                    ? current.tokensRemaining
                    : currentLimit;
                dispatch(
                  setTokenUsage({
                    tokenLimit: currentLimit,
                    tokensUsed: currentUsed + delta,
                    tokensRemaining:
                      currentLimit > 0
                        ? Math.max(0, currentRemaining - delta)
                        : currentRemaining,
                  }),
                );
              }
            }

            const parts = streamPayloadToAssistantParts(parsed);
            if (parts.skipMessage) return;

            const toolResult = parts.toolResult;
            if (
              toolResult?.UsedTool === "todo_write" &&
              toolResult.result?.metadata?.todos
            ) {
              dispatch(
                updateTodosFromTool({
                  todos: toolResult.result.metadata.todos.map((todo: any) => ({
                    ...todo,
                    status: todo.status || "pending",
                  })),
                  total: toolResult.result.metadata.total,
                  pending: toolResult.result.metadata.pending,
                  completed: toolResult.result.metadata.completed,
                }),
              );
            }

            const toolContext = toolResult || parsed;
            const streamCodeUrl =
              resolveCodeUrlFromPayload(parsed) ||
              resolveCodeUrlFromPayload(toolContext);
            if (streamCodeUrl) {
              lastStreamCodeUrl = streamCodeUrl;
              if (previewRuntimeRef.current !== "mobile") {
                const currentUrl = store.getState().projectOptions.url;
                if (currentUrl !== streamCodeUrl) {
                  debugWc("setUrl from stream", { streamCodeUrl });
                  dispatch(setUrl(streamCodeUrl));
                }
              }
            }
            const writes = extractFileWritesFromToolResult(toolContext);

            if (writes.length > 0) {
              const packageJsonPath = await applyIncomingWrites(
                writes,
                toolContext,
              );
              receivedWrites = true;
              if (packageJsonPath) {
                updatedPackageJsonPath = packageJsonPath;
              }
            } else {
              await applyIncomingWrites([], toolContext);
              const fallbackCodeUrl = resolveCodeUrlFromPayload(toolContext);
              const hydration = await hydrateFromCodeUrl({
                codeUrl: fallbackCodeUrl,
                hydratedCodeUrls,
              });
              if (hydration.writesCount > 0) {
                receivedWrites = true;
              }
              if (hydration.packageJsonPath) {
                updatedPackageJsonPath = hydration.packageJsonPath;
              }
            }

            if (parts.userMessage || toolResult) {
              const id = `msg-${Date.now()}-${Math.random()}`;
              lastStreamAssistantMessageIdRef.current = id;
              dispatch(
                addMessage({
                  id,
                  role: "assistant",
                  content: parts.userMessage,
                  createdAt: new Date().toISOString(),
                  toolResult,
                  chatId: effectiveChatId,
                  codeUrl:
                    typeof parsed.codeUrl === "string"
                      ? parsed.codeUrl
                      : typeof parsed.code_url === "string"
                        ? parsed.code_url
                        : undefined,
                }),
              );
            }
          } catch (error) {
            console.error("Error parsing extracted content:", error);
          }
        };

        const drainMarkerBuffer = async (buf: string) => {
          let buffer = buf;
          let extracted = extractContent(buffer);
          while (extracted) {
            await processExtractedContent(extracted);
            const endMarkerIndex = buffer.indexOf("___end___");
            if (endMarkerIndex !== -1) {
              buffer = buffer.substring(endMarkerIndex + "___end___".length);
            } else {
              break;
            }
            extracted = extractContent(buffer);
          }
          return buffer;
        };

        while (true) {
          const { done, value } = await reader.read();

          if (!done) {
            const chunk = decoder.decode(value, { stream: true });
            markerBuffer += appendChunkToSsePayload(chunk, sseCarryRef.current);
            warnWc(markerBuffer);
            markerBuffer = await drainMarkerBuffer(markerBuffer);
          } else {
            markerBuffer += flushSseCarry(sseCarryRef.current);
            markerBuffer = await drainMarkerBuffer(markerBuffer);

            if (previewRuntimeRef.current !== "mobile") {
              if (!receivedWrites) {
                const snapshotHydration = await hydrateFromProjectSnapshot({
                  projectId,
                  email,
                });
                if (snapshotHydration.writesCount > 0) {
                  receivedWrites = true;
                  if (snapshotHydration.packageJsonPath) {
                    updatedPackageJsonPath = snapshotHydration.packageJsonPath;
                  }
                }
              }
              const fallbackUrl =
                lastStreamCodeUrl || store.getState().projectOptions.url;
              if (fallbackUrl && shouldHydrateFromSnapshot()) {
                debugWc("stream end hydrate (partial)", {
                  url: fallbackUrl,
                });
                await hydrateFromCodeUrl({
                  codeUrl: fallbackUrl,
                  hydratedCodeUrls,
                });
              } else if (lastStreamCodeUrl) {
                await hydrateFromCodeUrl({
                  codeUrl: lastStreamCodeUrl,
                  hydratedCodeUrls,
                });
              }
              debugWc("stream end", {
                receivedWrites,
                updatedPackageJsonPath: updatedPackageJsonPath || null,
                previewRuntime: previewRuntimeRef.current,
              });
            }

            if (
              previewRuntimeRef.current === "mobile" &&
              receivedWrites
            ) {
              const projectData = store.getState().projectFiles.data;
              if (projectData && typeof projectData === "object") {
                const snackPatch: Record<string, string> = {};
                Object.entries(
                  projectData as Record<string, string>,
                ).forEach(([path, content]) => {
                  if (typeof content !== "string") return;
                  const snackPath = normalizeWorkspacePathForSnack(path);
                  if (!snackPath) return;
                  snackPatch[snackPath] = sanitizeFileWriteContent(
                    snackPath,
                    content,
                  );
                });
                if (Object.keys(snackPatch).length > 0) {
                  debugWc("stream end mobile reconciliation", {
                    files: Object.keys(snackPatch).length,
                  });
                  dispatch(setPreviewSnackFiles(snackPatch));
                }
              }
            }

            finalizeStreamAgentRun();
            dispatch(setStreamActive(false));
            dispatch(setStreamChatId(null));
            dispatch(
              setGenerating({
                generating: false,
                isResponseCompleted: true,
                generationSuccess: "success",
              }),
            );
            persistProjectRuntime(projectId, previewRuntimeRef.current);
            console.warn("Stream ended 1");
            await maybeRunWebCommandsAfterStream(updatedPackageJsonPath);
            break;
          }
        }
      }
    } catch (error) {
      console.error(" Error in createResponse:", error);
      finalizeStreamAgentRun();
      dispatch(setStreamActive(false));
      dispatch(setStreamChatId(null));

      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to create response. Please try again.",
        }),
      );
    } finally {
      explicitRuntimeRef.current = null;
    }
  };

  const createSecondaryResponse = async ({
    input,
    email,
    projectId,
    attachments,
    chatId,
    model,
    save,
    blockContext,
    previewRuntime,
    blockMode,
  }: {
    input?: string;
    email: string;
    projectId: string;
    fix?: boolean;
    attachments?: {
      file: File;
      preview: string;
      type: "image" | "video" | "pdf" | "code" | "reference";
      isUploading?: boolean;
      fileType: string;
      previewUrl?: string;
      url: string;
      name: string;
      id: string;
    }[];
    chatId?: string;
    model?: string;
    save?: boolean;
    previewRuntime?: "web" | "mobile";
    blockContext?: {
      id: string;
      html: string;
      selector?: string;
      page?: string;
    };
    blockMode?: "strict" | "agent";
  }): Promise<void> => {
    if (!email) return;
    explicitRuntimeRef.current = normalizePreviewRuntimeValue(previewRuntime);
    try {
      let effectiveChatId = chatId || activeChatId || undefined;
      const hydratedCodeUrls = new Set<string>();

      if (effectiveChatId) {
        persistChatId(effectiveChatId, projectId);
      }

      const currentReduxRuntime = store.getState().projectOptions.previewRuntime;
      previewRuntimeRef.current = currentReduxRuntime;

      const requestedPreviewRuntime =
        explicitRuntimeRef.current ||
        readPreviewRuntimeFromSession(projectId) ||
        currentReduxRuntime;

      previewRuntimeRef.current = requestedPreviewRuntime;
      persistProjectRuntime(projectId, requestedPreviewRuntime);

      // Dispatch user message immediately
      if (input || (attachments && attachments.length > 0)) {
        const userMsgId = `msg-${Date.now()}-${Math.random()}`;
        dispatch(
          addMessage({
            id: userMsgId,
            role: "user",
            content: input || "",
            createdAt: new Date().toISOString(),
            chatId: effectiveChatId,
            attachments: attachments?.map((att) => ({
              name: att.name,
              url: att.url,
              type: att.type,
              label: att.name,
              preview: att.preview,
            })),
          }),
        );
      }

      // Separate code attachments from other attachments
      const codeAttachments =
        attachments?.filter((att) => att.type === "code") || [];
      const regularAttachments =
        attachments?.filter((att) => att.type !== "code") || [];

      // Create references array from code attachments
      const references = codeAttachments.map((att) => att.preview);

      if (blockContext && blockMode === "strict") {
        try {
          const res = await fetch(`${API}/block-edit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: input || "",
              model,
              blockContext,
            }),
          });

          if (!res.ok) {
            throw new Error(`Block edit failed: ${res.status}`);
          }
          const data = await res.json();
          if (!data?.success || !data?.html) {
            throw new Error("Block edit returned no HTML");
          }

          dispatch(
            addMessage({
              id: `msg-${Date.now()}-${Math.random()}`,
              role: "assistant",
              content:
                "Updated the selected block. Let me know if you want further tweaks.",
              createdAt: new Date().toISOString(),
              chatId: effectiveChatId,
            }),
          );

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("SB_APPLY_BLOCK_UPDATE", {
                detail: { blockId: blockContext.id, html: data.html },
              }),
            );
          }
          return;
        } catch (blockError) {
          console.error("Block edit error:", blockError);
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text: "Block-only edit failed. Please try again.",
            }),
          );
          return;
        }
      }

      const rawString = JSON.stringify({
        prompt: input || "",
        projectId: projectId || "",
        owner: email || "",
        model,
        attachments: regularAttachments,
        references: JSON.stringify(references), // Send as stringified array
        chatId: effectiveChatId,
        fix: false,
        save,
        previewRuntime: requestedPreviewRuntime,
        platform: requestedPreviewRuntime,
        blockContext,
      });

      const res = await fetch(`${API}/v3/agent-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: rawString,
      });

      if (!res.ok) {
        if (res.status === 403) {
          let body: Record<string, unknown> = {};
          try {
            body = (await res.json()) as Record<string, unknown>;
          } catch {
            /* ignore */
          }
          if (applyPromptQuotaExhausted(body, { chatId: effectiveChatId })) {
            return;
          }
          throw new Error(
            `API Error: 403 ${Object.keys(body).length ? JSON.stringify(body) : "Forbidden"}`,
          );
        }
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
      }
      if (!res.body) throw new Error("Response body is null");

      const responseChatIdHeader = res.headers.get("x-chat-id");
      const responseChatId = responseChatIdHeader?.trim() || null;
      if (responseChatId) {
        effectiveChatId = responseChatId;
        persistChatId(responseChatId, projectId);
      }

      {
        const prevPc = store.getState().projectOptions.promptCount;
        if (typeof prevPc === "number" && prevPc > 0) {
          dispatch(setPromptCount(prevPc - 1));
        }
      }

      sseCarryRef.current = { carry: "" };
      streamStartedAtMsRef.current = Date.now();
      lastStreamAssistantMessageIdRef.current = null;
      dispatch(clearTodos());
      dispatch(setStreamActive(true));
      dispatch(setStreamChatId(effectiveChatId || null)); // Set stream chat ID
      warnWc("stream needed-");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let markerBuffer = "";
      let updatedPackageJsonPath: string | null = null;
      let receivedWrites = false;
      let lastStreamCodeUrl: string | null = null;

      const extractContent = (text: string): string | null => {
        const startMarker = "___start___";
        const endMarker = "___end___";
        const startIndex = text.indexOf(startMarker);
        const endIndex = text.indexOf(endMarker);
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          return text
            .substring(startIndex + startMarker.length, endIndex)
            .trim();
        }
        return null;
      };

      const processExtractedContent = async (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

          if (
            parsed.tokenUsage &&
            typeof (parsed.tokenUsage as { totalTokens?: number }).totalTokens ===
              "number"
          ) {
            const delta = Math.max(
              0,
              (parsed.tokenUsage as { totalTokens: number }).totalTokens,
            );
            if (delta > 0) {
              const state = store.getState();
              const current = state.projectOptions;
              const currentUsed =
                typeof current.tokensUsed === "number"
                  ? current.tokensUsed
                  : 0;
              const currentLimit =
                typeof current.tokenLimit === "number"
                  ? current.tokenLimit
                  : 0;
              const currentRemaining =
                typeof current.tokensRemaining === "number"
                  ? current.tokensRemaining
                  : currentLimit;
              dispatch(
                setTokenUsage({
                  tokenLimit: currentLimit,
                  tokensUsed: currentUsed + delta,
                  tokensRemaining:
                    currentLimit > 0
                      ? Math.max(0, currentRemaining - delta)
                      : currentRemaining,
                }),
              );
            }
          }

          const parts = streamPayloadToAssistantParts(parsed);
          if (parts.skipMessage) return;

          const toolResult = parts.toolResult;
          if (
            toolResult?.UsedTool === "todo_write" &&
            toolResult.result?.metadata?.todos
          ) {
            dispatch(
              updateTodosFromTool({
                todos: toolResult.result.metadata.todos.map((todo: any) => ({
                  ...todo,
                  status: todo.status || "pending",
                })),
                total: toolResult.result.metadata.total,
                pending: toolResult.result.metadata.pending,
                completed: toolResult.result.metadata.completed,
              }),
            );
          }

          const toolContext = toolResult || parsed;
          const streamCodeUrl =
            resolveCodeUrlFromPayload(parsed) ||
            resolveCodeUrlFromPayload(toolContext);
          if (streamCodeUrl) {
            lastStreamCodeUrl = streamCodeUrl;
            if (previewRuntimeRef.current !== "mobile") {
              const currentUrl = store.getState().projectOptions.url;
              if (currentUrl !== streamCodeUrl) {
                debugWc("setUrl from stream (secondary)", { streamCodeUrl });
                dispatch(setUrl(streamCodeUrl));
              }
            }
          }
          const writes = extractFileWritesFromToolResult(toolContext);

          if (writes.length > 0) {
            const packageJsonPath = await applyIncomingWrites(
              writes,
              toolContext,
            );
            receivedWrites = true;
            if (packageJsonPath) {
              updatedPackageJsonPath = packageJsonPath;
            }
          } else {
            await applyIncomingWrites([], toolContext);
            const fallbackCodeUrl = resolveCodeUrlFromPayload(toolContext);
            const hydration = await hydrateFromCodeUrl({
              codeUrl: fallbackCodeUrl,
              hydratedCodeUrls,
            });
            if (hydration.writesCount > 0) {
              receivedWrites = true;
            }
            if (hydration.packageJsonPath) {
              updatedPackageJsonPath = hydration.packageJsonPath;
            }
          }

          if (parts.userMessage || toolResult) {
            const id = `msg-${Date.now()}-${Math.random()}`;
            lastStreamAssistantMessageIdRef.current = id;
            dispatch(
              addMessage({
                id,
                role: "assistant",
                content: parts.userMessage,
                createdAt: new Date().toISOString(),
                toolResult,
                chatId: effectiveChatId,
                codeUrl:
                  typeof parsed.codeUrl === "string"
                    ? parsed.codeUrl
                    : typeof parsed.code_url === "string"
                      ? parsed.code_url
                      : undefined,
              }),
            );
          }
        } catch (error) {
          console.error("Error parsing extracted content:", error);
        }
      };

      const drainMarkerBuffer = async (buf: string) => {
        let buffer = buf;
        let extracted = extractContent(buffer);
        while (extracted) {
          await processExtractedContent(extracted);
          const endMarkerIndex = buffer.indexOf("___end___");
          if (endMarkerIndex !== -1) {
            buffer = buffer.substring(endMarkerIndex + "___end___".length);
          } else {
            break;
          }
          extracted = extractContent(buffer);
        }
        return buffer;
      };

      while (true) {
        const { done, value } = await reader.read();

        if (!done) {
          const chunk = decoder.decode(value, { stream: true });
          markerBuffer += appendChunkToSsePayload(chunk, sseCarryRef.current);
          warnWc(markerBuffer);
          markerBuffer = await drainMarkerBuffer(markerBuffer);
        } else {
          markerBuffer += flushSseCarry(sseCarryRef.current);
          markerBuffer = await drainMarkerBuffer(markerBuffer);

          if (previewRuntimeRef.current !== "mobile") {
            if (!receivedWrites) {
              const snapshotHydration = await hydrateFromProjectSnapshot({
                projectId,
                email,
              });
              if (snapshotHydration.writesCount > 0) {
                receivedWrites = true;
                if (snapshotHydration.packageJsonPath) {
                  updatedPackageJsonPath = snapshotHydration.packageJsonPath;
                }
              }
            }
            const fallbackUrl =
              lastStreamCodeUrl || store.getState().projectOptions.url;
            if (fallbackUrl && shouldHydrateFromSnapshot()) {
              debugWc("stream end hydrate (partial, secondary)", {
                url: fallbackUrl,
              });
              await hydrateFromCodeUrl({
                codeUrl: fallbackUrl,
                hydratedCodeUrls,
              });
            } else if (lastStreamCodeUrl) {
              await hydrateFromCodeUrl({
                codeUrl: lastStreamCodeUrl,
                hydratedCodeUrls,
              });
            }
            debugWc("stream end (secondary)", {
              receivedWrites,
              updatedPackageJsonPath: updatedPackageJsonPath || null,
              previewRuntime: previewRuntimeRef.current,
            });
          }

          if (
            previewRuntimeRef.current === "mobile" &&
            receivedWrites
          ) {
            const projectData = store.getState().projectFiles.data;
            if (projectData && typeof projectData === "object") {
              const snackPatch: Record<string, string> = {};
              Object.entries(
                projectData as Record<string, string>,
              ).forEach(([path, content]) => {
                if (typeof content !== "string") return;
                const snackPath = normalizeWorkspacePathForSnack(path);
                if (!snackPath) return;
                snackPatch[snackPath] = sanitizeFileWriteContent(
                  snackPath,
                  content,
                );
              });
              if (Object.keys(snackPatch).length > 0) {
                debugWc("stream end mobile reconciliation (secondary)", {
                  files: Object.keys(snackPatch).length,
                });
                dispatch(setPreviewSnackFiles(snackPatch));
              }
            }
          }

          finalizeStreamAgentRun();
          dispatch(setStreamActive(false));
          dispatch(setStreamChatId(null));
          dispatch(
            setGenerating({
              generating: false,
              isResponseCompleted: true,
              generationSuccess: "success",
            }),
          );
          persistProjectRuntime(projectId, previewRuntimeRef.current);
          await maybeRunWebCommandsAfterStream(updatedPackageJsonPath);
          break;
        }
      }
    } catch (error) {
      console.error(" Error in createSecondaryResponse:", error);
      finalizeStreamAgentRun();
      dispatch(setStreamActive(false));
      dispatch(setStreamChatId(null));

      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to create response. Please try again.",
        }),
      );
    } finally {
      explicitRuntimeRef.current = null;
    }
  };

  return {
    createResponse,
    createSecondaryResponse,
  };
};
