// utils/trackEvent.ts
import posthog from "posthog-js";

export interface EventProperties {
  [key: string]: string | number | boolean | undefined | null;
}

export const trackEvent = (
  eventName: string,
  properties: EventProperties = {}
): void => {
  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
};
