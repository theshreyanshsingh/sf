"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { useSession } from "next-auth/react";

import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { updateProject } from "@/app/_services/projects";

function normalizeAboutStored(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t : null;
}

interface TemplateAboutUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  /** Project display title */
  title: string;
  currentSlug: string;
  about: string | null;
  /** Whether this template version is listed in the public gallery */
  isPublic: boolean;
  onSaved: () => void;
}

const TemplateAboutUrlModal: React.FC<TemplateAboutUrlModalProps> = ({
  isOpen,
  onClose,
  projectId,
  title: initialTitle,
  currentSlug,
  about,
  isPublic,
  onSaved,
}) => {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAbout, setDraftAbout] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftIsPublic, setDraftIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch();
  const { data: session } = useSession();
  const resolvedEmail =
    session?.user?.email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");

  useEffect(() => {
    if (isOpen) {
      setDraftTitle(initialTitle.trim() ? initialTitle : "");
      setDraftAbout(typeof about === "string" ? about : "");
      setDraftSlug(currentSlug.trim());
      setDraftIsPublic(isPublic !== false);
    }
  }, [isOpen, initialTitle, about, currentSlug, isPublic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Title cannot be empty.",
        }),
      );
      return;
    }

    const nextAbout = draftAbout.trim() === "" ? null : draftAbout.trim();
    const prevAbout = normalizeAboutStored(about);
    const prevTitle = (initialTitle || "").trim();
    const titleChanged = nextTitle !== prevTitle;
    const aboutChanged = nextAbout !== prevAbout;

    const rawSlug = draftSlug.trim().toLowerCase().replace(/\s+/g, "-");
    const prevSlug = currentSlug.trim().toLowerCase();
    if (!rawSlug) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Template URL cannot be empty.",
        }),
      );
      return;
    }
    const slugChanged = rawSlug !== prevSlug;
    const initialPublic = isPublic !== false;
    const visibilityChanged = draftIsPublic !== initialPublic;

    if (!titleChanged && !aboutChanged && !slugChanged && !visibilityChanged) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      if (titleChanged || aboutChanged) {
        const res = await updateProject({
          projectId,
          action: "update-project-settings",
          email: resolvedEmail,
          ...(titleChanged ? { title: nextTitle } : {}),
          ...(aboutChanged ? { about: nextAbout } : {}),
        });
        if (!res.success) {
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text:
                typeof res.message === "string"
                  ? res.message
                  : "Could not update title or description.",
            }),
          );
          return;
        }
      }

      if (slugChanged) {
        const res = await updateProject({
          projectId,
          action: "update-template-slug",
          email: resolvedEmail,
          templateSlug: rawSlug,
          currentSlug: prevSlug,
        });
        if (!res.success) {
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text:
                typeof res.message === "string"
                  ? res.message
                  : "Could not update template URL.",
            }),
          );
          return;
        }
      }

      if (visibilityChanged) {
        const slugForVisibility = slugChanged ? rawSlug : prevSlug;
        const visRes = await updateProject({
          projectId,
          action: "update-template-visibility",
          email: resolvedEmail,
          currentSlug: slugForVisibility,
          templateVersionIsPublic: draftIsPublic,
        });
        if (!visRes.success) {
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text:
                typeof visRes.message === "string"
                  ? visRes.message
                  : "Could not update visibility.",
            }),
          );
          return;
        }
      }

      onSaved();
      onClose();
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: "Template details updated.",
        }),
      );
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Something went wrong. Try again.",
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[201] max-h-[min(90dvh,calc(100dvh-2rem))] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md bg-[#121212] p-3 shadow-lg"
          >
            <h3 className="mb-1 text-sm font-medium text-white">
              Template title, description, and URL
            </h3>
            <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">
              Title and description apply to the project. The slug is the path{" "}
              <span className="font-mono text-zinc-400">/templates/…</span>
            </p>
            <form onSubmit={handleSubmit}>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Title
              </label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Project title"
                maxLength={200}
                className="mb-4 w-full rounded-md bg-[#2A2A2A] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                autoFocus
              />
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                About
              </label>
              <textarea
                value={draftAbout}
                onChange={(e) => setDraftAbout(e.target.value)}
                placeholder="Short description for templates and your reference"
                rows={4}
                maxLength={12000}
                className="mb-4 w-full resize-y rounded-md bg-[#2A2A2A] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                URL slug
              </label>
              <input
                type="text"
                value={draftSlug}
                onChange={(e) => setDraftSlug(e.target.value)}
                placeholder="my-template"
                className="mb-4 w-full rounded-md bg-[#2A2A2A] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                autoComplete="off"
              />
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={draftIsPublic}
                  onChange={(e) => setDraftIsPublic(e.target.checked)}
                  disabled={saving}
                  className="rounded border-zinc-600 bg-[#2A2A2A] text-white focus:ring-zinc-500"
                />
                <span>List in public gallery</span>
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-md px-4 py-[2px] font-sans text-xs font-medium text-white transition-colors duration-200 hover:bg-[#2A2A2A] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-md bg-white px-4 py-[2px] font-sans text-xs font-medium text-black transition-colors duration-200 hover:bg-gray-100 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TemplateAboutUrlModal;
