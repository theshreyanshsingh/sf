import { API } from "@/app/config/publicEnv";

export const fetchProjectSnapshot = async ({
  projectId,
  userEmail,
  codeUrl,
}: {
  projectId: string;
  userEmail: string;
  codeUrl?: string | null;
}): Promise<Record<string, any>> => {
  const response = await fetch(`${API}/fetch-project-snapshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      projectId,
      userEmail,
      codeUrl: codeUrl?.trim() || undefined,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    data?: Record<string, any>;
    initialCode?: Record<string, any>;
    generatedFiles?: Record<string, any>;
  };

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "Failed to fetch project snapshot.");
  }

  return payload.data || payload.initialCode || payload.generatedFiles || {};
};
