import { configureStore } from "@reduxjs/toolkit";
import projectOptions from "./reducers/projectOptions";
import basicData from "./reducers/basicData";
import projectFiles from "./reducers/projectFiles";
import messagesProvider from "./reducers/chatSlice";
import notificaitonProvider from "./reducers/NotificationModalReducer";
import terminalProvider from "./reducers/TerminalReducer";
import todosSlice from "./reducers/todosSlice";

export const store = configureStore({
  reducer: {
    projectOptions: projectOptions,
    basicData: basicData,
    projectFiles: projectFiles,
    messagesprovider: messagesProvider,
    terminalProvider: terminalProvider,
    notificaitonprovider: notificaitonProvider, //notification modal
    todos: todosSlice,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
