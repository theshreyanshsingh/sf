import { API } from "../config/publicEnv";

export const handleGenerateVariants = ({ input }: { input: string }) => {
  console.log(input);
};
export const handleAskAI = ({ input }: { input: string }) => {
  console.log(input);
};

export const buildProject = async ({
  input,
  memory,
  cssLibrary,
  framework,
  projectId,
  email,
}: {
  input: string;
  memory: string;
  cssLibrary: string;
  framework: string;
  projectId: string;
  email: string;
}): Promise<{
  success: boolean;
  message?: string;
  title: string;
  projectId: string;
}> => {
  return fetch(`${API}/build-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      input,
      memory,
      cssLibrary,
      framework,
      projectId,
      owner: email,
    }),
  }).then((res) => res.json());
};

export const saveProject = async ({
  data,
  projectId,
  email,
}: {
  data: string;
  projectId: string;
  email: string;
}): Promise<{
  success: boolean;
  message?: string;
}> => {
  return fetch(`${API}/save-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({ data, projectId, owner: email }),
  }).then((res) => res.json());
};

export const saveMoreDatatoProject = async ({
  data,
  projectId,
  email,
}: {
  data: string;
  projectId: string;
  email: string;
}): Promise<{
  success: boolean;
  message?: string;
}> => {
  return fetch(`${API}/save-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data, projectId, owner: email }),
  }).then((res) => res.json());
};

export const saveMemory = async ({
  text,
  projectId,
  email,
}: {
  text: string;
  projectId: string;
  email: string;
}): Promise<{
  success: boolean;
  message?: string;
}> => {
  return fetch(`${API}/save-memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, projectId, email }),
  }).then((res) => res.json());
};

export const remixProject = async ({
  sourceProjectId,
  email,
}: {
  sourceProjectId: string;
  email: string;
}): Promise<{
  success: boolean;
  message?: string;
  projectId?: string;
}> => {
  const resolvedEmail =
    email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");
  return fetch(`${API}/v1/remix-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceProjectId,
      email: resolvedEmail,
    }),
  }).then((res) => res.json());
};

/** Same endpoint as Header publish polling — use after queueing a publish (e.g. new template). */
export async function fetchPublishStatus({
  email,
  projectId,
}: {
  email: string;
  projectId: string;
}): Promise<{
  success: boolean;
  message?: string;
  phase?: string;
  deployedUrl?: string | null;
  deployedImage?: string | null;
  error?: string | null;
}> {
  const resolvedEmail =
    email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");
  const res = await fetch(`${API}/publish-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: resolvedEmail, projectId }),
  });
  try {
    return (await res.json()) as {
      success: boolean;
      message?: string;
      phase?: string;
      deployedUrl?: string | null;
      deployedImage?: string | null;
      error?: string | null;
    };
  } catch {
    return { success: false, message: "Invalid response" };
  }
}

export const updateProject = async ({
  projectId,
  action,
  name,
  value,
  email,
  siteMetaTitle,
  siteFaviconUrl,
  templateSlug,
  currentSlug,
  templateVersionIsPublic,
  title,
  about,
}: {
  projectId: string;
  action: string;
  name?: string;
  value?: boolean;
  email?: string;
  siteMetaTitle?: string | null;
  siteFaviconUrl?: string | null;
  templateSlug?: string;
  /** When updating slug, identifies which version (required if multiple). */
  currentSlug?: string;
  /** When creating a template version: whether it appears in the public gallery. */
  templateVersionIsPublic?: boolean;
  title?: string;
  about?: string | null;
}): Promise<{
  success: boolean;
  message?: string;
  templateSlug?: string;
  templateCategory?: string | null;
  templateVersions?: Array<{
    slug: string;
    category: string;
    isPublic: boolean;
    previewUrl?: string | null;
    createdAt?: string;
  }>;
  publishQueued?: boolean;
  title?: string;
  about?: string | null;
}> => {
  const resolvedEmail =
    email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");
  return fetch(`${API}/update-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      action,
      name,
      value,
      email: resolvedEmail,
      siteMetaTitle,
      siteFaviconUrl,
      templateSlug,
      currentSlug,
      templateVersionIsPublic,
      title,
      about,
    }),
  }).then((res) => res.json());
};
