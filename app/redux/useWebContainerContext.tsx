import { createContext, useContext, ReactNode } from "react";
import { useWebContainer } from "../helpers/useWebContainer";

import type { WebContainer } from "@webcontainer/api";

export type WebContainerState = ReturnType<typeof useWebContainer> & {
  webcontainerInstance: WebContainer | null;
};

export const WebContainerContext = createContext<WebContainerState | null>(
  null
);

export const WebContainerProvider = ({ children }: { children: ReactNode }) => {
  const webContainer = useWebContainer();
  return (
    <WebContainerContext.Provider value={webContainer}>
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
