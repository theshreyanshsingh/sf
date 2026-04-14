"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/redux/store";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { useCreateResponse } from "@/app/_services/useCreateResponse";
import {
  addMessage,
  resetChatState,
  setChatId,
} from "@/app/redux/reducers/chatSlice";
import type { Message } from "@/app/redux/reducers/chatSlice";
import { ALL_STARTING_POINTS } from "@/app/config/startingPoints";
import {
  resetProjectOptions,
  lockPreviewRuntime,
  fetchProject,
  setGenerating,
} from "@/app/redux/reducers/projectOptions";
import { resolvePreviewRuntimeFromRecord } from "@/app/helpers/previewRuntime";
import { EmptySheet } from "@/app/redux/reducers/projectFiles";
import { clearTodos } from "@/app/redux/reducers/todosSlice";
import { resetTerminal } from "@/app/redux/reducers/TerminalReducer";
import { resetNotification } from "@/app/redux/reducers/NotificationModalReducer";

export function useProject() {
  const { data: session } = useSession();

  const { loading, projectId: currentProjectId } = useSelector(
    (state: RootState) => state.projectOptions
  );
  const { startingPoint } = useSelector(
    (state: RootState) => state.projectOptions
  );

  const dispatch: AppDispatch = useDispatch();
  const path = usePathname();

  const fetchedRef = useRef<string | null>(null);
  const fetchInFlightRef = useRef<string | null>(null);
  const restoredRef = useRef<string | null>(null);
  const clearedRef = useRef<string | null>(null);

  const { createResponse } = useCreateResponse();
  const messages = useSelector(
    (state: RootState) => state.messagesprovider.messages
  );
  const currentChatId = useSelector(
    (state: RootState) => state.messagesprovider.chatId
  );

  const getProjectId = useCallback(() => {
    const segments = path.split("/");
    return segments[2] || "";
  }, [path]);

  // Function to restore pending message from sessionStorage
  // Returns the restored data (message, model) or null if nothing was restored
  const restorePendingMessage = useCallback(
    (
      projectId: string
    ): {
      message: Message;
      model?: string;
      startingPoint?: string;
      previewRuntime?: "web" | "mobile";
    } | null => {
      // Prevent restoring multiple times for the same project
      if (restoredRef.current === projectId) {
        return null;
      }

      try {
        const sessionKey = `superblocksMessage_${projectId}`;
        const storedData = sessionStorage.getItem(sessionKey);

        if (storedData) {
          const parsed = JSON.parse(storedData) as {
            payload?: Record<string, unknown>;
            message: Message;
            projectId: string;
            model?: string;
            startingPoint?: string | null;
            previewRuntime?: string | null;
            runtime?: string | null;
            platform?: string | null;
            projectRuntime?: string | null;
            framework?: string | null;
          };

          const resolvedPreviewRuntime =
            resolvePreviewRuntimeFromRecord(parsed as Record<string, unknown>) ||
            undefined;

          const { message, model, startingPoint } = parsed;

          // Add the message to Redux
          dispatch(addMessage(message));

          // Clear from sessionStorage after restoring
          sessionStorage.removeItem(sessionKey);

          // Mark as restored
          restoredRef.current = projectId;

          return {
            message,
            model,
            startingPoint: startingPoint || undefined,
            previewRuntime: resolvedPreviewRuntime,
          };
        }
      } catch (error) {
        console.error("Error restoring pending message:", error);
      }

      return null;
    },
    [dispatch]
  );

  // Function to fetch project data
  const fetchProjectData = useCallback(() => {
    const projectId = getProjectId();
    const userEmail = session?.user?.email || "";

    if (!projectId || !userEmail) {
      return;
    }

    const didReset =
      currentProjectId !== projectId &&
      clearedRef.current !== projectId;
    if (didReset) {
      dispatch(resetProjectOptions());
      dispatch(EmptySheet());
      dispatch(resetChatState());
      dispatch(clearTodos());
      dispatch(resetTerminal());
      dispatch(resetNotification());
      clearedRef.current = projectId;
      fetchedRef.current = null;
      restoredRef.current = null;
    }

    const storedChatId =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`superblocksChatId_${projectId}`) ||
          sessionStorage.getItem("chatId")
        : null;
    const effectiveChatId = didReset ? null : currentChatId;
    const resolvedChatId = effectiveChatId || storedChatId || undefined;
    if (resolvedChatId && resolvedChatId !== currentChatId) {
      dispatch(setChatId(resolvedChatId));
    }

    if (
      fetchInFlightRef.current === projectId ||
      fetchedRef.current === projectId ||
      (currentProjectId === projectId && loading === "done")
    ) {
      return;
    }

    // First, try to restore pending message if no messages exist
    let restoredData:
      | {
          message: Message;
          model?: string;
          startingPoint?: string;
          previewRuntime?: "web" | "mobile";
        }
      | null = null;
    const effectiveMessages = didReset ? null : messages;
    if (!effectiveMessages || effectiveMessages.length < 1) {
      restoredData = restorePendingMessage(projectId);
    }

    // Get the last message content if messages exist (after potential restore)
    // Use restored message content if available, otherwise use last message from Redux
    const lastMessageContent =
      restoredData?.message?.content ||
      (effectiveMessages && effectiveMessages.length > 0
        ? effectiveMessages[effectiveMessages.length - 1]?.content || ""
        : "");

    // Use restored model if available, otherwise use model from Redux
    const modelToUse = restoredData?.model;
    if (restoredData?.previewRuntime) {
      dispatch(lockPreviewRuntime(restoredData.previewRuntime));
    }
    const requestedPreviewRuntime = restoredData?.previewRuntime || undefined;

    if (restoredData) {
      dispatch(
        setGenerating({
          generating: true,
          isResponseCompleted: false,
          generationSuccess: "thinking",
        }),
      );
    }

    const effectiveStartingPoint = didReset ? null : startingPoint;
    const startingPointId =
      restoredData?.startingPoint || effectiveStartingPoint || null;
    const startingTemplate = ALL_STARTING_POINTS.find(
      (item) => item.id === startingPointId
    );
    const shouldApplyStartingPoint =
      !!startingTemplate &&
      (!!restoredData?.startingPoint || !messages || messages.length < 1);

    const normalizedUserRequest = lastMessageContent.trim();
    const normalizedStartingPrompt = startingTemplate?.prompt?.trim() || "";
    const shouldAppendUserRequest =
      normalizedUserRequest.length > 0 &&
      normalizedUserRequest !== normalizedStartingPrompt;

    const finalPrompt = shouldApplyStartingPoint
      ? `[STARTING_POINT]\nTemplate: ${startingTemplate?.label}\n\n${startingTemplate?.prompt}\n${
          shouldAppendUserRequest
            ? `\nUser request:\n${normalizedUserRequest}\n`
            : "\n"
        }Instructions:\n- Follow the template structure.\n${
          shouldAppendUserRequest
            ? "- Customize to match the user request.\n"
            : ""
        }- Keep the design responsive and production-ready.\n[END_STARTING_POINT]`
      : normalizedUserRequest;

    fetchInFlightRef.current = projectId;

    void (async () => {
      try {
        await dispatch(
          fetchProject({
            string: JSON.stringify({
              projectId,
              owner: userEmail,
              ...(requestedPreviewRuntime
                ? { previewRuntime: requestedPreviewRuntime }
                : {}),
            }),
          }),
        ).unwrap();

        if (restoredData) {
          await createResponse({
            email: userEmail,
            projectId,
            chatId: resolvedChatId,
            fix: false,
            save: false,
            input: finalPrompt,
            model: modelToUse || undefined,
            previewRuntime: requestedPreviewRuntime,
          });
        }

        fetchedRef.current = projectId;
      } catch (error) {
        console.error("Error loading project metadata:", error);
        fetchedRef.current = null;
      } finally {
        if (fetchInFlightRef.current === projectId) {
          fetchInFlightRef.current = null;
        }
      }
    })();
  }, [
    getProjectId,
    session,
    currentProjectId,
    loading,
    createResponse,
    messages,
    restorePendingMessage,
    startingPoint,
    currentChatId,
    dispatch,
  ]);

  // Reset the fetchedRef and restoredRef when path changes
  useEffect(() => {
    const projectId = getProjectId();
    if (fetchedRef.current !== projectId) {
      fetchedRef.current = null;
    }
    if (fetchInFlightRef.current !== projectId) {
      fetchInFlightRef.current = null;
    }
    if (restoredRef.current !== projectId) {
      restoredRef.current = null;
    }
    if (clearedRef.current !== projectId) {
      clearedRef.current = null;
    }
  }, [path, getProjectId]);

  // Initial fetch: do not block on terminal readiness.
  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  return {
    fetchProjectData,
    loading,
    projectId: currentProjectId,
  };
}
