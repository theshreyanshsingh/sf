"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { patchProjectOptions } from "@/app/redux/reducers/projectOptions";
import { fetchPublishStatus, updateProject } from "@/app/_services/projects";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { SiteDeployAppearancePanel } from "./SiteDeployAppearancePanel";

type Section = "appearance" | "settings" | "templates";

type TemplateVersionRow = {
  slug: string;
  category: string;
  isPublic: boolean;
  previewUrl?: string | null;
  createdAt?: string | null;
};

function normalizeTemplateVersions(
  raw: unknown,
): TemplateVersionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (v): v is { slug: string } =>
        v != null &&
        typeof v === "object" &&
        typeof (v as { slug?: unknown }).slug === "string",
    )
    .map((v) => {
      const o = v as {
        slug: string;
        category?: string;
        isPublic?: boolean;
        previewUrl?: unknown;
        createdAt?: unknown;
      };
      return {
        slug: o.slug,
        category:
          typeof o.category === "string" ? o.category : "Landing Pages",
        isPublic: o.isPublic !== false,
        previewUrl:
          typeof o.previewUrl === "string" && o.previewUrl.trim()
            ? o.previewUrl.trim()
            : null,
        createdAt:
          o.createdAt != null ? String(o.createdAt) : null,
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Templates section content                                          */
/* ------------------------------------------------------------------ */

function TemplatesSection({
  templateVersions,
  canCreateTemplate,
  templateCreateState,
  newTemplatePublic,
  setNewTemplatePublic,
  onCreateTemplate,
  onClose,
}: {
  templateVersions: TemplateVersionRow[];
  canCreateTemplate: boolean;
  templateCreateState: "idle" | "creating" | "publish-poll";
  newTemplatePublic: boolean;
  setNewTemplatePublic: (v: boolean) => void;
  onCreateTemplate: () => void;
  onClose: () => void;
}) {
  const busy = templateCreateState !== "idle";
  const createLabel =
    templateCreateState === "creating"
      ? "Creating template…"
      : templateCreateState === "publish-poll"
        ? "Finishing publish…"
        : "Create a new template";

  return (
    <div>
      <h2 className="text-sm font-semibold text-white">Templates</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Each template has its own URL and preview. You can create multiple
        versions from this project; they are listed under Your templates in
        the workspace.
      </p>
      <p className="mt-3 rounded-md border border-[#2a2a2b] bg-[#0c0c0e]/80 px-2 py-1 text-[11px] leading-relaxed text-zinc-400">
        Creating a template will publish the project again if it has a site
        URL, so the template preview matches your latest deployment.
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={newTemplatePublic}
          onChange={(e) => setNewTemplatePublic(e.target.checked)}
          disabled={busy}
          className="rounded border-zinc-600 bg-[#0c0c0e] text-white focus:ring-zinc-500"
        />
        <span>List this template in the public gallery</span>
      </label>

      <div className="mt-5 space-y-2">
        <button
          type="button"
          disabled={!canCreateTemplate || busy}
          onClick={onCreateTemplate}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#3f3f46] bg-[#1c1c1f] px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-40"
          title={
            !canCreateTemplate ? "Add a project title first" : undefined
          }
        >
          {busy ? (
            <span
              className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white/90"
              aria-hidden
            />
          ) : null}
          {createLabel}
        </button>

        {templateVersions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onClose();
              window.location.href = "/workspace/your-templates";
            }}
            className="block w-full rounded-md border border-[#3f3f46] bg-[#1c1c1f] px-2 py-1 text-center text-xs font-medium text-zinc-100 hover:bg-[#27272a]"
          >
            View your templates
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
};

const ProjectWorkspaceOptionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const {
    title,
    about,
    siteMetaTitle,
    siteFaviconUrl,
    previewRuntime,
    templateVersions,
  } = useSelector((s: RootState) => ({
    title: s.projectOptions.title,
    about: s.projectOptions.about,
    siteMetaTitle: s.projectOptions.siteMetaTitle,
    siteFaviconUrl: s.projectOptions.siteFaviconUrl,
    previewRuntime: s.projectOptions.previewRuntime,
    templateVersions: s.projectOptions.templateVersions,
  }));

  const [mounted, setMounted] = useState(false);
  const [section, setSection] = useState<Section>("appearance");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAbout, setDraftAbout] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [templateCreateState, setTemplateCreateState] = useState<
    "idle" | "creating" | "publish-poll"
  >("idle");
  const [newTemplatePublic, setNewTemplatePublic] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle((title ?? "").trim() ? (title ?? "") : "");
    setDraftAbout(typeof about === "string" ? about : "");
  }, [isOpen, title, about, templateVersions]);

  const isWeb = previewRuntime === "web";
  const canCreateTemplate =
    isWeb && Boolean((draftTitle || title || "").trim());

  const handleSaveSettings = async () => {
    const em = email.value;
    if (typeof em !== "string" || !em.trim() || !projectId) return;
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
    setSettingsSaving(true);
    try {
      const res = await updateProject({
        projectId,
        action: "update-project-settings",
        email: em,
        title: nextTitle,
        about: draftAbout.trim() === "" ? null : draftAbout.trim(),
      });
      if (!res.success) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text:
              typeof res.message === "string"
                ? res.message
                : "Could not save project settings.",
          }),
        );
        return;
      }
      dispatch(
        patchProjectOptions({
          title: nextTitle,
          about: draftAbout.trim() === "" ? null : draftAbout.trim(),
        }),
      );
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: "Project settings saved.",
        }),
      );
    } catch {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Could not save project settings.",
        }),
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    const em = email.value;
    if (typeof em !== "string" || !em.trim() || !projectId) return;
    if (!canCreateTemplate) {
      const text = !isWeb
        ? "Templates are for web projects only."
        : "Add a project title before creating a template.";
      dispatch(
        setNotification({
          modalOpen: true,
          status: "info",
          text,
        }),
      );
      return;
    }
    setTemplateCreateState("creating");
    try {
      const res = await updateProject({
        projectId,
        action: "create-project-template",
        email: em,
        templateVersionIsPublic: newTemplatePublic,
      });
      if (!res.success) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text:
              typeof res.message === "string"
                ? res.message
                : "Could not create template.",
          }),
        );
        return;
      }
      const versions = normalizeTemplateVersions(res.templateVersions);
      dispatch(
        patchProjectOptions({
          templateVersions: versions,
          templateSlug: null,
          templateCategory: null,
        }),
      );
      const publishNote =
        res.publishQueued === true
          ? " A publish was queued so your live site matches this template."
          : "";
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: `Template version created.${publishNote}`,
        }),
      );

      if (res.publishQueued === true) {
        setTemplateCreateState("publish-poll");
        const maxTicks = 48;
        for (let i = 0; i < maxTicks; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const status = await fetchPublishStatus({ email: em, projectId });
          if (!status.success) break;
          const phase = status.phase;
          const du =
            typeof status.deployedUrl === "string"
              ? status.deployedUrl.trim()
              : "";
          const di =
            typeof status.deployedImage === "string"
              ? status.deployedImage.trim()
              : "";
          if (du || di) {
            dispatch(
              patchProjectOptions({
                deployedUrl: du || null,
                deployedImage: di || null,
              }),
            );
          }
          if (phase !== "queued" && phase !== "building") break;
        }
      }
    } catch {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Could not create template.",
        }),
      );
    } finally {
      setTemplateCreateState("idle");
    }
  };

  const modalTree = (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="workspace-opt-backdrop"
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
            key="workspace-opt-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Project options"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-[min(8vh,72px)] z-[121] flex h-[min(82vh,640px)] w-[min(96vw,760px)] -translate-x-1/2 overflow-hidden rounded-xl border border-[#2a2a2b] bg-[#141416]/95 shadow-2xl backdrop-blur-md"
            style={{
              WebkitBackdropFilter: "blur(12px)",
              backdropFilter: "blur(12px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav
              className="flex w-[min(38%,200px)] shrink-0 flex-col gap-0.5 border-r border-[#2a2a2b] bg-[#0c0c0e] p-2"
              aria-label="Options sections"
            >
              <button
                type="button"
                onClick={() => setSection("appearance")}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  section === "appearance"
                    ? "bg-[#27272a] text-white"
                    : "text-zinc-400 hover:bg-[#1f1f22] hover:text-white"
                }`}
              >
                Public site appearance
              </button>
              <button
                type="button"
                onClick={() => setSection("settings")}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  section === "settings"
                    ? "bg-[#27272a] text-white"
                    : "text-zinc-400 hover:bg-[#1f1f22] hover:text-white"
                }`}
              >
                Project settings
              </button>
              <button
                type="button"
                onClick={() => setSection("templates")}
                className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  section === "templates"
                    ? "bg-[#27272a] text-white"
                    : "text-zinc-400 hover:bg-[#1f1f22] hover:text-white"
                }`}
              >
                Templates
              </button>
            </nav>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
              {section === "appearance" && isWeb ? (
                <SiteDeployAppearancePanel
                  projectId={projectId}
                  remoteSiteMetaTitle={siteMetaTitle ?? null}
                  remoteSiteFaviconUrl={siteFaviconUrl ?? null}
                  onClose={onClose}
                />
              ) : null}

              {section === "appearance" && !isWeb ? (
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Public site appearance
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Site title and favicon apply to web projects only. Switch
                    this project to web to configure them.
                  </p>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-[#252525] hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}

              {section === "settings" ? (
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Project settings
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Title and description appear in your project list and on
                    template pages.
                  </p>

                  <label className="mt-5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Title
                  </label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    maxLength={200}
                    className="mt-1.5 w-full rounded-lg border border-[#2a2a2b] bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    placeholder="Project title"
                  />

                  <label className="mt-4 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    About
                  </label>
                  <textarea
                    value={draftAbout}
                    onChange={(e) => setDraftAbout(e.target.value)}
                    rows={5}
                    maxLength={12000}
                    className="mt-1.5 w-full resize-y rounded-lg border border-[#2a2a2b] bg-[#0c0c0e] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                    placeholder="Short description for templates and your reference"
                  />

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
                      disabled={settingsSaving}
                      onClick={() => void handleSaveSettings()}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {settingsSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : null}

              {section === "templates" && isWeb ? (
                <TemplatesSection
                  templateVersions={templateVersions}
                  canCreateTemplate={canCreateTemplate}
                  templateCreateState={templateCreateState}
                  newTemplatePublic={newTemplatePublic}
                  setNewTemplatePublic={setNewTemplatePublic}
                  onCreateTemplate={() => void handleCreateTemplate()}
                  onClose={onClose}
                />
              ) : null}

              {section === "templates" && !isWeb ? (
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Templates
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Templates are available for web projects only. Switch this
                    project to web to create templates.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalTree, document.body);
};

export default ProjectWorkspaceOptionsModal;
