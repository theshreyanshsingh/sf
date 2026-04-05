"use client";
import { motion, AnimatePresence } from "framer-motion";
import { FaCode, FaFilePdf, FaUndo } from "react-icons/fa";
import Image from "next/image";
import { LuLoaderCircle } from "react-icons/lu";

import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/redux/store";
import { useState, useEffect, useRef, useCallback } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import {
  setMessages,
  clearMessages,
  type Message,
} from "@/app/redux/reducers/chatSlice";
import type { Todo } from "@/app/redux/reducers/todosSlice";
import {
  dbMessageToUiMessage,
  syncTodosFromHydratedMessages,
} from "@/app/_services/agentMessageNormalize";
import { updateSpecificFile } from "@/app/redux/reducers/projectFiles";
import { refreshPreview } from "@/app/redux/reducers/projectOptions";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { API } from "@/app/config/publicEnv";
import { useGetChatMessages } from "@/app/_services/useChatOperations";
import { extractFileWritesFromSnapshot } from "@/app/_services/fileUpdatesMobile";
import { fetchProjectSnapshot } from "@/app/helpers/fetchProjectSnapshot";

// Collapsible Image Component
const CollapsibleImage = ({ src, alt }: { src: string; alt?: string }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default to open

  return (
    <div className="mb-2 max-w-sm w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between text-xs px-2 py-1 cursor-pointer rounded-md transition-colors border ${"text-white border-[#262626]"}`}
      >
        <span className="flex items-center gap-2 truncate w-auto">
          <span className="truncate">{alt || "Image"}</span>
        </span>
      </button>

      <div className="mt-2 max-w-full">
        <Image
          src={src}
          alt={alt || "Image"}
          width={400}
          height={300}
          className="max-w-full h-auto rounded-md object-contain"
          unoptimized
        />
      </div>
    </div>
  );
};

// File Writes Component
const FileWrites = ({
  fileWrites,
}: {
  fileWrites: Array<{ path: string; content: string }>;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const dispatch = useDispatch();

  // Store files in Redux when component mounts or fileWrites change
  useEffect(() => {
    fileWrites.forEach(({ path, content }) => {
      dispatch(
        updateSpecificFile({
          filePath: path,
          content: content,
          createDirectories: true,
        }),
      );
    });
  }, [fileWrites, dispatch]);

  if (fileWrites.length === 0) return null;

  const formatPath = (path: string) => {
    return path
      .replace(/^\/workspace\//, "/")
      .replace(/^workspace\//, "");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full "
    >
      <div
        className={`backdrop-blur-sm border rounded-lg px-2 py-1 max-w-3xl w-fit text-xs ${" border-[#262626]"}`}
      >
        {fileWrites.length === 1 ? (
          <div className={`text-xs text-gray-300`}>
            Wrote {formatPath(fileWrites[0].path)}
          </div>
        ) : (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`w-full flex items-center justify-between text-xs space-x-2 text-gray-300`}
            >
              <span>
                Wrote {fileWrites.length} file{fileWrites.length > 1 ? "s" : ""}
              </span>
              {isExpanded ? (
                <FaChevronUp className="text-xs" />
              ) : (
                <FaChevronDown className="text-xs" />
              )}
            </button>
            {isExpanded && (
              <div className="mt-2 space-y-1">
                {fileWrites.map((file, idx) => (
                  <div
                    key={idx}
                    className={`text-xs pl-2 py-1 rounded text-gray-300 hover:bg-[#2a2a2a]`}
                  >
                    {formatPath(file.path)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

function formatAgentDurationMs(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const AgentRunBanner = ({ durationMs }: { durationMs: number }) => (
  <div className="w-full min-w-0 self-stretch flex items-center gap-3 my-1 text-zinc-400 text-xs">
    <div className="h-px min-w-0 flex-1 bg-zinc-700/80" />
    <span className="shrink-0 font-medium tracking-tight">
      Worked for {formatAgentDurationMs(durationMs)}
    </span>
    <div className="h-px min-w-0 flex-1 bg-zinc-700/80" />
  </div>
);

/** Model often echoes file counts as prose; we render the structured FileWrites chip instead. */
function lineLooksLikeWroteFilesCount(line: string): boolean {
  const t = line
    .replace(/\*+/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
  return /^Wrote\s+\d+\s+files?\.?$/i.test(t);
}

/** Model echoes single-file writes; FileWrites chip already shows paths. */
function lineLooksLikeWroteFileEcho(line: string): boolean {
  const t = line
    .replace(/\*+/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .trim();
  if (/^wrote\s+file:\s*\S+/i.test(t)) return true;
  if (/^wrote\s+file\s*:\s*\S+/i.test(t)) return true;
  if (/^wrote\s+\/[^\s`]+/i.test(t)) return true;
  if (/^wrote\s+[`']?[\w./\-]+\.(jsx?|tsx?|mjsx?|json|html|css|vue|svelte)\b/i.test(t))
    return true;
  return false;
}

function stripRedundantAssistantProse(
  content: string,
  opts: {
    stripWroteFiles: boolean;
    stripTasksHeading: boolean;
    stripFileEchoLines?: boolean;
  },
): string {
  if (typeof content !== "string") return content;
  let lines = content.split("\n");
  if (opts.stripWroteFiles) {
    lines = lines.filter((line) => !lineLooksLikeWroteFilesCount(line));
  }
  if (opts.stripFileEchoLines !== false) {
    lines = lines.filter((line) => !lineLooksLikeWroteFileEcho(line));
  }
  if (opts.stripTasksHeading) {
    lines = lines.filter((line) => {
      const t = line.replace(/\*+/g, "").replace(/^#+\s*/, "").trim();
      return !/^tasks$/i.test(t);
    });
  }
  let out = lines.join("\n");
  if (opts.stripWroteFiles) {
    out = out.replace(
      /(^|\n)[\t \u00a0]*Wrote\s+\d+\s+files?\.?[\t \u00a0]*(?=\n|$)/gi,
      "$1",
    );
  }
  return out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const getAttachmentFileType = (url: string): "image" | "pdf" | "code" => {
  const hasValidUrl =
    url.startsWith("http") ||
    url.startsWith("blob:") ||
    url.startsWith("data:");
  const hasValidExtension = /\.(jpg|jpeg|png|gif|webp|svg|pdf)$/i.test(url);

  if (!hasValidUrl && !hasValidExtension) {
    return "code";
  }

  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return "image";
  } else if (url.match(/\.(pdf)$/i)) {
    return "pdf";
  }
  return "image";
};

const filterRenderableAttachments = (attachments?: any[]) => {
  if (!attachments || attachments.length === 0) return [];
  return attachments.filter((att) => {
    const url = att?.url != null ? String(att.url).trim() : "";
    const ft = att?.type || getAttachmentFileType(url);
    if (ft === "code" && !url) {
      return false;
    }
    return true;
  });
};

const isRedundantAttachmentMessage = (
  content: string | undefined,
  attachments?: any[],
) => {
  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent || !attachments || attachments.length === 0) return false;

  const normalizedContent = trimmedContent.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalizedContent)) return false;

  return attachments.some((att) => {
    const rawUrl = att?.url != null ? String(att.url).trim() : "";
    if (!rawUrl) return false;
    const normalizedUrl = rawUrl.replace(/\/+$/, "");
    return normalizedUrl === normalizedContent;
  });
};

const getAttachmentDisplayName = (attachment: any) => {
  const rawUrl = attachment?.url != null ? String(attachment.url).trim() : "";
  const normalizedUrl = rawUrl.replace(/\/+$/, "");
  const candidates = [attachment?.label, attachment?.name]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const preferred = candidates.find((value) => {
    const normalizedValue = value.replace(/\/+$/, "");
    return (
      !/^https?:\/\//i.test(normalizedValue) && normalizedValue !== normalizedUrl
    );
  });

  if (preferred) return preferred;

  const fileType = attachment?.type || getAttachmentFileType(rawUrl);
  if (fileType === "pdf") return "PDF";
  if (fileType === "code") return "Code Reference";
  return "Reference image";
};

// Message Attachments Component
const MessageAttachments = ({
  attachments,
  alignment = "end",
}: {
  attachments: any[] | undefined;
  alignment?: "start" | "end";
}) => {
  // Filter out non-actionable "Code Reference" attachments (from backend references
  // e.g. file paths like "src/App.jsx" with url: ""). They add noise with no link to open.
  const filteredAttachments = filterRenderableAttachments(attachments);

  if (filteredAttachments.length === 0) return null;

  return (
    <div
      className={`w-full flex gap-2 overflow-x-auto no-scrollbar ${
        alignment === "end" ? "justify-end" : "justify-start"
      }`}
    >
      <AnimatePresence>
        {filteredAttachments.map((attachment, attIndex) => {
          const fileType =
            attachment.type || getAttachmentFileType(attachment.url || "");
          const displayName = getAttachmentDisplayName(attachment);
          return (
            <motion.div
              key={attIndex}
              className="relative flex-shrink-0 h-auto rounded-md overflow-hidden group w-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              {fileType === "image" && (
                <CollapsibleImage
                  src={attachment.url}
                  alt={displayName}
                />
              )}

              {fileType === "pdf" && (
                <div
                  className={`relative w-auto max-w-[300px] h-[20px] backdrop-blur-sm rounded-md flex items-center gap-2 p-2`}
                >
                  <div className="flex-shrink-0 w-[14px] h-[14px] flex items-center justify-center">
                    <FaFilePdf className={`text-xs text-white/80`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-medium truncate block text-white/80`}
                    >
                      {displayName}
                    </span>
                  </div>
                </div>
              )}

              {fileType === "code" && (
                <div
                  className={`w-full h-[60px] rounded-md overflow-hidden bg-[#1D1E22] flex flex-row items-center p-2 relative border border-[#2a2a2b] gap-2`}
                  title={displayName}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-[#2a2a2b] rounded flex items-center justify-center">
                    <FaCode className={`text-[#4a90e2] text-sm`} />
                  </div>
                  <div className="flex flex-col overflow-hidden w-full">
                    <span className="text-[#71717A] text-[9px] font-mono truncate w-full">
                      Code Reference
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const Messages = () => {
  const dispatch = useDispatch();
  const { data: session } = useSession();
  const pathname = usePathname();
  const messages = useSelector(
    (state: RootState) => state.messagesprovider.messages,
  );

  const { isStreamActive, projectId } = useSelector(
    (state: RootState) => state.projectOptions,
  );

  const { chatId, messagesChatId, streamChatId } = useSelector(
    (state: RootState) => state.messagesprovider,
  );
  const reduxTodos = useSelector((state: RootState) => state.todos.todos);
  const {
    getChatMessages,
    loading: messagesLoading,
    pagination,
  } = useGetChatMessages();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [restoringMessageId, setRestoringMessageId] = useState<string | null>(
    null,
  );
  const [restoredMessageIds, setRestoredMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasLoadedInitialMessages = useRef(false);
  const currentChatIdRef = useRef<string | null>(null);
  const getChatMessagesRef = useRef(getChatMessages);

  // Update ref when getChatMessages changes
  useEffect(() => {
    getChatMessagesRef.current = getChatMessages;
  }, [getChatMessages]);

  // Get generatedName from URL path
  const getProjectIdFromPath = useCallback(() => {
    const pathSegments = pathname.split("/");
    return pathSegments[pathSegments.length - 1] || projectId || "";
  }, [pathname, projectId]);

  // Helper function to check if a tool is a GitHub tool
  const isGithubTool = (toolName: string | undefined): boolean => {
    if (!toolName) return false;
    return toolName.startsWith("github_");
  };

  // Helper function to map GitHub tool names to human-readable descriptions
  const getGithubToolDescription = (toolName: string): string | null => {
    const githubTools: Record<string, string> = {
      github_get_me: "Getting github info",
      github_create_repository: "Creating repository",
      github_create_repo: "Creating repository",
      github_get_repository: "Fetching repository details",
      github_search_repositories: "Searching repositories",
      github_create_or_update_file: "Pushing files",
      github_push_code: "Pushing files",
      github_get_file_contents: "Pulling files",
      github_delete_file: "Deleting file",
      github_create_branch: "Creating branch",
      github_list_branches: "Listing branches",
      github_create_pull_request: "Creating pull request",
      github_list_pull_requests: "Listing pull requests",
      github_create_issue: "Creating issue",
      github_list_issues: "Listing issues",
      github_search_code: "Searching code",
    };

    return githubTools[toolName] || null;
  };

  // Helper function to determine which shimmer to show (only one at a time)
  const getActiveShimmer = (): { text: string; showHeader: boolean } | null => {
    if (
      !isStreamActive ||
      (streamChatId && streamChatId !== chatId) ||
      !messages ||
      messages.length === 0
    )
      return null;

    const lastMessage = messages[messages.length - 1];
    const lastTool = lastMessage?.toolResult?.UsedTool;

    const shouldShowHeader = () => {
      const filteredMessages = messages.filter(
        (msg) =>
          msg.toolResult?.UsedTool !== "code_write" &&
          msg.toolResult?.UsedTool !== "code_read" &&
          msg.toolResult?.UsedTool !== "todo_write" &&
          msg.toolResult?.UsedTool !== "webfetch" &&
          msg.toolResult?.UsedTool !== "todo_read" &&
          msg.toolResult?.UsedTool !== "get_code" &&
          !isGithubTool(msg.toolResult?.UsedTool) &&
          msg.toolResult?.UsedTool !== "WebScreenShotAndReadWebsiteTool" &&
          (msg as any).usedTool !== "WebScreenShotAndReadWebsiteTool" &&
          msg.toolResult?.UsedTool !== "get_project_attachment" &&
          msg.toolResult?.UsedTool !== "issue_write" &&
          msg.toolResult?.UsedTool !== "generate_image" &&
          !(msg.content && /Executed/i.test(msg.content)) &&
          !(
            msg.toolResult?.UsedTool &&
            msg.toolResult?.result?.success === false &&
            (msg.toolResult?.result as any)?.error?.includes("not found")
          ),
      );
      return (
        filteredMessages.length > 0 &&
        filteredMessages[filteredMessages.length - 1]?.role === "user"
      );
    };

    if (lastTool === "save_code") {
      return { text: "Saving the code", showHeader: shouldShowHeader() };
    }
    if (lastTool === "code_write") {
      return { text: "Writing code", showHeader: shouldShowHeader() };
    }
    if (lastTool === "todo_write") {
      return { text: "Thinking tasks", showHeader: shouldShowHeader() };
    }
    if (lastTool === "issue_write") {
      return { text: "Wrote issue", showHeader: shouldShowHeader() };
    }
    if (lastTool === "webfetch") {
      return { text: "Searching", showHeader: shouldShowHeader() };
    }
    if (lastTool === "code_read") {
      return { text: "Reading files", showHeader: shouldShowHeader() };
    }
    if (lastTool === "todo_read") {
      return { text: "Reading tasks", showHeader: shouldShowHeader() };
    }
    if (lastTool === "get_code") {
      return { text: "Reading code", showHeader: shouldShowHeader() };
    }
    if (
      lastTool === "WebScreenShotAndReadWebsiteTool" ||
      (lastMessage as any).usedTool === "WebScreenShotAndReadWebsiteTool"
    ) {
      return { text: "Visiting the website", showHeader: shouldShowHeader() };
    }
    if (lastTool === "get_project_attachment") {
      return {
        text: "Getting project attachment",
        showHeader: shouldShowHeader(),
      };
    }
    if (
      lastTool &&
      lastMessage?.toolResult?.result?.success === false &&
      (lastMessage?.toolResult?.result as any)?.error?.includes("not found")
    ) {
      return {
        text: "Model produced an ambiguous call",
        showHeader: shouldShowHeader(),
      };
    }
    if (lastTool === "generate_image") {
      return { text: "Making an image", showHeader: shouldShowHeader() };
    }

    return {
      text: "",
      showHeader: shouldShowHeader(),
    };
  };

  const convertChatToMessage = useCallback(
    (chat: Parameters<typeof dbMessageToUiMessage>[0]): Message =>
      dbMessageToUiMessage(chat),
    [],
  );

  // Load initial messages when chatId changes
  useEffect(() => {
    // Get generatedName from path
    const generatedName = getProjectIdFromPath();
    const isValidChatId =
      chatId && chatId.trim() !== "" && chatId.trim().length > 0;
    const isValidUser =
      session?.user?.email && session.user.email.trim().length > 0;

    if (!isValidChatId || !generatedName || !isValidUser) {
      setIsInitialLoading(false);
      return;
    }

    // Check if we already have messages for this chat ID
    // This prevents double-fetching when component remounts (e.g. opening preview)
    if (messagesChatId === chatId && messages && messages.length > 0) {
      currentChatIdRef.current = chatId;
      hasLoadedInitialMessages.current = true;
      setIsInitialLoading(false);
      return;
    }

    const chatIdChanged = chatId !== currentChatIdRef.current;

    // If chat ID changed, update ref and reset loaded flag
    if (chatIdChanged) {
      currentChatIdRef.current = chatId;
      hasLoadedInitialMessages.current = false;
      dispatch(clearMessages());
      setIsInitialLoading(true);
    }

    // If we haven't loaded messages for this chat ID yet, fetch them
    if (!hasLoadedInitialMessages.current) {
      hasLoadedInitialMessages.current = true;
      setIsInitialLoading(true);

      getChatMessagesRef
        .current({
          chatId: chatId.trim(),
          projectId: generatedName.trim(),
          userEmail: session?.user?.email?.trim() as string,
          skip: 0,
          limit: 100,
        })
        .then((result) => {
          if (result.success && result.messages) {
            const convertedMessages = result.messages.map(convertChatToMessage);
            const total =
              result.pagination &&
              typeof result.pagination.totalMessages === "number"
                ? result.pagination.totalMessages
                : convertedMessages.length;
            if (total > 0 && convertedMessages.length === 0) {
              console.warn(
                "[Messages] Chat reports messages in DB but none returned; retry load.",
              );
              hasLoadedInitialMessages.current = false;
              return;
            }
            dispatch(
              setMessages({
                messages: convertedMessages,
                chatId: chatId.trim(),
              }),
            );
            syncTodosFromHydratedMessages(convertedMessages, dispatch);
            // Scroll to bottom after initial load
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          } else {
            // Reset flag if fetch failed so we can retry
            hasLoadedInitialMessages.current = false;
          }
        })
        .catch((error) => {
          console.error("Error loading chat messages:", error);
          // Reset flag on error so we can retry
          hasLoadedInitialMessages.current = false;
        })
        .finally(() => {
          setIsInitialLoading(false);
        });
    } else {
      // Already loaded
      setIsInitialLoading(false);
    }
  }, [
    chatId,
    session?.user?.email,
    getProjectIdFromPath,
    convertChatToMessage,
    dispatch,
  ]);

  // Load more messages when scrolling to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMore || !pagination?.hasMore) return;

    // Check if scrolled near top (within 200px)
    if (container.scrollTop < 200) {
      setIsLoadingMore(true);
      const generatedName = getProjectIdFromPath();
      const currentChatId = currentChatIdRef.current;
      if (currentChatId && session?.user?.email && generatedName) {
        // Skip based on current message count to get older messages
        const currentSkip = messages?.length || 0;
        getChatMessagesRef
          .current({
            chatId: currentChatId,
            projectId: generatedName,
            userEmail: session.user.email,
            skip: currentSkip,
            limit: 100,
          })
          .then((result) => {
            if (
              result.success &&
              result.messages &&
              result.messages.length > 0
            ) {
              const convertedMessages =
                result.messages.map(convertChatToMessage);
              // Prepend older messages to the beginning (API returns chronological order)
              // Note: Since we're prepending, we need to combine with existing messages
              // But setMessages replaces all messages.
              // So we should combine them here.
              const newMessages = [...convertedMessages, ...(messages || [])];
              dispatch(
                setMessages({
                  messages: newMessages,
                  chatId: currentChatId,
                }),
              );
              syncTodosFromHydratedMessages(newMessages, dispatch);

              // Maintain scroll position after prepending
              const scrollHeight = container.scrollHeight;
              setTimeout(() => {
                if (container) {
                  const newScrollHeight = container.scrollHeight;
                  container.scrollTop = newScrollHeight - scrollHeight;
                }
              }, 50);
            }
            setIsLoadingMore(false);
          })
          .catch(() => {
            setIsLoadingMore(false);
          });
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [
    messages,
    isLoadingMore,
    pagination,
    session?.user?.email,
    getProjectIdFromPath,
    convertChatToMessage,
    dispatch,
  ]);

  // Attach scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  }, [handleScroll]);

  // Scroll to bottom when new messages are added (from streaming)
  useEffect(() => {
    if (messages && messages.length > 0 && !isLoadingMore) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isLoadingMore]);

  // Function to copy message content to clipboard
  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = content;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopiedMessageId(messageId);
        setTimeout(() => {
          setCopiedMessageId(null);
        }, 500);
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Function to restore code from CloudFront URL
  const handleRestoreCode = async (messageId: string) => {
    if (!API) {
      console.error("API URL is not configured");
      return;
    }

    if (!session?.user?.email) {
      console.error("User email not found");
      return;
    }

    const generatedName = getProjectIdFromPath();
    if (!generatedName) {
      console.error("Project ID not found");
      return;
    }

    // Use the original _id if available, otherwise fall back to id
    const messageToSend = messageId;

    if (!messageToSend) {
      console.error("Message ID is required");
      return;
    }

    try {
      setRestoringMessageId(messageId);

      const response = await fetch(`${API}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: messageToSend,
          owner: session.user.email,
          projectId: generatedName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to restore code");
      }

      const data = await response.json();

      // If restore was successful, fetch and apply the code
      if (data.success && data.codeUrl) {
        try {
          const codeData = await fetchProjectSnapshot({
            projectId: generatedName,
            userEmail: session.user.email,
            codeUrl: data.codeUrl,
          });
          const fileWrites = extractFileWritesFromSnapshot(codeData);

          for (const write of fileWrites) {
            dispatch(
              updateSpecificFile({
                filePath: write.path,
                content: write.content,
                createDirectories: true,
              }),
            );
          }

          // Mark this message as successfully restored
          setRestoredMessageIds((prev) => new Set(prev).add(messageId));

          // Refresh the preview to show the restored code
          // Increment refresh counter to force iframe reload (changes iframe key)
          dispatch(refreshPreview());
          // Clear the refreshing state after a delay (refreshPreview sets it to true)
          setTimeout(() => {
            // dispatch(setIsRefreshing(false));
          }, 1500);
        } catch (fetchError) {
          console.error("Error fetching or applying code:", fetchError);
          throw new Error(
            `Failed to fetch code: ${
              fetchError instanceof Error ? fetchError.message : "Unknown error"
            }`,
          );
        }
      }
    } catch (error) {
      console.error("Error restoring code:", error);
      // Optionally show an error notification
    } finally {
      setRestoringMessageId(null);
    }
  };

  return (
    <div
      ref={messagesContainerRef}
      className={`w-full h-full max-w-3xl py-4 px-2 space-y-3 text-[13px] text-balance leading-relaxed font-sans font-medium overflow-y-auto overflow-x-hidden scroll-smooth text-white`}
      style={{ scrollBehavior: "smooth" }}
    >
      {/* Load more indicator at top */}
      {isLoadingMore && (
        <div className="flex justify-center items-center py-2">
          <LuLoaderCircle className={`text-lg animate-spin text-white`} />
        </div>
      )}
      {(() => {
        const extractMessageFileWrites = (
          msg: Message,
        ): Array<{ path: string; content: string }> => {
          const rawCandidates = [
            msg?.toolResult?.fileWrite,
            msg?.toolResult?.fileWrites,
            msg?.toolResult?.result?.fileWrite,
            msg?.toolResult?.result?.fileWrites,
            (msg as Message & { fileWrite?: unknown }).fileWrite,
            (msg as Message & { fileWrites?: unknown }).fileWrites,
          ];

          const writes: Array<{ path: string; content: string }> = [];
          const normalizeContent = (c: unknown): string | null => {
            if (typeof c === "string") return c;
            if (c != null && typeof c === "object") {
              try {
                return JSON.stringify(c, null, 2);
              } catch {
                return null;
              }
            }
            return null;
          };
          rawCandidates.forEach((candidate) => {
            if (!candidate) return;

            const items = Array.isArray(candidate) ? candidate : [candidate];
            items.forEach((entry) => {
              if (
                entry &&
                typeof entry === "object" &&
                typeof (entry as { path?: string }).path === "string"
              ) {
                const content = normalizeContent(
                  (entry as { content?: unknown }).content,
                );
                if (content != null) {
                  writes.push({
                    path: (entry as { path: string }).path,
                    content,
                  });
                }
              }
            });
          });

          const deduped = new Map<string, { path: string; content: string }>();
          writes.forEach((write) => {
            deduped.set(`${write.path}::${write.content}`, write);
          });

          return Array.from(deduped.values());
        };

        const filteredMessages =
          messages?.filter((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const isGenerateImage =
              msg.toolResult?.UsedTool === "generate_image";

            if (isGenerateImage && isLastMessage && isStreamActive) {
              return false; // Hide it to show shimmer
            }

            const fromMsgFiles = extractMessageFileWrites(msg);

            return (
              (msg.toolResult?.UsedTool !== "code_write" ||
                fromMsgFiles.length > 0) &&
              msg.toolResult?.UsedTool !== "code_read" &&
              msg.toolResult?.UsedTool !== "issue_write" &&
              msg.toolResult?.UsedTool !== "webfetch" &&
              msg.toolResult?.UsedTool !== "todo_read" &&
              msg.toolResult?.UsedTool !== "get_code" &&
              msg.toolResult?.UsedTool !== "WebScreenShotAndReadWebsiteTool" &&
              (msg as Message & { usedTool?: string }).usedTool !==
                "WebScreenShotAndReadWebsiteTool" &&
              msg.toolResult?.UsedTool !== "get_project_attachment" &&
              msg.toolResult?.UsedTool !== "generate_image" &&
              !isGithubTool(msg.toolResult?.UsedTool) &&
              !(msg.content && /Executed/i.test(msg.content)) &&
              !(
                msg.toolResult?.UsedTool &&
                msg.toolResult?.result?.success === false &&
                (msg.toolResult?.result as { error?: string }).error?.includes(
                  "not found",
                )
              )
            );
          }) || [];

        const groupFileWrites = () => {
          const groups: Array<{
            startIndex: number;
            fileWrites: Array<{ path: string; content: string }>;
          }> = [];
          let currentGroup: {
            startIndex: number;
            fileWrites: Array<{ path: string; content: string }>;
          } | null = null;

          messages?.forEach((msg, index) => {
            const messageFileWrites = extractMessageFileWrites(msg);

            if (messageFileWrites.length > 0) {
              if (!currentGroup) {
                currentGroup = {
                  startIndex: index,
                  fileWrites: [],
                };
              }
              currentGroup.fileWrites.push(...messageFileWrites);
            } else {
              if (currentGroup) {
                groups.push(currentGroup);
                currentGroup = null;
              }
            }
          });

          if (currentGroup) {
            groups.push(currentGroup);
          }

          return groups;
        };

        const fileWriteGroups = groupFileWrites();

        // Create a map of message indices to file write groups
        const fileWriteMap = new Map<
          number,
          Array<{ path: string; content: string }>
        >();
        const dedupeFileWritesByPath = (
          writes: Array<{ path: string; content: string }>,
        ): Array<{ path: string; content: string }> => {
          const byPath = new Map<string, { path: string; content: string }>();
          for (const w of writes) {
            byPath.set(w.path, w);
          }
          return Array.from(byPath.values());
        };

        fileWriteGroups.forEach((group) => {
          fileWriteMap.set(
            group.startIndex,
            dedupeFileWritesByPath(group.fileWrites),
          );
        });

        // Create a set of all indices that have file writes (for quick lookup)
        const fileWriteIndices = new Set<number>();
        if (messages) {
          fileWriteGroups.forEach((group) => {
            // Mark all consecutive code_write indices as having file writes
            let idx = group.startIndex;
            while (
              idx < messages.length &&
              extractMessageFileWrites(messages[idx]!).length > 0
            ) {
              fileWriteIndices.add(idx);
              idx++;
            }
          });
        }

        // Helper: For a user message at index, find the codeUrl from subsequent AI messages
        // (before the next user message). Returns the message with codeUrl or null.
        const findCodeUrlForUserMessage = (
          userMsgIndex: number,
        ): { id: string; codeUrl: string } | null => {
          if (!messages) return null;
          for (let i = userMsgIndex + 1; i < messages.length; i++) {
            const m = messages[i];
            // Stop at next user message
            if (m.role === "user") break;
            // Check for codeUrl
            const codeUrl = m.codeUrl || (m as any).code_url;
            if (codeUrl) {
              return {
                id: (m._id || m.id) as string,
                codeUrl: codeUrl,
              };
            }
          }
          return null;
        };

        /** Index of the latest user message in the thread (defines the "current" reply tail). */
        const latestUserMessageIndex =
          messages?.reduce(
            (acc, m, i) => (m.role === "user" ? i : acc),
            -1,
          ) ?? -1;

        /**
         * Mirrors the assistant branches in messages.map that return null, so we can pick exactly
         * one "Superblocks" label per user turn (first visible assistant row after that user).
         */
        const assistantRowWouldRender = (originalIndex: number): boolean => {
          if (
            !messages ||
            originalIndex < 0 ||
            originalIndex >= messages.length
          ) {
            return false;
          }
          const msg = messages[originalIndex];
          if (msg.role !== "assistant") return false;

          const isLastMessage = originalIndex === messages.length - 1;
          const isGenerateImage =
            msg.toolResult?.UsedTool === "generate_image";

          if (isGenerateImage && isLastMessage && isStreamActive) {
            return false;
          }

          if (
            msg.toolResult?.UsedTool === "code_read" ||
            msg.toolResult?.UsedTool === "webfetch" ||
            msg.toolResult?.UsedTool === "todo_read" ||
            msg.toolResult?.UsedTool === "get_code" ||
            msg.toolResult?.UsedTool ===
              "WebScreenShotAndReadWebsiteTool" ||
            (msg as Message & { usedTool?: string }).usedTool ===
              "WebScreenShotAndReadWebsiteTool" ||
            msg.toolResult?.UsedTool === "get_project_attachment" ||
            msg.toolResult?.UsedTool === "issue_write" ||
            isGithubTool(msg.toolResult?.UsedTool) ||
            (msg.content &&
              /Executed/i.test(msg.content) &&
              msg.toolResult?.UsedTool !== "generate_image") ||
            (msg.toolResult?.UsedTool &&
              msg.toolResult?.result?.success === false &&
              (msg.toolResult?.result as { error?: string }).error?.includes(
                "not found",
              ))
          ) {
            return false;
          }

          const hasText =
            typeof msg.content === "string" && msg.content.trim().length > 0;
          const renderableAttachments = filterRenderableAttachments(
            msg.attachments,
          );
          const hasAttachments = renderableAttachments.length > 0;
          const messageFileWritesForVisibility =
            extractMessageFileWrites(msg);
          const hasRenderableFileWrites =
            messageFileWritesForVisibility.length > 0;

          const imageUrl =
            (msg.toolResult?.result as { imageUrl?: string })?.imageUrl ||
            (msg.toolResult?.result as { url?: string })?.url ||
            (msg.toolResult?.result as { attachments?: { url?: string }[] })
              ?.attachments?.[0]?.url;
          const hasGeneratedImage =
            msg.toolResult?.UsedTool === "generate_image" && !!imageUrl;

          if (
            msg.toolResult?.UsedTool === "generate_image" &&
            !imageUrl &&
            !hasText &&
            !hasAttachments
          ) {
            return false;
          }

          if (hasRenderableFileWrites) {
            const isFirstInGroup =
              originalIndex === 0 ||
              extractMessageFileWrites(messages[originalIndex - 1]!).length ===
                0;
            if (!isFirstInGroup) {
              const hasVisibleAssistantText =
                typeof msg.content === "string" &&
                msg.content.trim().length > 0;
              if (!hasVisibleAssistantText) return false;
            }
          }

          const inCurrentReplyTail =
            isStreamActive &&
            streamChatId === chatId &&
            latestUserMessageIndex >= 0 &&
            originalIndex > latestUserMessageIndex;

          if (
            isStreamActive &&
            streamChatId === chatId &&
            msg.toolResult?.UsedTool === "todo_write" &&
            !hasText &&
            !hasRenderableFileWrites &&
            !hasAttachments &&
            !hasGeneratedImage
          ) {
            return false;
          }

          const hasTodoCard =
            msg.toolResult?.UsedTool === "todo_write" &&
            (msg.toolResult?.result?.metadata?.todos?.length ?? 0) > 0 &&
            !(inCurrentReplyTail && msg.role === "assistant");

          if (
            !hasText &&
            !hasAttachments &&
            !hasGeneratedImage &&
            !hasRenderableFileWrites &&
            !hasTodoCard
          ) {
            return false;
          }

          return true;
        };

        const userTurnFirstVisibleAssistant = new Map<number, number>();
        if (messages && messages.length > 0) {
          for (let u = 0; u < messages.length; u++) {
            if (messages[u].role !== "user") continue;
            for (let i = u + 1; i < messages.length; i++) {
              if (messages[i].role === "user") break;
              if (
                messages[i].role === "assistant" &&
                assistantRowWouldRender(i)
              ) {
                userTurnFirstVisibleAssistant.set(u, i);
                break;
              }
            }
          }
        }

        const superblocksLeadIndexForAssistant = (
          assistantIndex: number,
        ): number | undefined => {
          if (!messages || messages.length === 0) return undefined;
          let prevUser = -1;
          for (let j = assistantIndex; j >= 0; j--) {
            if (messages[j].role === "user") {
              prevUser = j;
              break;
            }
          }
          if (prevUser >= 0) {
            return userTurnFirstVisibleAssistant.get(prevUser);
          }
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === "user") break;
            if (
              messages[i].role === "assistant" &&
              assistantRowWouldRender(i)
            ) {
              return i;
            }
          }
          return undefined;
        };

        const isLastAssistantBeforeNextUser = (i: number): boolean => {
          if (!messages || i < 0 || i >= messages.length) return false;
          if (messages[i].role !== "assistant") return false;
          const next = messages[i + 1];
          return !next || next.role === "user";
        };

        /** Duration for the user prompt whose assistant block ends at index `i` (i = last assistant of that turn). */
        const durationMsBannerForTurnEndingAt = (i: number): number | null => {
          if (!messages || !isLastAssistantBeforeNextUser(i)) return null;
          let prevUser = -1;
          for (let j = i; j >= 0; j--) {
            if (messages[j].role === "user") {
              prevUser = j;
              break;
            }
          }
          for (let j = i; j > prevUser; j--) {
            const d = messages[j].agentRun?.durationMs;
            if (typeof d === "number" && d > 0) return d;
          }
          return null;
        };

        const showLiveTasksPanel =
          isStreamActive &&
          streamChatId === chatId &&
          reduxTodos.length > 0;

        if (messages && messages.length > 0) {
          return (
            <>
              {messages.map((msg, originalIndex) => {
                // Skip messages that should be hidden

                const isLastMessage = originalIndex === messages.length - 1;
                const isGenerateImage =
                  msg.toolResult?.UsedTool === "generate_image";

                if (isGenerateImage && isLastMessage && isStreamActive) {
                  return null; // Hide to show shimmer
                }

                if (
                  msg.toolResult?.UsedTool === "code_read" ||
                  msg.toolResult?.UsedTool === "webfetch" ||
                  msg.toolResult?.UsedTool === "todo_read" ||
                  msg.toolResult?.UsedTool === "get_code" ||
                  msg.toolResult?.UsedTool ===
                    "WebScreenShotAndReadWebsiteTool" ||
                  (msg as Message & { usedTool?: string }).usedTool ===
                    "WebScreenShotAndReadWebsiteTool" ||
                  msg.toolResult?.UsedTool === "get_project_attachment" ||
                  msg.toolResult?.UsedTool === "issue_write" ||
                  isGithubTool(msg.toolResult?.UsedTool) ||
                  (msg.content &&
                    /Executed/i.test(msg.content) &&
                    msg.toolResult?.UsedTool !== "generate_image") ||
                  (msg.toolResult?.UsedTool &&
                    msg.toolResult?.result?.success === false &&
                    (msg.toolResult?.result as { error?: string }).error?.includes(
                      "not found",
                    ))
                ) {
                  return null;
                }

                const hasText =
                  typeof msg.content === "string" &&
                  msg.content.trim().length > 0;
                const renderableAttachments = filterRenderableAttachments(
                  msg.attachments,
                );
                const hasAttachments = renderableAttachments.length > 0;
                const messageFileWritesForVisibility =
                  extractMessageFileWrites(msg);
                const hasRenderableFileWrites =
                  messageFileWritesForVisibility.length > 0;

                const imageUrl =
                  (msg.toolResult?.result as { imageUrl?: string })?.imageUrl ||
                  (msg.toolResult?.result as { url?: string })?.url ||
                  (msg.toolResult?.result as { attachments?: { url?: string }[] })
                    ?.attachments?.[0]?.url;
                const hasGeneratedImage =
                  msg.toolResult?.UsedTool === "generate_image" && !!imageUrl;

                if (
                  msg.toolResult?.UsedTool === "generate_image" &&
                  !imageUrl &&
                  !hasText &&
                  !hasAttachments
                ) {
                  return null;
                }

                if (hasRenderableFileWrites) {
                  const isFirstInGroup =
                    originalIndex === 0 ||
                    extractMessageFileWrites(messages[originalIndex - 1]!)
                      .length === 0;
                  if (!isFirstInGroup) {
                    const hasVisibleAssistantText =
                      typeof msg.content === "string" &&
                      msg.content.trim().length > 0;
                    if (!hasVisibleAssistantText) return null;
                  }
                }

                const inCurrentReplyTail =
                  isStreamActive &&
                  streamChatId === chatId &&
                  latestUserMessageIndex >= 0 &&
                  originalIndex > latestUserMessageIndex;

                if (
                  isStreamActive &&
                  streamChatId === chatId &&
                  msg.role === "assistant" &&
                  msg.toolResult?.UsedTool === "todo_write" &&
                  !hasText &&
                  !hasRenderableFileWrites &&
                  !hasAttachments &&
                  !hasGeneratedImage
                ) {
                  return null;
                }

                const hasTodoCard =
                  msg.toolResult?.UsedTool === "todo_write" &&
                  (msg.toolResult?.result?.metadata?.todos?.length ?? 0) > 0 &&
                  !(inCurrentReplyTail && msg.role === "assistant");

                if (
                  msg.role !== "user" &&
                  !hasText &&
                  !hasAttachments &&
                  !hasGeneratedImage &&
                  !hasRenderableFileWrites &&
                  !hasTodoCard
                ) {
                  return null;
                }

                if (msg.role === "user") {
                  const attachments = (msg.attachments || []).slice(0, 5); // Max 5 attachments
                  const shouldHideUserText = isRedundantAttachmentMessage(
                    msg.content,
                    attachments,
                  );

                  return (
                    <div
                      key={msg.id || originalIndex}
                      className="w-full justify-end flex flex-col items-end gap-2"
                    >
                      <div className="flex justify-center items-end flex-col gap-2 max-w-[80%]">
                        <p
                          className={`font-sans font-medium text-xs text-gray-400`}
                        >
                          User
                        </p>

                        {/* Attachments Preview */}
                        <MessageAttachments
                          attachments={attachments}
                          alignment="end"
                        />

                        {/* Message text */}
                        {msg.content && !shouldHideUserText && (
                          <p className={`break-words text-end text-white/80`}>
                            {msg.content}
                          </p>
                        )}

                        {/* Restore button: shown on user message if AI made code changes after it */}
                        {(() => {
                          const codeInfo =
                            findCodeUrlForUserMessage(originalIndex);
                          if (!codeInfo || !codeInfo.id) return null;
                          return (
                            <div className="flex justify-end mt-2">
                              <button
                                type="button"
                                onClick={() => handleRestoreCode(codeInfo.id)}
                                disabled={
                                  restoringMessageId === codeInfo.id ||
                                  restoredMessageIds.has(codeInfo.id)
                                }
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border border-[#262626] bg-transparent text-gray-400 hover:bg-[#262626] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {restoringMessageId === codeInfo.id ? (
                                  <LuLoaderCircle
                                    className="animate-spin flex-shrink-0"
                                    size={12}
                                  />
                                ) : restoredMessageIds.has(codeInfo.id) ? (
                                  "Restored"
                                ) : (
                                  <>
                                    <FaUndo
                                      className="flex-shrink-0"
                                      size={10}
                                    />
                                    Restore
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                } else {
                  const shouldHideAssistantText = isRedundantAttachmentMessage(
                    msg.content,
                    renderableAttachments,
                  );
                  const metaTodos = msg.toolResult?.result?.metadata;
                  const rawSnapTodos = metaTodos?.todos || [];
                  const fromSnapTodos: Todo[] = rawSnapTodos.map(
                    (t: {
                      id: string;
                      content: string;
                      status?: string;
                    }) => ({
                      id: String(t.id),
                      content: String(t.content || ""),
                      status:
                        t.status === "completed" ||
                        t.status === "in_progress" ||
                        t.status === "pending"
                          ? t.status
                          : "pending",
                    }),
                  );
                  const groupedFw = fileWriteMap.get(originalIndex);
                  const showGroupedFileWrites = !!(
                    hasRenderableFileWrites &&
                    groupedFw &&
                    groupedFw.length > 0 &&
                    (originalIndex === 0 ||
                      extractMessageFileWrites(messages[originalIndex - 1]!)
                        .length === 0)
                  );

                  const showTasksCardInsideRow =
                    msg.toolResult?.UsedTool === "todo_write" &&
                    fromSnapTodos.length > 0 &&
                    !(inCurrentReplyTail && reduxTodos.length > 0);

                  const displayTodosInline: Todo[] = fromSnapTodos;

                  const activeTodoCount = displayTodosInline.filter(
                    (t) => t.status !== "completed",
                  ).length;

                  const assistantMarkdownSource =
                    typeof msg.content === "string"
                      ? stripRedundantAssistantProse(msg.content, {
                          stripWroteFiles: hasRenderableFileWrites,
                          stripTasksHeading: showTasksCardInsideRow,
                          stripFileEchoLines: true,
                        })
                      : msg.content;

                  const showMarkdownBlock =
                    typeof assistantMarkdownSource === "string" &&
                    assistantMarkdownSource.trim().length > 0 &&
                    !shouldHideAssistantText &&
                    msg.toolResult?.UsedTool !== "generate_image";

                  const turnBannerMs =
                    durationMsBannerForTurnEndingAt(originalIndex);

                  const prevInThread =
                    originalIndex > 0 ? messages[originalIndex - 1] : undefined;
                  const prevAssistantHadFileWrites =
                    prevInThread?.role === "assistant" &&
                    extractMessageFileWrites(prevInThread).length > 0;
                  /**
                   * One user turn can be split into DB rows: file-write row(s) then a final text row.
                   * The text row still qualifies as "first visible after user" for header math unless we
                   * suppress — it already has "Superblocks" on the file-group start row.
                   */
                  const suppressSuperblocksAsFileGroupTail =
                    prevAssistantHadFileWrites &&
                    !showGroupedFileWrites &&
                    (showMarkdownBlock || turnBannerMs != null);
                  const superblocksLeadIdx =
                    superblocksLeadIndexForAssistant(originalIndex);
                  const showSuperblocksLabel =
                    !suppressSuperblocksAsFileGroupTail &&
                    superblocksLeadIdx !== undefined &&
                    originalIndex === superblocksLeadIdx;

                  return (
                    <div
                      key={msg.id || originalIndex}
                      className="w-full min-w-0 justify-start flex flex-col items-stretch gap-2"
                    >
                      <div className="flex w-full min-w-0 flex-col items-stretch gap-2 max-w-full">
                        {showSuperblocksLabel && (
                          <p
                            className={`font-sans font-medium text-xs text-gray-400`}
                          >
                            Superblocks
                          </p>
                        )}

                        {turnBannerMs != null && (
                          <AgentRunBanner durationMs={turnBannerMs} />
                        )}

                        {showMarkdownBlock && (
                            <div
                              className={`break-words w-full text-start prose prose-invert prose-sm max-w-none text-white/80`}
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Headings
                                  h1: ({ node, ...props }) => (
                                    <h1
                                      className={`text-2xl font-bold mb-3 mt-4 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2
                                      className={`text-xl font-bold mb-2 mt-3 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  h3: ({ node, ...props }) => (
                                    <h3
                                      className={`text-lg font-semibold mb-2 mt-3 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  h4: ({ node, ...props }) => (
                                    <h4
                                      className={`text-base font-semibold mb-1 mt-2 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Paragraphs
                                  p: ({ node, ...props }) => (
                                    <p
                                      className={`mb-2 leading-relaxed text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Lists
                                  ul: ({ node, ...props }) => (
                                    <ul
                                      className={`list-disc list-inside mb-2 space-y-1  pl-4 text-white/80 border-[#262626]`}
                                      {...props}
                                    />
                                  ),
                                  ol: ({ node, ...props }) => (
                                    <ol
                                      className={`list-decimal list-outside mb-2 space-y-2 ml-6  pl-4 text-white/80 border-[#262626]`}
                                      {...props}
                                    />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li
                                      className={`mb-1 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Links
                                  a: ({ node, ...props }) => (
                                    <a
                                      className={`text-blue-500 hover:underline text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Code blocks
                                  code: ({ node, ...props }) => (
                                    <code
                                      className={`bg-transparent p-2 rounded text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Blockquotes
                                  blockquote: ({ node, ...props }) => (
                                    <blockquote
                                      className={`border-l-2 border-gray-200 pl-4 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Tables
                                  table: ({ node, ...props }) => (
                                    <table
                                      className={`w-full border-collapse border border-gray-200 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  // Images - collapsible
                                  img: ({ node, ...props }: any) => (
                                    <CollapsibleImage
                                      src={props.src || ""}
                                      alt={props.alt}
                                    />
                                  ),
                                  // Bold and italic
                                  strong: ({ node, ...props }) => (
                                    <strong
                                      className={`font-bold text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  em: ({ node, ...props }) => (
                                    <em
                                      className={`italic text-white/80`}
                                      {...props}
                                    />
                                  ),

                                  pre: ({ node, ...props }) => (
                                    <pre
                                      className={`px-3 p-1 rounded-md overflow-x-auto mb-2 border text-white/80`}
                                      {...props}
                                    />
                                  ),

                                  // Horizontal rule
                                  hr: ({ node, ...props }) => (
                                    <hr
                                      className={`my-4 border-gray-600`}
                                      {...props}
                                    />
                                  ),

                                  thead: ({ node, ...props }) => (
                                    <thead
                                      className={`border-b border-[#262626]`}
                                      {...props}
                                    />
                                  ),
                                  tbody: ({ node, ...props }) => (
                                    <tbody {...props} />
                                  ),
                                  tr: ({ node, ...props }) => (
                                    <tr
                                      className={`border-b border-[#262626]`}
                                      {...props}
                                    />
                                  ),
                                  th: ({ node, ...props }) => (
                                    <th
                                      className={`px-4 py-2 text-left font-semibold text-white/80`}
                                      {...props}
                                    />
                                  ),
                                  td: ({ node, ...props }) => (
                                    <td
                                      className={`px-4 py-2 text-white/80`}
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {assistantMarkdownSource}
                              </ReactMarkdown>
                            </div>
                          )}

                        {showGroupedFileWrites && groupedFw && (
                          <FileWrites fileWrites={groupedFw} />
                        )}

                        {showTasksCardInsideRow &&
                          displayTodosInline.length > 0 && (
                          <div className="w-full border border-[#262626] rounded-lg px-3 py-2 bg-zinc-950/50 max-w-[85%]">
                            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                              Tasks · {activeTodoCount} active ·{" "}
                              {displayTodosInline.length} total
                            </p>
                            <ul className="space-y-1 max-h-48 overflow-y-auto text-xs text-zinc-300">
                              {displayTodosInline.map((t) => (
                                <li
                                  key={t.id}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-zinc-500 shrink-0 w-3">
                                    {t.status === "completed"
                                      ? "✓"
                                      : t.status === "in_progress"
                                        ? "…"
                                        : "○"}
                                  </span>
                                  <span
                                    className={
                                      t.status === "completed"
                                        ? "line-through text-zinc-500"
                                        : ""
                                    }
                                  >
                                    {t.content}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          )}

                        {msg.toolResult?.UsedTool === "generate_image" &&
                          (() => {
                            const genImageUrl =
                              (msg.toolResult?.result as any)?.imageUrl ||
                              (msg.toolResult?.result as any)?.url ||
                              (msg.toolResult?.result as any)?.attachments?.[0]
                                ?.url;
                            const label =
                              (msg.toolResult?.result as any)?.label ||
                              "Generated image";
                            return (
                              genImageUrl && (
                                <CollapsibleImage
                                  src={genImageUrl}
                                  alt={label}
                                />
                              )
                            );
                          })()}

                        <MessageAttachments
                          attachments={renderableAttachments}
                          alignment="start"
                        />
                      </div>
                    </div>
                  );
                }
              })}
              {showLiveTasksPanel && (
                <div
                  key={`live-task-panel-${chatId || "session"}`}
                  className="w-full justify-start flex flex-col items-start gap-2"
                >
                  <div className="w-full border border-[#262626] rounded-lg px-3 py-2 bg-zinc-950/50 max-w-[85%]">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">
                      Tasks ·{" "}
                      {
                        reduxTodos.filter((t) => t.status !== "completed")
                          .length
                      }{" "}
                      active · {reduxTodos.length} total
                    </p>
                    <ul className="space-y-1 max-h-48 overflow-y-auto text-xs text-zinc-300">
                      {reduxTodos.map((t) => (
                        <li key={t.id} className="flex items-start gap-2">
                          <span className="text-zinc-500 shrink-0 w-3">
                            {t.status === "completed"
                              ? "✓"
                              : t.status === "in_progress"
                                ? "…"
                                : "○"}
                          </span>
                          <span
                            className={
                              t.status === "completed"
                                ? "line-through text-zinc-500"
                                : ""
                            }
                          >
                            {t.content}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {/* Single shimmer component - shows only one shimmer at a time */}
              {(() => {
                const activeShimmer = getActiveShimmer();
                if (!activeShimmer) return null;

                const lastMessage = messages?.[messages.length - 1];
                const lastTool = lastMessage?.toolResult?.UsedTool;

                // Get additional info for specific tools
                const getAdditionalInfo = () => {
                  if (lastTool === "webfetch") {
                    return (lastMessage?.toolResult?.result as any)?.url
                      ? `${(lastMessage?.toolResult?.result as any)?.url}`
                      : null;
                  }
                  if (lastTool === "code_read") {
                    return (lastMessage?.toolResult?.result as any)?.name
                      ? `${(lastMessage?.toolResult?.result as any)?.name}`
                      : null;
                  }
                  if (
                    lastTool === "WebScreenShotAndReadWebsiteTool" ||
                    (lastMessage as any).usedTool ===
                      "WebScreenShotAndReadWebsiteTool"
                  ) {
                    const toolUrl =
                      (lastMessage?.toolResult?.result as any)?.toolUrl ||
                      (lastMessage as any).toolUrl ||
                      (lastMessage?.toolResult as any)?.toolUrl;
                    return toolUrl ? toolUrl : null;
                  }
                  return null;
                };

                const additionalInfo = getAdditionalInfo();

                return (
                  <div className="w-full justify-start flex flex-col items-start gap-2">
                    <div className="flex justify-center items-start flex-col gap-2 max-w-[80%]">
                      {activeShimmer.showHeader && (
                        <p
                          className={`font-sans font-medium text-xs text-gray-400`}
                        >
                          Superblocks
                        </p>
                      )}
                      <div className="flex flex-col gap-1">
                        <p
                          className={`break-words text-start flex items-center text-white`}
                        >
                          <span className="animate-pulse">
                            {activeShimmer.text}
                          </span>
                          {!activeShimmer.text && (
                            <span className="inline-flex items-center ml-1">
                              <span className={`animate-dot-1 text-white`}>
                                .
                              </span>
                              <span className={`animate-dot-2 text-white`}>
                                .
                              </span>
                              <span className={`animate-dot-3 text-white`}>
                                .
                              </span>
                            </span>
                          )}
                        </p>
                        {additionalInfo && (
                          <p className={`text-xs break-all text-gray-400`}>
                            {lastTool === "webfetch" ||
                            lastTool === "code_read" ? (
                              <>
                                {lastTool === "webfetch"
                                  ? "Visiting: "
                                  : "Reading: "}
                                <span className="text-[#2C7BE1]">
                                  {additionalInfo}
                                </span>
                              </>
                            ) : (
                              <span className="text-[#2C7BE1]">
                                {additionalInfo}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Scroll anchor at bottom */}
              <div ref={messagesEndRef} />
            </>
          );
        }

        // If we only have tool messages, show shimmer using getActiveShimmer
        if (
          filteredMessages.length === 0 &&
          isStreamActive &&
          streamChatId === chatId
        ) {
          const activeShimmer = getActiveShimmer();
          if (activeShimmer) {
            return (
              <div className="w-full justify-start flex flex-col items-start gap-2">
                <div className="flex justify-center items-start flex-col gap-2 max-w-[80%]">
                  <p
                    className={`break-words text-start flex items-center text-white`}
                  >
                    <span className="inline-flex items-center ml-1">
                      <span className="animate-dot-1 text-white">.</span>
                      <span className="animate-dot-2 text-white">.</span>
                      <span className="animate-dot-3 text-white">.</span>
                    </span>
                  </p>
                </div>
              </div>
            );
          }
        }

        return null;
      })()}
      {/* Show loading only when initial loading is true OR when loading messages with no content */}
      {isInitialLoading || messagesLoading ? (
        <div
          className={`w-full h-full flex justify-center items-center flex-col space-y-2 text-lg font-medium text-white`}
        >
          <LuLoaderCircle className={`text-2xl animate-spin text-white`} />
        </div>
      ) : null}
      {/* Show empty state only when not loading and no messages */}
      {!isInitialLoading &&
      !messagesLoading &&
      (!messages ||
        (messages.filter(
          (msg) =>
            msg.toolResult?.UsedTool !== "code_write" &&
            msg.toolResult?.UsedTool !== "code_read" &&
            msg.toolResult?.UsedTool !== "webfetch" &&
            !isGithubTool(msg.toolResult?.UsedTool) &&
            msg.toolResult?.UsedTool !== "WebScreenShotAndReadWebsiteTool" &&
            (msg as any).usedTool !== "WebScreenShotAndReadWebsiteTool" &&
            msg.toolResult?.UsedTool !== "get_project_attachment" &&
            msg.toolResult?.UsedTool !== "issue_write" &&
            msg.toolResult?.UsedTool !== "generate_image" &&
            !(msg.content && /Executed/i.test(msg.content)) &&
            !(
              msg.toolResult?.UsedTool &&
              msg.toolResult?.result?.success === false &&
              (msg.toolResult?.result as any)?.error?.includes("not found")
            ),
        ).length === 0 &&
          !messages.some(
            (msg) =>
              msg.toolResult?.UsedTool === "code_write" ||
              msg.toolResult?.UsedTool === "code_read" ||
              msg.toolResult?.UsedTool === "webfetch" ||
              msg.toolResult?.UsedTool === "todo_read" ||
              isGithubTool(msg.toolResult?.UsedTool) ||
              msg.toolResult?.UsedTool === "WebScreenShotAndReadWebsiteTool" ||
              (msg as any).usedTool === "WebScreenShotAndReadWebsiteTool" ||
              msg.toolResult?.UsedTool === "get_project_attachment" ||
              msg.toolResult?.UsedTool === "issue_write" ||
              msg.toolResult?.UsedTool === "generate_image" ||
              (msg.toolResult?.UsedTool &&
                msg.toolResult?.result?.success === false &&
                (msg.toolResult?.result as any)?.error?.includes("not found")),
          ))) ? (
        <div
          className={`w-full h-full flex justify-center items-center flex-col space-y-2 text-lg font-medium text-white`}
        >
          <LuLoaderCircle className="animate-spin text-white" size={24} />
        </div>
      ) : null}
    </div>
  );
};

export default Messages;
