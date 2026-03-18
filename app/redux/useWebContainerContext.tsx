import { createContext, useContext, useRef, type ReactNode } from "react";
import type { WebContainer } from "@webcontainer/api";

export type WebContainerState = {
  state: "loading" | "error" | "success" | null;
  bootContainer: () => void;
  isTerminalReady: "loading" | "error" | "success" | null;
  setIsTerminalReady: (v: "loading" | "error" | "success" | null) => void;
  terminalInstanceRef: React.RefObject<unknown>;
  uri: string | null;
  executeCommand: (cmd: string, args?: string[]) => Promise<{ success: boolean; output: string; error?: string }>;
  webcontainerInstance: WebContainer | null;
  commandLogs: string[];
  grantAITerminalControl: () => void;
  workingdirRef: React.RefObject<string | null>;
};

export const WebContainerContext = createContext<WebContainerState | null>(null);

export const WebContainerProvider = ({ children }: { children: ReactNode }) => {
  const workingdirRef = useRef<string | null>(null);
  const terminalInstanceRef = useRef<unknown>(null);

  const stub: WebContainerState = {
    state: null,
    bootContainer: () => {},
    isTerminalReady: null,
    setIsTerminalReady: () => {},
    terminalInstanceRef,
    uri: null,
    executeCommand: async () => ({ success: false, output: "", error: "stub" }),
    webcontainerInstance: null,
    commandLogs: [],
    grantAITerminalControl: () => {},
    workingdirRef,
  };

  return (
    <WebContainerContext.Provider value={stub}>
      {children}
    </WebContainerContext.Provider>
  );
};

export const useWebContainerContext = () => {
  const context = useContext(WebContainerContext);
  if (!context) {
    throw new Error(
      "useWebContainerContext must be used within a WebContainerProvider"
    );
  }
  return context;
};
