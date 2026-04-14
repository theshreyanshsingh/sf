"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { useSession } from "next-auth/react";

import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { updateProject } from "@/app/_services/projects";

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onRename: (newName: string) => void;
  name: string;
  /** `templateSlug`: update `/templates/{slug}` URL; `name` is the current slug. */
  mode?: "projectTitle" | "templateSlug";
  /** When `mode` is `projectTitle`, overrides dialog heading and success copy (e.g. hub “Update title”). */
  projectTitleHeading?: string;
  /** Called after a successful template slug update with the API response (e.g. refresh Redux). */
  onTemplateSlugSuccess?: (res: Awaited<
    ReturnType<typeof updateProject>
  >) => void;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onRename,
  name,
  mode = "projectTitle",
  projectTitleHeading,
  onTemplateSlugSuccess,
}) => {
  const [newName, setNewName] = useState("");
  const dispatch = useDispatch();
  const { data: session } = useSession();
  const resolvedEmail =
    session?.user?.email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim() || name.trim();
    if (!trimmed) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text:
            mode === "templateSlug"
              ? "Template URL cannot be empty"
              : "Project name cannot be empty",
        })
      );
      return;
    }
    if (mode === "templateSlug") {
      const nextSlug = trimmed.toLowerCase().replace(/\s+/g, "-");
      const current = name.trim().toLowerCase();
      if (nextSlug === current) {
        onClose();
        return;
      }
      try {
        const res = await updateProject({
          projectId,
          action: "update-template-slug",
          email: resolvedEmail,
          templateSlug: nextSlug,
          currentSlug: current,
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
            })
          );
          return;
        }
        const resolved =
          typeof res.templateSlug === "string" && res.templateSlug.trim()
            ? res.templateSlug.trim()
            : nextSlug;
        onRename(resolved);
        onTemplateSlugSuccess?.(res);
        onClose();
        dispatch(
          setNotification({
            modalOpen: true,
            status: "success",
            text: "Template URL updated.",
          })
        );
      } catch (error) {
        console.log(error);
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: "Failed to update template URL",
          })
        );
      }
      return;
    }

    if (!newName.trim()) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Project name cannot be empty",
        })
      );
      return;
    }
    if (newName.trim() === name.trim()) {
      onClose();
      return;
    }
    try {
      await updateProject({
        projectId,
        action: "update-name",
        name: newName.trim(),
        email: resolvedEmail,
      });
      onRename(newName.trim());
      onClose();
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: projectTitleHeading
            ? "Title updated."
            : "Project renamed successfully",
        })
      );
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to rename project",
        })
      );
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-sm bg-[#121212] rounded-md shadow-lg p-3"
          >
            <h3 className="text-sm font-medium text-white mb-4">
              {mode === "templateSlug"
                ? "Update template URL"
                : projectTitleHeading ?? "Rename Project"}
            </h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={newName ? newName : name}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={
                  mode === "templateSlug"
                    ? "new-template-url"
                    : "Enter new project name"
                }
                className="w-full bg-[#2A2A2A] text-white rounded-md px-3 py-1 text-sm focus:outline-none mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-[2px] text-xs text-white font-sans font-medium hover:bg-[#2A2A2A] rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-[2px] text-xs bg-white cursor-pointer text-black font-sans font-medium rounded-md hover:bg-gray-100 transition-colors duration-200"
                >
                  {mode === "templateSlug"
                    ? "Update"
                    : projectTitleHeading
                      ? "Save"
                      : "Rename"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RenameModal;
