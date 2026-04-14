"use client";

import { API } from "../config/publicEnv";

import { type CommunityTemplateDto } from "@/app/helpers/communityTemplateAdapter";

export async function fetchTemplateBySlug(
  slug: string,
): Promise<CommunityTemplateDto | null> {
  if (!API) return null;
  try {
    const res = await fetch(
      `${API}/v1/templates/by-slug/${encodeURIComponent(slug)}`,
      { method: "GET", cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      template?: CommunityTemplateDto;
    };
    return data.success && data.template ? data.template : null;
  } catch {
    return null;
  }
}

export async function fetchPublicTemplates(params?: {
  category?: string;
}): Promise<CommunityTemplateDto[]> {
  if (!API) return [];
  const q = new URLSearchParams();
  if (params?.category) q.set("category", params.category);
  const url = `${API}/v1/templates${q.toString() ? `?${q}` : ""}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      success?: boolean;
      templates?: CommunityTemplateDto[];
    };
    return data.success && Array.isArray(data.templates) ? data.templates : [];
  } catch {
    return [];
  }
}

/**
 * Logged-in: create a new project from a published template slug (POST /v1/use-template).
 * Single entry point for gallery detail + your-templates; avoids duplicate handlers.
 */
export async function forkProjectFromTemplateSlug(params: {
  email: string;
  templateSlug: string;
}): Promise<
  | { ok: true; projectId: string }
  | { ok: false; message: string }
> {
  if (!API) {
    return { ok: false, message: "API not configured." };
  }
  const email = params.email.trim();
  const templateSlug = params.templateSlug.trim();
  if (!email || !templateSlug) {
    return { ok: false, message: "email and templateSlug are required." };
  }
  try {
    const res = await fetch(`${API}/v1/use-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, templateSlug }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      projectId?: string;
      message?: string;
    };
    if (data.success && data.projectId) {
      return { ok: true, projectId: data.projectId };
    }
    return {
      ok: false,
      message:
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "Could not create project from template.",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Request failed",
    };
  }
}

export async function fetchMyTemplates(email: string): Promise<
  {
    slug: string;
    title: string;
    /** Project description shown on template cards; shared across versions from the same project. */
    about?: string | null;
    category: string | null;
    isPublic: boolean;
    generatedName: string;
    previewUrl?: string | null;
    updatedAt?: string;
  }[]
> {
  if (!API || !email.trim()) return [];
  try {
    const res = await fetch(`${API}/v1/my-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      success?: boolean;
      templates?: {
        slug: string;
        title: string;
        about?: string | null;
        category: string | null;
        isPublic: boolean;
        generatedName: string;
        previewUrl?: string | null;
        updatedAt?: string;
      }[];
    };
    return data.success && Array.isArray(data.templates) ? data.templates : [];
  } catch {
    return [];
  }
}
