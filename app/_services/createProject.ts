"use client";

import { API } from "../config/publicEnv";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  error?: string;
  [key: string]: unknown;
}

interface CreateProjectPayload {
  prompt: string;
  model: string;

  attachments: string[];
  attachmentCount: number;
  projectId: string;
  session: string | undefined;
  startingPoint?: string | null;
  previewRuntime?: "web" | "mobile";
  platform?: "web" | "mobile";
}

interface CreateProjectResponse {
  success: boolean;
  message: string;
  projectId?: string;
  error?: string;
  upgradeNeeded?: boolean;
  chatId?: string;
  chatName?: string;
  projectTitle?: string;
}

export const createProject = async (
  payload: CreateProjectPayload
): Promise<CreateProjectResponse> => {
  try {
    if (!API) {
      console.error(
        "API URL is not configured. Check NEXT_PUBLIC_API environment variable."
      );
      return {
        success: false,
        message: "API configuration error. Please check environment variables.",
        error: "API URL is not set",
      };
    }

    const url = `${API}/v1/create-project`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result =
      (await response.json()) as ApiResponse<CreateProjectResponse>;
    return {
      success: result.success,
      message: result.message || "Project created successfully",
      projectId: result.projectId as string | undefined,
      chatName: result.chatName as string | undefined,
      chatId: result.chatId as string | undefined,
      error: result.error,
      upgradeNeeded: result.upgradeNeeded as boolean | undefined,
      projectTitle: result.projectTitle as string | undefined,
    };
  } catch (error) {
    console.error("Create project error:", error);
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
