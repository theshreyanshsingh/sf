// hooks/useTrackEvent.ts
import { useCallback } from "react";
import { trackEvent, EventProperties } from "./trackEvent";

export const useTrackEvent = () => {
  return useCallback((eventName: string, properties?: EventProperties) => {
    trackEvent(eventName, properties);
  }, []);
};
