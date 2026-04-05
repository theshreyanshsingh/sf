import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Todo interface
export interface Todo {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority?: "low" | "medium" | "high";
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Todos state interface
interface TodosState {
  todos: Todo[];
  total: number;
  pending: number;
  completed: number;
}

const initialState: TodosState = {
  todos: [],
  total: 0,
  pending: 0,
  completed: 0,
};

const todosSlice = createSlice({
  name: "todos",
  initialState,
  reducers: {
    // Set all todos (replace existing)
    setTodos: (
      state,
      action: PayloadAction<{
        todos: Todo[];
        total?: number;
        pending?: number;
        completed?: number;
      }>
    ) => {
      state.todos = action.payload.todos;
      state.total = action.payload.total ?? action.payload.todos.length;
      state.completed =
        action.payload.completed ??
        action.payload.todos.filter((t) => t.status === "completed").length;
      state.pending =
        action.payload.pending ??
        action.payload.todos.filter(
          (t) => t.status === "pending" || t.status === "in_progress",
        ).length;
    },
    // Update todos from tool result (merge/update existing todos)
    updateTodosFromTool: (
      state,
      action: PayloadAction<{
        todos: Todo[];
        total?: number;
        pending?: number;
        completed?: number;
      }>
    ) => {
      const newTodos = action.payload.todos;

      // Merge: update existing todos or add new ones
      newTodos.forEach((newTodo) => {
        const existingIndex = state.todos.findIndex((t) => t.id === newTodo.id);
        if (existingIndex >= 0) {
          // Update existing todo
          state.todos[existingIndex] = newTodo;
        } else {
          // Check for duplicate content if ID doesn't match to prevent replication
          const contentMatchIndex = state.todos.findIndex(
            (t) => t.content === newTodo.content
          );
          if (contentMatchIndex >= 0) {
            // Update the existing todo with the new details (including new ID)
            state.todos[contentMatchIndex] = newTodo;
          } else {
            // Add new todo
            state.todos.push(newTodo);
          }
        }
      });

      state.total = state.todos.length;
      state.completed =
        action.payload.completed ??
        state.todos.filter((t) => t.status === "completed").length;
      state.pending =
        action.payload.pending ??
        state.todos.filter(
          (t) => t.status === "pending" || t.status === "in_progress",
        ).length;
    },
    // Clear all todos
    clearTodos: (state) => {
      state.todos = [];
      state.total = 0;
      state.pending = 0;
      state.completed = 0;
    },
  },
});

export const { setTodos, updateTodosFromTool, clearTodos } = todosSlice.actions;
export default todosSlice.reducer;
