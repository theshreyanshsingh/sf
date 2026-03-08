"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/app/redux/store";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { useCreateResponse } from "@/app/_services/useCreateResponse";
import { addMessage, setChatId } from "@/app/redux/reducers/chatSlice";
import type { Message } from "@/app/redux/reducers/chatSlice";
import { ALL_STARTING_POINTS } from "@/app/config/startingPoints";
import { setPreviewRuntime } from "@/app/redux/reducers/projectOptions";

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
  const restoredRef = useRef<string | null>(null);

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

  const getPendingPreviewRuntime = useCallback(
    (projectId: string): "web" | "mobile" | null => {
      if (typeof window === "undefined" || !projectId) return null;

      try {
        const runtimeCache = sessionStorage.getItem(
          `superblocksProjectRuntime_${projectId}`
        );
        if (runtimeCache === "mobile" || runtimeCache === "web") {
          return runtimeCache;
        }

        const sessionKey = `superblocksMessage_${projectId}`;
        const storedData = sessionStorage.getItem(sessionKey);
        if (!storedData) return null;

        const parsed = JSON.parse(storedData) as unknown;
        if (!parsed || typeof parsed !== "object") return null;

        const parsedRecord = parsed as Record<string, unknown>;
        const directRuntime =
          typeof parsedRecord.previewRuntime === "string"
            ? parsedRecord.previewRuntime
            : null;

        const payloadRuntime =
          parsedRecord.payload &&
          typeof parsedRecord.payload === "object" &&
          typeof (parsedRecord.payload as Record<string, unknown>)
            .previewRuntime === "string"
            ? (parsedRecord.payload as Record<string, unknown>).previewRuntime
            : null;

        const runtimeValue = payloadRuntime || directRuntime;
        if (runtimeValue === "mobile") return "mobile";
        if (runtimeValue === "web") return "web";
      } catch (error) {
        console.error("Error reading pending preview runtime:", error);
      }

      return null;
    },
    []
  );

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
          const { message, model, startingPoint, previewRuntime, payload } = JSON.parse(
            storedData
          ) as {
            payload?: {
              previewRuntime?: "web" | "mobile";
            };
            message: Message;
            projectId: string;
            model?: string;
            startingPoint?: string | null;
            previewRuntime?: "web" | "mobile";
          };

          const resolvedPreviewRuntime =
            previewRuntime === "mobile" || previewRuntime === "web"
              ? previewRuntime
              : payload?.previewRuntime === "mobile" ||
                  payload?.previewRuntime === "web"
                ? payload.previewRuntime
                : undefined;

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

    if (
      !projectId ||
      !session?.user?.email ||
      fetchedRef.current === projectId ||
      (currentProjectId === projectId && loading === "done")
    ) {
      return;
    }

    const pendingRuntime = getPendingPreviewRuntime(projectId);
    if (pendingRuntime) {
      dispatch(setPreviewRuntime(pendingRuntime));
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
    if (!messages || messages.length < 1) {
      restoredData = restorePendingMessage(projectId);
    }

    // Get the last message content if messages exist (after potential restore)
    // Use restored message content if available, otherwise use last message from Redux
    const lastMessageContent =
      restoredData?.message?.content ||
      (messages && messages.length > 0
        ? messages[messages.length - 1]?.content || ""
        : "");

    // Use restored model if available, otherwise use model from Redux
    const modelToUse = restoredData?.model;
    if (restoredData?.previewRuntime) {
      dispatch(setPreviewRuntime(restoredData.previewRuntime));
    }
    const requestedPreviewRuntime =
      restoredData?.previewRuntime || pendingRuntime || undefined;

    const startingPointId =
      restoredData?.startingPoint || startingPoint || null;
    const startingTemplate = ALL_STARTING_POINTS.find(
      (item) => item.id === startingPointId
    );
    const shouldApplyStartingPoint =
      !!startingTemplate &&
      (!!restoredData?.startingPoint || !messages || messages.length < 1);

    const storedChatId =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`superblocksChatId_${projectId}`) ||
          sessionStorage.getItem("chatId")
        : null;
    const resolvedChatId = currentChatId || storedChatId || undefined;
    if (resolvedChatId && resolvedChatId !== currentChatId) {
      dispatch(setChatId(resolvedChatId));
    }

    const finalPrompt = shouldApplyStartingPoint
      ? `[STARTING_POINT]\nTemplate: ${startingTemplate?.label}\n\n${startingTemplate?.prompt}\n\nUser request:\n${lastMessageContent}\n\nInstructions:\n- Follow the template structure.\n- Customize to match the user request.\n- Keep the design responsive and production-ready.\n[END_STARTING_POINT]`
      : lastMessageContent;

    createResponse({
      email: session?.user.email || "",
      projectId,
      chatId: resolvedChatId,
      fix: false,
      save: false,
      input: finalPrompt,
      model: modelToUse || undefined,
      previewRuntime: requestedPreviewRuntime,
    });
    // Update ref to prevent duplicate fetches
    fetchedRef.current = projectId;
  }, [
    getProjectId,
    session,
    currentProjectId,
    loading,
    createResponse,
    messages,
    restorePendingMessage,
    getPendingPreviewRuntime,
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
    if (restoredRef.current !== projectId) {
      restoredRef.current = null;
    }
  }, [path, getProjectId]);

  useEffect(() => {
    const projectId = getProjectId();
    const pendingRuntime = getPendingPreviewRuntime(projectId);
    if (pendingRuntime) {
      dispatch(setPreviewRuntime(pendingRuntime));
    }
  }, [dispatch, getProjectId, getPendingPreviewRuntime]);

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
