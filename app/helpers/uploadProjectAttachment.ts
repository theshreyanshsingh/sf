import { API } from "@/app/config/publicEnv";

/**
 * Uploads a file via the same `/upload-attachment` pipeline as chat attachments.
 * Returns the public CDN URL on success.
 */
export async function uploadProjectAttachment(
  file: File,
  fileName: string,
  email: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!email.trim()) {
    return { ok: false, message: "Sign in to upload." };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", fileName);
  formData.append("email", email);

  try {
    const response = await fetch(`${API}/upload-attachment`, {
      method: "POST",
      body: formData,
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      url?: string;
      message?: string;
    };

    if (!response.ok || !data.success || typeof data.url !== "string") {
      return {
        ok: false,
        message:
          typeof data.message === "string"
            ? data.message
            : "Upload failed. Try again.",
      };
    }

    return { ok: true, url: data.url };
  } catch {
    return { ok: false, message: "Upload failed. Try again." };
  }
}
