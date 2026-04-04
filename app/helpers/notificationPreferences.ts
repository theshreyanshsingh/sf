export const PROJECT_COMPLETION_NOTIFICATION_KEY =
  "superblocks_play_completion_notification";

export const ensureProjectCompletionNotificationPreference = (): boolean => {
  if (typeof window === "undefined") return true;

  const existingValue = window.localStorage.getItem(
    PROJECT_COMPLETION_NOTIFICATION_KEY,
  );

  if (existingValue === null) {
    window.localStorage.setItem(PROJECT_COMPLETION_NOTIFICATION_KEY, "true");
    return true;
  }

  return existingValue === "true";
};

export const getProjectCompletionNotificationEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(PROJECT_COMPLETION_NOTIFICATION_KEY) === "true"
  );
};

export const setProjectCompletionNotificationEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PROJECT_COMPLETION_NOTIFICATION_KEY,
    enabled ? "true" : "false",
  );
};
