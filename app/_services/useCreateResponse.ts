"use client";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState, store } from "../redux/store";
import { API } from "../config/publicEnv";
import { setNotification } from "../redux/reducers/NotificationModalReducer";
import {
  setStreamActive,
  setModel,
  setPreviewRuntime,
  setTitle,
  setTokenUsage,
  setPreviewSnackFiles,
  setPreviewSnackDependencies,
  updatePreviewSnackFiles,
  updatePreviewSnackDependencies,
} from "../redux/reducers/projectOptions";
import {
  addMessage,
  setChatId as setChatIdInChatSlice,
  setStreamChatId,
} from "../redux/reducers/chatSlice";
import { updateTodosFromTool } from "../redux/reducers/todosSlice";
import { updateSpecificFile } from "../redux/reducers/projectFiles";
import type { AttachmentType } from "../../app/_components/AttachmentPreview";
import { useContext, useEffect, useRef } from "react";
import { WebContainerContext } from "../redux/useWebContainerContext";
import {
  extractFileWritesFromToolResult,
  extractFileWritesFromSnapshot,
  inferPreviewRuntimeFromWrites,
  normalizeIncomingFileContent,
  normalizeWorkspacePathForSnack,
  resolveDependencyUpdatesForWrites,
  sanitizeFileWriteContent,
} from "./fileUpdatesMobile";
import {
  DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
  DEFAULT_PREVIEW_SNACK_FILES,
  inferPreviewRuntime,
} from "@/default/mobile";

export const useCreateResponse = () => {
  const dispatch = useDispatch<AppDispatch>();
  const context = useContext(WebContainerContext);
  const webcontainerInstance = context?.webcontainerInstance;
  const previewSnackDependencies = useSelector(
    (state: RootState) => state.projectOptions.previewSnackDependencies,
  );
  const previewRuntime = useSelector(
    (state: RootState) => state.projectOptions.previewRuntime,
  );
  const activeChatId = useSelector(
    (state: RootState) => state.messagesprovider.chatId,
  );
  const previewSnackDependenciesRef = useRef(previewSnackDependencies);
  const previewRuntimeRef = useRef(previewRuntime);

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
    if (typeof runtimeHint !== "string" || !runtimeHint.trim()) {
      return previewRuntimeRef.current;
    }

    const nextRuntime = inferPreviewRuntime(runtimeHint);
    if (previewRuntimeRef.current !== nextRuntime) {
      previewRuntimeRef.current = nextRuntime;
      dispatch(setPreviewRuntime(nextRuntime));
    }
    return nextRuntime;
  };

  const normalizeRuntimeValue = (
    value?: string | null,
  ): "web" | "mobile" | null => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === "web" || normalized === "mobile") return normalized;
    return null;
  };

  const resolveRuntimeHint = ({
    previewRuntime,
    runtime,
    platform,
    projectRuntime,
    framework,
  }: {
    previewRuntime?: string | null;
    runtime?: string | null;
    platform?: string | null;
    projectRuntime?: string | null;
    framework?: string | null;
  }): "web" | "mobile" | null => {
    const explicit =
      normalizeRuntimeValue(previewRuntime) ||
      normalizeRuntimeValue(runtime) ||
      normalizeRuntimeValue(platform) ||
      normalizeRuntimeValue(projectRuntime);
    if (explicit) return explicit;

    if (typeof framework === "string" && framework.trim()) {
      return inferPreviewRuntime(framework);
    }

    return null;
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

  const persistProjectRuntime = (
    projectId?: string,
    runtime?: string | null,
  ) => {
    if (typeof window === "undefined") return;
    if (!projectId) return;
    if (runtime !== "mobile" && runtime !== "web") return;
    sessionStorage.setItem(`superblocksProjectRuntime_${projectId}`, runtime);
  };

  const resolveCodeUrlFromPayload = (payload: unknown): string | null => {
    if (!payload || typeof payload !== "object") return null;

    const record = payload as Record<string, unknown>;
    const directCodeUrl =
      typeof record.codeUrl === "string"
        ? record.codeUrl
        : typeof record.code_url === "string"
          ? record.code_url
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
          : null;

    return nestedCodeUrl?.trim() || null;
  };

  const shouldTreatWriteAsMobileRuntime = (
    filePath: string,
    fileContent: string,
    dependencyUpdates: Record<string, string | null>,
  ) => {
    if (previewRuntimeRef.current === "mobile") return true;

    if ("expo" in dependencyUpdates || "react-native" in dependencyUpdates) {
      return true;
    }

    const lowerPath = filePath.toLowerCase();
    const lowerContent = fileContent.toLowerCase();

    if (
      lowerPath.endsWith("app.js") ||
      lowerPath.endsWith("app.tsx") ||
      lowerPath.endsWith("app.ts")
    ) {
      if (
        lowerContent.includes("from \"react-native\"") ||
        lowerContent.includes("from 'react-native'") ||
        lowerContent.includes("from \"expo\"") ||
        lowerContent.includes("from 'expo'")
      ) {
        return true;
      }
    }

    if (
      lowerPath.endsWith("package.json") &&
      (lowerContent.includes("\"expo\"") ||
        lowerContent.includes("\"react-native\""))
    ) {
      return true;
    }

    return false;
  };

  /**
   * Normalize the server response so every value is a string of file contents.
   * API sometimes sends `{ code: "..." }` instead of raw string.
   */
  const normalizeFileMap = (
    fileMap: Record<string, any>,
  ): Record<string, string> => {
    const normalized: Record<string, string> = {};

    for (const [path, value] of Object.entries(fileMap)) {
      if (typeof value === "string") {
        normalized[path] = normalizeIncomingFileContent(value);
      } else if (value && typeof value === "object" && "code" in value) {
        normalized[path] = normalizeIncomingFileContent(value.code as string);
      } else if (
        value &&
        typeof value === "object" &&
        "content" in value &&
        typeof (value as { content?: unknown }).content === "string"
      ) {
        normalized[path] = normalizeIncomingFileContent(
          (value as { content: string }).content,
        );
      } else if (
        value &&
        typeof value === "object" &&
        "contents" in value &&
        typeof (value as { contents?: unknown }).contents === "string"
      ) {
        normalized[path] = normalizeIncomingFileContent(
          (value as { contents: string }).contents,
        );
      } else {
        normalized[path] = JSON.stringify(value, null, 2);
      }
    }

    return normalized;
  };

  /**
   * Ensure each path exists in the WebContainer and write the file.
   */
  const writeFilesToWebContainer = async (fileMap: Record<string, any>) => {
    if (!webcontainerInstance) return;

    const normalized = normalizeFileMap(fileMap);

    for (const [rawPath, contentStr] of Object.entries(normalized)) {
      if (typeof contentStr !== "string") continue; // safeguard

      // Ensure it starts with /workspace/
      let path = rawPath;
      if (path.startsWith("/")) {
        path = path.substring(1);
      }

      if (!path.startsWith("workspace/")) {
        path = "workspace/" + path;
      }

      path = "/" + path;

      const dir = path.substring(0, path.lastIndexOf("/"));
      if (dir) {
        try {
          await webcontainerInstance.fs.mkdir(dir, { recursive: true });
        } catch {
          /* already exists */
        }
      }

      try {
        await webcontainerInstance.fs.writeFile(path, contentStr, "utf-8");
      } catch (e) {
        console.error("Failed writing", path, e);
      }
    }
  };

  const handleFileUpdate = async (
    filePath: string,
    content: any,
    skipInstall: boolean = false,
  ) => {
    let fileContent = content;
    if (typeof content === "object" && content !== null) {
      if ("code" in content && typeof content.code === "string") {
        fileContent = content.code;
      } else if ("content" in content && typeof content.content === "string") {
        fileContent = content.content;
      } else if (
        "contents" in content &&
        typeof content.contents === "string"
      ) {
        fileContent = content.contents;
      } else {
        fileContent = JSON.stringify(content, null, 2);
      }
    }

    if (typeof fileContent === "string") {
      fileContent = normalizeIncomingFileContent(fileContent);

      // Normalize path (ensure it starts with / if needed, but keep workspace)
      let normalizedPath = filePath.replace(/^\/+/, ""); // Remove leading slashes

      // Force workspace directory if not already present
      if (!normalizedPath.startsWith("workspace/")) {
        normalizedPath = "workspace/" + normalizedPath;
      }

      // Only update if we have a valid path
      if (filePath) {
        const previewPath = normalizeWorkspacePathForSnack(normalizedPath);
        const sanitizedPreviewContent = sanitizeFileWriteContent(
          previewPath,
          fileContent,
        );
        const fileWrites = [
          {
            path: previewPath,
            content: sanitizedPreviewContent,
          },
        ];
        const dependencyUpdates = resolveDependencyUpdatesForWrites({
          fileWrites,
          currentDependencies: previewSnackDependenciesRef.current,
          allowRemovals: false,
        });
        const shouldUseMobileRuntime = shouldTreatWriteAsMobileRuntime(
          previewPath,
          sanitizedPreviewContent,
          dependencyUpdates,
        );

        if (shouldUseMobileRuntime && previewRuntimeRef.current !== "mobile") {
          previewRuntimeRef.current = "mobile";
          dispatch(setPreviewRuntime("mobile"));
        }

        const contentForStorage =
          shouldUseMobileRuntime || previewRuntimeRef.current === "mobile"
            ? sanitizedPreviewContent
            : (fileContent as string);

        dispatch(
          updateSpecificFile({
            filePath: normalizedPath, // Use normalizedPath to ensure workspace prefix in Redux
            content: contentForStorage,
            createDirectories: true,
          }),
        );

        if (previewRuntimeRef.current === "mobile") {
          dispatch(
            updatePreviewSnackFiles({
              [previewPath]: sanitizedPreviewContent,
            }),
          );
          applyPreviewDependencyUpdates(dependencyUpdates);
        } else {
          // Write to WebContainer
          writeFilesToWebContainer({
            [normalizedPath]: contentForStorage,
          });

          // Check if the file is package.json and trigger npm install
          if (normalizedPath.endsWith("package.json") && !skipInstall) {
            console.log("package.json modified, triggering npm install...");
            if (typeof window !== "undefined") {
              const win = window as any;
              if (win.executeTerminalCommand && win.waitForTerminalReady) {
                // Wait for terminal to be ready before executing
                win
                  .waitForTerminalReady("terminal-1", 5000)
                  .then((isReady: boolean) => {
                    if (isReady) {
                      // Extract directory to run npm install in
                      const dir = normalizedPath.substring(
                        0,
                        normalizedPath.lastIndexOf("/"),
                      );
                      const cmd = dir
                        ? `cd ${dir} && npm install`
                        : "npm install";
                      win.executeTerminalCommand(cmd);
                    } else {
                      console.warn(
                        "Terminal not ready for npm install after wait",
                      );
                    }
                  });
              }
            }
          }
        }
      }
    }
  };

  const applyIncomingWrites = async (
    writes: Array<{ path: string; content: string }>,
    toolContext?: unknown,
  ): Promise<string | null> => {
    if (!writes.length) {
      if (toolContext) {
        const backendDependencyUpdates = resolveDependencyUpdatesForWrites({
          toolResult: toolContext,
          currentDependencies: previewSnackDependenciesRef.current,
          allowRemovals: false,
        });

        if (process.env.NODE_ENV !== "production") {
          console.log(
            "[mobile-deps] backend-only updates",
            backendDependencyUpdates,
          );
        }

        if (Object.keys(backendDependencyUpdates).length > 0) {
          const shouldSwitchToMobile =
            previewRuntimeRef.current !== "mobile" &&
            ("expo" in backendDependencyUpdates ||
              "react-native" in backendDependencyUpdates);
          if (shouldSwitchToMobile) {
            previewRuntimeRef.current = "mobile";
            dispatch(setPreviewRuntime("mobile"));
          }

          if (previewRuntimeRef.current === "mobile") {
            applyPreviewDependencyUpdates(backendDependencyUpdates);
          }
        }
      }
      return null;
    }

    const inferredRuntime = inferPreviewRuntimeFromWrites(writes);
    if (
      inferredRuntime &&
      inferredRuntime !== previewRuntimeRef.current &&
      !(previewRuntimeRef.current === "mobile" && inferredRuntime === "web")
    ) {
      previewRuntimeRef.current = inferredRuntime;
      dispatch(setPreviewRuntime(inferredRuntime));
    }

    let updatedPackageJsonPath: string | null = null;
    for (const write of writes) {
      const isPackageJson = write.path.toLowerCase().endsWith("package.json");
      if (isPackageJson) {
        updatedPackageJsonPath = write.path;
      }
      await handleFileUpdate(write.path, write.content, isPackageJson);
    }

    if (toolContext && previewRuntimeRef.current === "mobile") {
      const backendDependencyUpdates = resolveDependencyUpdatesForWrites({
        toolResult: toolContext,
        fileWrites: writes,
        currentDependencies: previewSnackDependenciesRef.current,
        allowRemovals: false,
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[mobile-deps] backend+writes updates", backendDependencyUpdates);
      }

      applyPreviewDependencyUpdates(backendDependencyUpdates);
    }

    return updatedPackageJsonPath;
  };

  const hydrateFromCodeUrl = async ({
    codeUrl,
    hydratedCodeUrls,
  }: {
    codeUrl?: string | null;
    hydratedCodeUrls: Set<string>;
  }): Promise<string | null> => {
    const normalizedCodeUrl = codeUrl?.trim();
    if (!normalizedCodeUrl) return null;
    if (hydratedCodeUrls.has(normalizedCodeUrl)) return null;

    hydratedCodeUrls.add(normalizedCodeUrl);

    try {
      const codeResponse = await fetch(normalizedCodeUrl, {
        cache: "no-store",
      });
      if (!codeResponse.ok) {
        console.error("Failed to fetch code snapshot:", normalizedCodeUrl);
        return null;
      }

      const snapshot = await codeResponse.json();
      const writes = extractFileWritesFromSnapshot(snapshot);
      if (!writes.length) return null;

      return await applyIncomingWrites(writes);
    } catch (error) {
      console.error("Error fetching or applying code snapshot:", error);
      return null;
    }
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
    try {
      if (!email) return;
      let effectiveChatId = chatId || activeChatId || undefined;
      const hydratedCodeUrls = new Set<string>();
      const requestedPreviewRuntime =
        previewRuntime === "mobile" || previewRuntime === "web"
          ? previewRuntime
          : previewRuntimeRef.current;

      if (
        requestedPreviewRuntime &&
        requestedPreviewRuntime !== previewRuntimeRef.current
      ) {
        previewRuntimeRef.current = requestedPreviewRuntime;
        dispatch(setPreviewRuntime(requestedPreviewRuntime));
      }
      persistProjectRuntime(projectId, requestedPreviewRuntime);

      const rawString = JSON.stringify({
        prompt: input || "",
        projectId: projectId || "",
        owner: email || "",
        model,
        attachments,
        chatId: effectiveChatId,
        fix: false,
        save,
        previewRuntime: requestedPreviewRuntime,
        platform: requestedPreviewRuntime,
        blockContext,
      });

      const res = await fetch(`${API}/v3/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: rawString,
      });

      if (!res.ok)
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
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
          const resolvedRuntimeHint = resolveRuntimeHint({
            previewRuntime:
              typeof data.previewRuntime === "string"
                ? data.previewRuntime
                : null,
            runtime: typeof data.runtime === "string" ? data.runtime : null,
            platform: typeof data.platform === "string" ? data.platform : null,
            projectRuntime:
              typeof data.projectRuntime === "string"
                ? data.projectRuntime
                : null,
            framework:
              typeof data.framework === "string" ? data.framework : null,
          });

          const applyRuntimeHintsIfNeeded = () => {
            if (previewRuntime) return;
            if (!resolvedRuntimeHint) return;
            // Do not auto-downgrade an already-mobile project to web from generic hints.
            if (
              previewRuntimeRef.current === "mobile" &&
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

          persistProjectRuntime(projectId, previewRuntimeRef.current);

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
                  if (typeof message?.codeUrl === "string") return message.codeUrl;
                  if (typeof message?.code_url === "string") return message.code_url;
                  return null;
                })
                .find(
                  (value: string | null): value is string => typeof value === "string",
                )
            : null;

          const primaryCodeUrl =
            resolveCodeUrlFromPayload(data) || latestMessageCodeUrl;

          if (primaryCodeUrl) {
            const runtimeBeforeHydration = previewRuntimeRef.current;
            await hydrateFromCodeUrl({
              codeUrl: primaryCodeUrl,
              hydratedCodeUrls,
            });
            const runtimeChangedFromHydration =
              previewRuntimeRef.current !== runtimeBeforeHydration;
            if (!runtimeChangedFromHydration) {
              applyRuntimeHintsIfNeeded();
            }

            if (
              previewRuntimeRef.current !== "mobile" &&
              typeof window !== "undefined"
            ) {
              const win = window as any;
              if (win.executeTerminalCommand && win.waitForTerminalReady) {
                win
                  .waitForTerminalReady("terminal-1", 5000)
                  .then((isReady: boolean) => {
                    if (isReady) {
                      console.log(
                        "Triggering initial npm install in workspace...",
                      );
                      win.executeTerminalCommand(
                        "cd workspace && npm install && npm run dev",
                      );
                    }
                  });
              }
            }
          } else if (save === false) {
            applyRuntimeHintsIfNeeded();
            // Initial load but no codeUrl (fresh project)
            if (previewRuntimeRef.current === "mobile") {
              dispatch(setPreviewSnackFiles({ ...DEFAULT_PREVIEW_SNACK_FILES }));
              dispatch(
                setPreviewSnackDependencies({
                  ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
                }),
              );
              previewSnackDependenciesRef.current = {
                ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
              };
            } else if (typeof window !== "undefined") {
              // Trigger npm install for the base test-files
              const win = window as any;
              if (win.executeTerminalCommand && win.waitForTerminalReady) {
                win
                  .waitForTerminalReady("terminal-1", 5000)
                  .then((isReady: boolean) => {
                    if (isReady) {
                      console.log(
                        "Triggering fresh project npm install in workspace...",
                      );
                      win.executeTerminalCommand(
                        "cd workspace && npm install && npm run dev",
                      );
                    }
                  });
              }
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
        }
      }
      //stream needed
      else {
        dispatch(setStreamActive(true));
        dispatch(setStreamChatId(effectiveChatId || null)); // Set stream chat ID
        console.warn("stream needed-");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = ""; // Buffer to accumulate stream chunks
        const processedMessages = new Set<string>(); // Track processed messages to prevent duplicates
        let updatedPackageJsonPath: string | null = null;

        // Function to extract content between ___start___ and ___end___ markers
        const extractContent = (text: string): string | null => {
          const startMarker = "___start___";
          const endMarker = "___end___";

          const startIndex = text.indexOf(startMarker);
          const endIndex = text.indexOf(endMarker);

          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const content = text.substring(
              startIndex + startMarker.length,
              endIndex,
            );
            return content.trim();
          }

          return null;
        };

        // Function to process extracted content and add to messages
        const processExtractedContent = async (content: string) => {
          // Check if we've already processed this exact content
          if (processedMessages.has(content)) {
            return; // Skip duplicate
          }

          try {
            const parsed = JSON.parse(content);
            const userMessage = parsed.u_msg || parsed.content || "";

            if (
              parsed.tokenUsage &&
              typeof parsed.tokenUsage.totalTokens === "number"
            ) {
              const delta = Math.max(0, parsed.tokenUsage.totalTokens);
              if (delta > 0) {
                const state = store.getState();
                const current = state.projectOptions;
                const currentUsed =
                  typeof current.tokensUsed === "number" ? current.tokensUsed : 0;
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
                  })
                );
              }
            }

            // Extract tool result if present
            const toolResult = parsed.UsedTool
              ? {
                  UsedTool: parsed.UsedTool,
                  result: parsed.result,
                  fileWrite: parsed.fileWrite, // Include fileWrite for todo_write
                }
              : undefined;

            // Update todos if todo_write tool was used
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

            // Handle todo_write tool - store file in projectFiles
            // if (
            //   toolResult?.UsedTool === "todo_write" &&
            //   (toolResult as any).fileWrite
            // ) {
            //   const fileWrite = (toolResult as any).fileWrite;
            //   if (fileWrite.path && fileWrite.content) {
            //     dispatch(
            //       updateSpecificFile({
            //         filePath: fileWrite.path,
            //         content: fileWrite.content,
            //         createDirectories: true,
            //       })
            //     );
            //     // Write to WebContainer
            //     writeFilesToWebContainer({
            //       [fileWrite.path]: fileWrite.content,
            //     });
            //   }
            // }

            const toolContext = toolResult || parsed;
            const writes = extractFileWritesFromToolResult(toolContext);

            if (writes.length > 0) {
              const packageJsonPath = await applyIncomingWrites(
                writes,
                toolContext,
              );
              if (packageJsonPath) {
                updatedPackageJsonPath = packageJsonPath;
              }
            } else {
              await applyIncomingWrites([], toolContext);
              const fallbackCodeUrl = resolveCodeUrlFromPayload(toolContext);
              const packageJsonPath = await hydrateFromCodeUrl({
                codeUrl: fallbackCodeUrl,
                hydratedCodeUrls,
              });
              if (packageJsonPath) {
                updatedPackageJsonPath = packageJsonPath;
              }
            }

            if (userMessage || toolResult) {
              // Mark this content as processed
              processedMessages.add(content);

              dispatch(
                addMessage({
                  id: `msg-${Date.now()}-${Math.random()}`,
                  role: "assistant",
                  content: userMessage,
                  createdAt: new Date().toISOString(),
                  toolResult: toolResult,
                  chatId: effectiveChatId, // Pass chatId
                  codeUrl: parsed.codeUrl || parsed.code_url,
                }),
              );
            }
          } catch (error) {
            console.error("Error parsing extracted content:", error);
          }
        };

        while (true) {
          const { done, value } = await reader.read();

          if (!done) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            console.warn(buffer);

            // Process buffer: extract and process complete messages
            // Only process when we have new data
            let extracted = extractContent(buffer);

            while (extracted) {
              await processExtractedContent(extracted);

              // Remove processed content from buffer
              const endMarkerIndex = buffer.indexOf("___end___");
              if (endMarkerIndex !== -1) {
                buffer = buffer.substring(endMarkerIndex + "___end___".length);
              } else {
                break;
              }

              // Check for more markers in remaining buffer
              extracted = extractContent(buffer);
            }
          } else {
            // Stream ended - process any remaining complete messages in buffer
            // This handles the case where the last chunk completed a message
            let extracted = extractContent(buffer);

            while (extracted) {
              await processExtractedContent(extracted);

              // Remove processed content from buffer
              const endMarkerIndex = buffer.indexOf("___end___");
              if (endMarkerIndex !== -1) {
                buffer = buffer.substring(endMarkerIndex + "___end___".length);
              } else {
                break;
              }

              // Check for more markers in remaining buffer
              extracted = extractContent(buffer);
            }

            if (
              updatedPackageJsonPath &&
              previewRuntimeRef.current !== "mobile"
            ) {
              if (typeof window !== "undefined") {
                const win = window as any;
                if (win.executeTerminalCommand && win.waitForTerminalReady) {
                  win
                    .waitForTerminalReady("terminal-1", 5000)
                    .then((isReady: boolean) => {
                      if (isReady) {
                        console.log(
                          "package.json updated during stream, triggering npm install && npm run dev...",
                        );

                        // Normalize path to find directory
                        let normalizedPath = updatedPackageJsonPath!.replace(
                          /^\/+/,
                          "",
                        );
                        if (!normalizedPath.startsWith("workspace/")) {
                          normalizedPath = "workspace/" + normalizedPath;
                        }

                        const dir = normalizedPath.substring(
                          0,
                          normalizedPath.lastIndexOf("/"),
                        );
                        const cmd = dir
                          ? `cd ${dir} && npm install && npm run dev`
                          : "npm install && npm run dev";

                        win.executeTerminalCommand(cmd);
                      }
                    });
                }
              }
            }

            dispatch(setStreamActive(false));
            persistProjectRuntime(projectId, previewRuntimeRef.current);
            break;
          }
        }
      }
    } catch (error) {
      console.error(" Error in createResponse:", error);
      dispatch(setStreamActive(false));

      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to create response. Please try again.",
        }),
      );
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
    try {
      if (!email) return;
      let effectiveChatId = chatId || activeChatId || undefined;
      const hydratedCodeUrls = new Set<string>();
      const requestedPreviewRuntime =
        previewRuntime === "mobile" || previewRuntime === "web"
          ? previewRuntime
          : previewRuntimeRef.current;

      if (
        requestedPreviewRuntime &&
        requestedPreviewRuntime !== previewRuntimeRef.current
      ) {
        previewRuntimeRef.current = requestedPreviewRuntime;
        dispatch(setPreviewRuntime(requestedPreviewRuntime));
      }
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
            })
          );

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("SB_APPLY_BLOCK_UPDATE", {
                detail: { blockId: blockContext.id, html: data.html },
              })
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
            })
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

      if (!res.ok)
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
      if (!res.body) throw new Error("Response body is null");

      const responseChatIdHeader = res.headers.get("x-chat-id");
      const responseChatId = responseChatIdHeader?.trim() || null;
      if (responseChatId) {
        effectiveChatId = responseChatId;
        persistChatId(responseChatId, projectId);
      }

      dispatch(setStreamActive(true));
      dispatch(setStreamChatId(effectiveChatId || null)); // Set stream chat ID
      console.warn("stream needed-");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; // Buffer to accumulate stream chunks
      const processedMessages = new Set<string>(); // Track processed messages to prevent duplicates
      let updatedPackageJsonPath: string | null = null;

      // Function to extract content between ___start___ and ___end___ markers
      const extractContent = (text: string): string | null => {
        const startMarker = "___start___";
        const endMarker = "___end___";

        const startIndex = text.indexOf(startMarker);
        const endIndex = text.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          const content = text.substring(
            startIndex + startMarker.length,
            endIndex,
          );
          return content.trim();
        }

        return null;
      };

      // Function to process extracted content and add to messages
      const processExtractedContent = async (content: string) => {
        // Check if we've already processed this exact content
        if (processedMessages.has(content)) {
          return; // Skip duplicate
        }

        try {
          const parsed = JSON.parse(content);
          const userMessage = parsed.u_msg || parsed.content || "";

          // Extract tool result if present
          const toolResult = parsed.UsedTool
            ? {
                UsedTool: parsed.UsedTool,
                result: parsed.result,
                fileWrite: parsed.fileWrite, // Include fileWrite for todo_write
              }
            : undefined;

          // Update todos if todo_write tool was used
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
          const writes = extractFileWritesFromToolResult(toolContext);

          if (writes.length > 0) {
            const packageJsonPath = await applyIncomingWrites(
              writes,
              toolContext,
            );
            if (packageJsonPath) {
              updatedPackageJsonPath = packageJsonPath;
            }
          } else {
            await applyIncomingWrites([], toolContext);
            const fallbackCodeUrl = resolveCodeUrlFromPayload(toolContext);
            const packageJsonPath = await hydrateFromCodeUrl({
              codeUrl: fallbackCodeUrl,
              hydratedCodeUrls,
            });
            if (packageJsonPath) {
              updatedPackageJsonPath = packageJsonPath;
            }
          }

          if (userMessage || toolResult) {
            // Mark this content as processed
            processedMessages.add(content);

            dispatch(
              addMessage({
                id: `msg-${Date.now()}-${Math.random()}`,
                role: "assistant",
                content: userMessage,
                createdAt: new Date().toISOString(),
                toolResult: toolResult,
                chatId: effectiveChatId, // Pass chatId
                codeUrl: parsed.codeUrl || parsed.code_url,
              }),
            );
          }
        } catch (error) {
          console.error("Error parsing extracted content:", error);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (!done) {
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          console.warn(buffer);

          // Process buffer: extract and process complete messages
          // Only process when we have new data
          let extracted = extractContent(buffer);

          while (extracted) {
            await processExtractedContent(extracted);

            // Remove processed content from buffer
            const endMarkerIndex = buffer.indexOf("___end___");
            if (endMarkerIndex !== -1) {
              buffer = buffer.substring(endMarkerIndex + "___end___".length);
            } else {
              break;
            }

            // Check for more markers in remaining buffer
            extracted = extractContent(buffer);
          }
        } else {
          // Stream ended - process any remaining complete messages in buffer
          // This handles the case where the last chunk completed a message
          let extracted = extractContent(buffer);

          while (extracted) {
            await processExtractedContent(extracted);

            // Remove processed content from buffer
            const endMarkerIndex = buffer.indexOf("___end___");
            if (endMarkerIndex !== -1) {
              buffer = buffer.substring(endMarkerIndex + "___end___".length);
            } else {
              break;
            }

            // Check for more markers in remaining buffer
            extracted = extractContent(buffer);
          }

          if (
            updatedPackageJsonPath &&
            previewRuntimeRef.current !== "mobile"
          ) {
            if (typeof window !== "undefined") {
              const win = window as any;
              if (win.executeTerminalCommand && win.waitForTerminalReady) {
                win
                  .waitForTerminalReady("terminal-1", 5000)
                  .then((isReady: boolean) => {
                    if (isReady) {
                      console.log(
                        "package.json updated during stream, triggering npm install && npm run dev...",
                      );

                      // Normalize path to find directory
                      let normalizedPath = updatedPackageJsonPath!.replace(
                        /^\/+/,
                        "",
                      );
                      if (!normalizedPath.startsWith("workspace/")) {
                        normalizedPath = "workspace/" + normalizedPath;
                      }

                      const dir = normalizedPath.substring(
                        0,
                        normalizedPath.lastIndexOf("/"),
                      );
                      const cmd = dir
                        ? `cd ${dir} && npm install && npm run dev`
                        : "npm install && npm run dev";

                      win.executeTerminalCommand(cmd);
                    }
                  });
              }
            }
          }

          dispatch(setStreamActive(false));
          persistProjectRuntime(projectId, previewRuntimeRef.current);
          break;
        }
      }
    } catch (error) {
      console.error(" Error in createResponse:", error);
      dispatch(setStreamActive(false));

      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to create response. Please try again.",
        }),
      );
    }
  };

  return {
    createResponse,
    createSecondaryResponse,
  };
};
