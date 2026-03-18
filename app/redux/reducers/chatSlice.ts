import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Tool result interface for todo_write and other tools
export interface ToolResult {
  UsedTool?: string;
  result?: {
    success?: boolean;
    title?: string;
    output?: string;
    metadata?: {
      todos?: Array<{
        id: string;
        content: string;
        status: string;
        priority?: string;
        tags?: string[];
        createdAt?: string;
        updatedAt?: string;
      }>;
      total?: number;
      pending?: number;
      completed?: number;
    };
  };
}

// Message interface for chat messages
export interface Message {
  id: string;
  _id?: string; // Original database ID (preserved for API calls)
  role: "user" | "assistant";
  content: string;
  createdAt?: string | Date; // Timestamp when message was created
  attachments?: {
    name: string;
    url: string;
    type: string;
    label?: string;
    preview?: string;
  }[];
  toolResult?: ToolResult; // Tool execution results
  codeUrl?: string; // CloudFront URL for code restoration
  chatId?: string; // ID of the chat this message belongs to
}

// Chat state interface
interface ChatState {
  // Whether the chat panel is hidden
  isChatHidden: boolean | null;
  // Whether the preview panel is opened
  previewOpened: boolean;
  // Array of chat messages
  messages: null | Message[];
  // Animation direction for chat panel slide
  chatSlideDirection: "left" | "right";
  // Current view mode: "messages" shows the chat messages, "history" shows chat history
  chatViewMode: "messages" | "history";
  // Current chat ID (project/thread ID)
  chatId: string | null;
  // ID of the chat that the current messages belong to
  messagesChatId: string | null;
  // ID of the chat that the active stream belongs to
  streamChatId: string | null;
  // Suggested prompt to inject into input (from external triggers like Database button)
  suggestedPrompt: string | null;
}

const initialState: ChatState = {
  isChatHidden: false,
  previewOpened: false,
  messages: null,
  chatSlideDirection: "left",
  chatViewMode: "messages", // Default to showing messages
  chatId: null, // No chat ID initially
  messagesChatId: null,
  streamChatId: null,
  suggestedPrompt: null, // No suggested prompt initially
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Toggle chat panel visibility
    toggleChat: (state) => {
      state.isChatHidden = !state.isChatHidden;
    },
    // Set chat panel hidden state
    setChatHidden: (state, action: PayloadAction<boolean>) => {
      state.isChatHidden = action.payload;
      // When showing chat (from hidden), it slides from left
      if (!action.payload) {
        state.chatSlideDirection = "left";
      }
    },
    // Set preview panel opened state
    setPreviewOpened: (state, action: PayloadAction<boolean>) => {
      state.previewOpened = action.payload;
      // When opening preview, chat slides from right
      if (action.payload) {
        state.chatSlideDirection = "right";
      }
    },
    // Set chat slide animation direction
    setChatSlideDirection: (state, action: PayloadAction<"left" | "right">) => {
      state.chatSlideDirection = action.payload;
    },
    // Toggle between messages and history view
    toggleChatViewMode: (state) => {
      state.chatViewMode =
        state.chatViewMode === "messages" ? "history" : "messages";
    },
    // Set chat view mode explicitly
    setChatViewMode: (state, action: PayloadAction<"messages" | "history">) => {
      state.chatViewMode = action.payload;
    },
    // Set the current chat ID
    setChatId: (state, action: PayloadAction<string | null>) => {
      state.chatId = action.payload;
    },
    // Set the stream chat ID
    setStreamChatId: (state, action: PayloadAction<string | null>) => {
      state.streamChatId = action.payload;
    },
    // Add a new message to the messages array
    addMessage: (state, action: PayloadAction<Message>) => {
      // If message has a chatId, only add it if it matches the current chatId
      // If state.chatId is null (New Chat), reject messages that have a specific chatId
      if (
        action.payload.chatId &&
        (!state.chatId || action.payload.chatId !== state.chatId)
      ) {
        return;
      }

      if (state.messages === null) {
        state.messages = [];
      }
      state.messages.push(action.payload);
    },
    // Add multiple messages to the messages array
    addMessages: (state, action: PayloadAction<Message[]>) => {
      if (state.messages === null) {
        state.messages = [];
      }

      // Filter messages that don't match current chatId (if they have one)
      const messagesToAdd = action.payload.filter((msg) => {
        if (msg.chatId && (!state.chatId || msg.chatId !== state.chatId)) {
          return false;
        }
        return true;
      });

      state.messages.push(...messagesToAdd);
    },
    // Clear all messages
    clearMessages: (state) => {
      state.messages = [];
      state.messagesChatId = null;
    },
    // Set all messages (replace existing messages)
    setMessages: (
      state,
      action: PayloadAction<{ messages: Message[]; chatId: string }>
    ) => {
      state.messages = action.payload.messages;
      state.messagesChatId = action.payload.chatId;
    },
    // Set suggested prompt for input injection
    setSuggestedPrompt: (state, action: PayloadAction<string | null>) => {
      state.suggestedPrompt = action.payload;
    },
    // Reset chat state back to defaults
    resetChatState: () => initialState,
  },
});

export const {
  toggleChat,
  setChatHidden,
  setPreviewOpened,
  setChatSlideDirection,
  toggleChatViewMode,
  setChatViewMode,
  setChatId,
  setStreamChatId,
  addMessage,
  addMessages,
  clearMessages,
  setMessages,
  setSuggestedPrompt,
  resetChatState,
} = chatSlice.actions;
export default chatSlice.reducer;
