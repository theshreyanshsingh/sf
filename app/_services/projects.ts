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

export const updateProject = async ({
  projectId,
  action,
  name,
  value,
}: {
  projectId: string;
  action: string;
  name?: string;
  value?: boolean;
}): Promise<{
  success: boolean;
  message?: string;
}> => {
  return fetch(`${API}/update-project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId, action, name, value }),
  }).then((res) => res.json());
};
