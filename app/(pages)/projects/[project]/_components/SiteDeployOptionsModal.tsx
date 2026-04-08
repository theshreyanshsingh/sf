"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import { setSiteDeployMeta } from "@/app/redux/reducers/projectOptions";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { updateProject } from "@/app/_services/projects";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { uploadProjectAttachment } from "@/app/helpers/uploadProjectAttachment";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
};

const FAVICON_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico,image/vnd.microsoft.icon";
const FAVICON_MAX_BYTES = 2 * 1024 * 1024;

function fileNameFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last || last.length > 100) return null;
    return decodeURIComponent(last);
  } catch {
    return null;
  }
}

/** Favicons uploaded via this modal use `favicon_<ts>_<n>.ext` under `/uploads/`. */
function isLikelyUploadedFaviconUrl(url: string): boolean {
  try {
    const p = new URL(url.trim()).pathname;
    return /\/uploads\/favicon_\d+_\d+\./i.test(p);
  } catch {
    return false;
  }
}

const SiteDeployOptionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const siteMetaTitle = useSelector(
    (s: RootState) => s.projectOptions.siteMetaTitle,
  );
  const siteFaviconUrl = useSelector(
    (s: RootState) => s.projectOptions.siteFaviconUrl,
  );

  const [mounted, setMounted] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  /** User-typed favicon URL only — never auto-filled with the CDN URL after upload. */
  const [manualFaviconUrl, setManualFaviconUrl] = useState("");
  /** CDN URL from file upload; kept separate from the Image URL field. */
  const [uploadedFaviconUrl, setUploadedFaviconUrl] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconPreviewFailed, setFaviconPreviewFailed] = useState(false);
  const [uploadedFileLabel, setUploadedFileLabel] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle(siteMetaTitle ?? "");
    setFaviconPreviewFailed(false);
    const stored = siteFaviconUrl?.trim() ?? "";
    if (!stored) {
      setManualFaviconUrl("");
      setUploadedFaviconUrl(null);
      setUploadedFileLabel(null);
    } else if (isLikelyUploadedFaviconUrl(stored)) {
      setManualFaviconUrl("");
      setUploadedFaviconUrl(stored);
      setUploadedFileLabel(fileNameFromUrl(stored));
    } else {
      setManualFaviconUrl(stored);
      setUploadedFaviconUrl(null);
      setUploadedFileLabel(null);
    }
  }, [isOpen, siteMetaTitle, siteFaviconUrl]);

  const previewFaviconUrl =
    uploadedFaviconUrl?.trim() || manualFaviconUrl.trim();

  const faviconDisplayName = (() => {
    if (!previewFaviconUrl) return "";
    if (uploadedFaviconUrl?.trim()) {
      return (
        uploadedFileLabel ??
        fileNameFromUrl(uploadedFaviconUrl) ??
        "Uploaded image"
      );
    }
    return fileNameFromUrl(manualFaviconUrl) ?? "Image from URL";
  })();

  const effectiveFaviconForSave =
    manualFaviconUrl.trim() !== ""
      ? manualFaviconUrl.trim()
      : uploadedFaviconUrl?.trim() || null;

  const handleSave = async () => {
    const em = email.value;
    if (typeof em !== "string" || !em.trim()) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Sign in to save site options.",
        }),
      );
      return;
    }
    if (!projectId) return;

    setSaving(true);
    try {
      const res = await updateProject({
        projectId,
        action: "update-site-meta",
        email: em,
        siteMetaTitle: draftTitle.trim() === "" ? null : draftTitle.trim(),
        siteFaviconUrl: effectiveFaviconForSave,
      });
      if (!res.success) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text:
              typeof res.message === "string"
                ? res.message
                : "Could not save site options.",
          }),
        );
        return;
      }
      dispatch(
        setSiteDeployMeta({
          siteMetaTitle:
            draftTitle.trim() === "" ? null : draftTitle.trim().slice(0, 120),
          siteFaviconUrl: effectiveFaviconForSave,
        }),
      );
      onClose();
    } catch {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Could not save site options.",
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFaviconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const em = email.value;
    if (typeof em !== "string" || !em.trim()) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Sign in to upload a favicon.",
        }),
      );
      return;
    }

    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".ico")) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Use an image file (PNG, JPG, WebP, SVG, or ICO).",
        }),
      );
      return;
    }

    if (file.size > FAVICON_MAX_BYTES) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Favicon must be 2 MB or smaller.",
        }),
      );
      return;
    }

    const base = `favicon_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const ext =
      file.name.includes(".") && /\.[a-z0-9]+$/i.test(file.name)
        ? file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ""
        : "";

    setFaviconUploading(true);
    try {
      const result = await uploadProjectAttachment(file, `${base}${ext}`, em);
      if (!result.ok) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: result.message,
          }),
        );
        return;
      }
      setManualFaviconUrl("");
      setUploadedFaviconUrl(result.url);
      setUploadedFileLabel(file.name);
      setFaviconPreviewFailed(false);
    } finally {
      setFaviconUploading(false);
    }
  };

  const modalTree = (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="site-deploy-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xl"
            style={{
              WebkitBackdropFilter: "blur(20px)",
              backdropFilter: "blur(20px)",
            }}
            onClick={onClose}
          />
          <motion.div
            key="site-deploy-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-deploy-options-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-[min(12vh,120px)] z-[121] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[#2a2a2b] bg-[#141416]/90 p-5 shadow-2xl backdrop-blur-md"
            style={{
              WebkitBackdropFilter: "blur(12px)",
              backdropFilter: "blur(12px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="site-deploy-options-title"
              className="text-sm font-semibold text-white"
            >
              Published site appearance
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              These apply to the next web publish (browser tab title and
              favicon). Leave blank to use the template defaults.
            </p>

            <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Meta title
            </label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="My app"
              maxLength={120}
              className="mt-1.5 w-full rounded-lg border border-[#2a2a2b] bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            <div className="mt-4">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Favicon
              </label>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Paste a public{" "}
                <span className="text-zinc-400">image URL</span>
                , <span className="text-zinc-400">or</span> upload a file
                below. Max 2 MB (PNG, JPG, WebP, SVG, ICO).
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={FAVICON_ACCEPT}
              className="hidden"
              onChange={(ev) => void handleFaviconFile(ev)}
            />

            <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Image URL
            </label>
            <input
              type="url"
              value={manualFaviconUrl}
              onChange={(e) => {
                setManualFaviconUrl(e.target.value);
                setUploadedFaviconUrl(null);
                setUploadedFileLabel(null);
                setFaviconPreviewFailed(false);
              }}
              placeholder="https://example.com/favicon.png"
              className="mt-1 w-full rounded-lg border border-[#2a2a2b] bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            <div
              className="my-4 flex items-center gap-3"
              role="separator"
              aria-label="or upload a file"
            >
              <div className="h-px flex-1 bg-[#2a2a2b]" />
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                or
              </span>
              <div className="h-px flex-1 bg-[#2a2a2b]" />
            </div>

            <button
              type="button"
              disabled={faviconUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center rounded-lg border border-[#3f3f46] bg-[#1c1c1f] px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-[#27272a] disabled:opacity-50"
            >
              {faviconUploading ? "Uploading…" : "Upload image file"}
            </button>

            {previewFaviconUrl ? (
              <div className="mt-4 rounded-xl border border-[#2a2a2b] bg-[#0c0c0e] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Your favicon
                </p>
                <div className="mt-3 flex gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#2a2a2b] bg-[#18181b]">
                    {faviconPreviewFailed ? (
                      <span className="px-2 text-center text-[10px] leading-tight text-zinc-500">
                        Preview unavailable
                      </span>
                    ) : (
                      <img
                        src={previewFaviconUrl}
                        alt="Favicon preview"
                        className="max-h-full max-w-full object-contain p-1"
                        onError={() => setFaviconPreviewFailed(true)}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p
                        className="truncate text-sm font-medium text-white"
                        title={faviconDisplayName}
                      >
                        {faviconDisplayName}
                      </p>
                      {uploadedFaviconUrl?.trim() ? (
                        <span className="shrink-0 rounded-md border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">
                          Uploaded
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                          URL
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-[#252525] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || faviconUploading}
                onClick={() => void handleSave()}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalTree, document.body);
};

export default SiteDeployOptionsModal;
