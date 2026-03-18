"use client";

import { useState, useCallback } from "react";
import { API } from "@/app/config/publicEnv";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";

interface RenameChatParams {
  chatId: string;
  newChatTitle: string;
  email: string;
}

interface AddChatParams {
  chatId: string;
  newChatTitle: string;
  email: string;
  projectId: string;
}

interface DeleteChatParams {
  chatId: string;
  email: string;
}

interface GetProjectChatsParams {
  projectId: string;
  email: string;
}

interface Chat {
  _id: string;
  title: string;
  chatId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  chats?: Chat[];
  chat?: Chat;
}

export function useRenameChat() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState<boolean>(false);

  const renameChat = useCallback(
    async (params: RenameChatParams) => {
      if (!API) {
        dispatch(
          setNotification({
            text: "API URL is not configured",
            status: "error",
            modalOpen: true,
          })
        );

        return { success: false };
      }

      if (!session?.user?.email) {
        dispatch(
          setNotification({
            text: "User email not found",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      try {
        setLoading(true);

        const response = await fetch(`${API}/rename-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: params.chatId,
            newChatTitle: params.newChatTitle,
            email: params.email || session.user.email,
          }),
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          dispatch(
            setNotification({
              text: data.message || "Failed to rename chat",
              status: "error",
              modalOpen: true,
            })
          );
          return { success: false };
        }

        return { success: true, data };
      } catch (error) {
        console.error("Error renaming chat:", error);
        dispatch(
          setNotification({
            text: "An error occurred while renaming chat",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.email, dispatch]
  );

  return { renameChat, loading };
}

export function useAddChat() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState<boolean>(false);

  const addChat = useCallback(
    async (params: AddChatParams) => {
      if (!API) {
        dispatch(
          setNotification({
            text: "API URL is not configured",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      if (!session?.user?.email) {
        dispatch(
          setNotification({
            text: "User email not found",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      try {
        setLoading(true);

        const response = await fetch(`${API}/add-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: params.chatId,
            newChatTitle: params.newChatTitle,
            email: params.email || session.user.email,
            projectId: params.projectId,
          }),
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          dispatch(
            setNotification({
              text: data.message || "Failed to add chat",
              status: "error",
              modalOpen: true,
            })
          );
          return { success: false };
        }

        return { success: true, data };
      } catch (error) {
        console.error("Error adding chat:", error);
        dispatch(
          setNotification({
            text: "An error occurred while adding chat",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.email, dispatch]
  );

  return { addChat, loading };
}

export function useDeleteChat() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState<boolean>(false);

  const deleteChat = useCallback(
    async (params: DeleteChatParams) => {
      if (!API) {
        dispatch(
          setNotification({
            text: "API URL is not configured",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      if (!session?.user?.email) {
        dispatch(
          setNotification({
            text: "User email not found",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      try {
        setLoading(true);

        const response = await fetch(`${API}/delete-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: params.chatId,
            email: params.email || session.user.email,
          }),
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.success) {
          dispatch(
            setNotification({
              text: data.message || "Failed to delete chat",
              status: "error",
              modalOpen: true,
            })
          );
          return { success: false };
        }

        return { success: true, data };
      } catch (error) {
        console.error("Error deleting chat:", error);
        dispatch(
          setNotification({
            text: "An error occurred while deleting chat",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.email, dispatch]
  );

  return { deleteChat, loading };
}

export function useGetProjectChats() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getProjectChats = useCallback(
    async (params: GetProjectChatsParams) => {
      if (!API) {
        setError("API URL is not configured");
        dispatch(
          setNotification({
            text: "API URL is not configured",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      if (!session?.user?.email) {
        setError("User email not found");
        dispatch(
          setNotification({
            text: "User email not found",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API}/get-project-chats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: params.projectId,
            email: params.email || session.user.email,
          }),
        });

        const data = (await response.json()) as ApiResponse & {
          chats?: Chat[];
        };

        if (!response.ok || !data.success) {
          const errorMessage = data.message || "Failed to fetch project chats";
          setError(errorMessage);
          dispatch(
            setNotification({
              text: errorMessage,
              status: "error",
              modalOpen: true,
            })
          );
          setChats([]);
          return { success: false };
        }

        if (data.chats && Array.isArray(data.chats)) {
          setChats(data.chats);
        } else {
          setChats([]);
        }

        return { success: true, chats: data.chats || [] };
      } catch (error) {
        console.error("Error fetching project chats:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An error occurred while fetching project chats";
        setError(errorMessage);
        dispatch(
          setNotification({
            text: errorMessage,
            status: "error",
            modalOpen: true,
          })
        );
        setChats([]);
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.email, dispatch]
  );

  return {
    chats,
    loading,
    error,
    getProjectChats,
  };
}

interface GetChatMessagesParams {
  chatId: string;
  projectId: string;
  userEmail: string;
  skip?: number;
  limit?: number;
}

interface Pagination {
  totalMessages: number;
  currentCount: number;
  skip: number;
  limit: number;
  hasMore: boolean;
  range: string;
}

interface ChatMessage {
  _id?: string;
  id?: string;
  role: "user" | "assistant";
  content?: string;
  text?: string;
  createdAt?: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
  toolResult?: any;
  codeUrl?: string;
  code_url?: string;
}

interface GetChatMessagesResponse {
  success: boolean;
  messages: ChatMessage[];
  pagination: Pagination;
  chatId: string;
  projectId: string;
  message?: string;
}

export function useGetChatMessages() {
  const { data: session } = useSession();
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const getChatMessages = useCallback(
    async (params: GetChatMessagesParams) => {
      // Validate all required parameters before making API call
      if (!API) {
        setError("API URL is not configured");
        dispatch(
          setNotification({
            text: "API URL is not configured",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      if (!session?.user?.email) {
        setError("User email not found");
        dispatch(
          setNotification({
            text: "User email not found",
            status: "error",
            modalOpen: true,
          })
        );
        return { success: false };
      }

      // Validate required parameters
      if (!params.chatId || !params.chatId.trim()) {
        console.warn("getChatMessages: chatId is required but not provided");
        return { success: false };
      }

      if (!params.projectId || !params.projectId.trim()) {
        console.warn("getChatMessages: projectId is required but not provided");
        return { success: false };
      }

      const userEmail = params.userEmail || session.user.email;
      if (!userEmail || !userEmail.trim()) {
        console.warn("getChatMessages: userEmail is required but not provided");
        return { success: false };
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API}/get-chat-messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: params.chatId.trim(),
            projectId: params.projectId.trim(),
            userEmail: userEmail.trim(),
            skip: params.skip || 0,
            limit: params.limit || 100,
          }),
        });

        const data = (await response.json()) as GetChatMessagesResponse;

        if (!response.ok || !data.success) {
          const errorMessage = data.message || "Failed to fetch chat messages";
          // setError(errorMessage);
          // dispatch(
          //   setNotification({
          //     message: errorMessage,
          //     type: "error",
          //   })
          // );
          return { success: false };
        }

        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
        } else {
          setMessages([]);
        }

        if (data.pagination) {
          setPagination(data.pagination);
        }

        return {
          success: true,
          messages: data.messages || [],
          pagination: data.pagination,
        };
      } catch (error) {
        console.error("Error fetching chat messages:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An error occurred while fetching chat messages";
        // setError(errorMessage);
        // dispatch(
        //   setNotification({
        //     message: errorMessage,
        //     type: "error",
        //   })
        // );
        return { success: false };
      } finally {
        setLoading(false);
      }
    },
    [session?.user?.email, dispatch]
  );

  return {
    messages,
    loading,
    error,
    pagination,
    getChatMessages,
  };
}
