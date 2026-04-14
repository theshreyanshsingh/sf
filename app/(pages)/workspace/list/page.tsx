"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CgOptions } from "react-icons/cg";
import ProjectOptionsModal from "../../_modals/ProjectOptionsModal";
import {
  LuExternalLink,
  LuLoader,
  LuMonitor,
  LuSmartphone,
} from "react-icons/lu";
import { IoAddOutline } from "react-icons/io5";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useProjectsData } from "@/app/helpers/useProjectsData";
import moment from "moment";

import type { Project } from "@/app/redux/reducers/basicData";

/** Same URL rules as `ProjectsSidebar` “Visit”. */
function normalizeDeployedUrl(url?: string | null): string | null {
  const u = url?.trim();
  if (!u) return null;
  return u.startsWith("http") ? u : `https://${u}`;
}

/** Desktop viewport; scaled down to fit the tile (zoomed-out preview). */
const PREVIEW_W = 1280;
const PREVIEW_H = 800;

function ProjectPreviewBlock({
  title,
  deployedUrl,
}: {
  title: string;
  deployedUrl?: string | null;
}) {
  const href = normalizeDeployedUrl(deployedUrl);
  const previewSrc = href ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({
    scale: 0.2,
    left: 0,
    top: 0,
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !href) return;

    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw < 2 || ch < 2) return;
      const scale = Math.min(cw / PREVIEW_W, ch / PREVIEW_H);
      const w = PREVIEW_W * scale;
      const h = PREVIEW_H * scale;
      setLayout({
        scale,
        left: (cw - w) / 2,
        top: (ch - h) / 2,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [href]);

  return (
    <div className="relative w-full overflow-hidden rounded-md bg-[#0d0f14] ring-1 ring-white/[0.07]">
      <div
        ref={containerRef}
        className="relative aspect-square w-full overflow-hidden bg-[#0a0b0f]"
      >
        {previewSrc && href ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-1.5">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold tracking-wide text-white shadow-sm backdrop-blur-md ring-1 ring-white/15 transition-colors hover:bg-black/75"
                onClick={(e) => e.stopPropagation()}
              >
                Visit
                <LuExternalLink className="h-3 w-3 opacity-90" aria-hidden />
              </a>
            </div>
            <div
              className="pointer-events-none absolute overflow-hidden"
              style={{
                left: layout.left,
                top: layout.top,
                width: PREVIEW_W * layout.scale,
                height: PREVIEW_H * layout.scale,
              }}
            >
              <div
                className="pointer-events-none"
                style={{
                  width: PREVIEW_W,
                  height: PREVIEW_H,
                  transform: `scale(${layout.scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  title={`Preview of ${title}`}
                  width={PREVIEW_W}
                  height={PREVIEW_H}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="block border-0 bg-white"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] font-medium leading-snug text-white/38">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpenOptions,
  onOpenProject,
}: {
  project: Project;
  onOpenOptions: (e: React.MouseEvent) => void;
  onOpenProject: () => void;
}) {
  const isMobile = project.previewRuntime === "mobile";
  const RuntimeIcon = isMobile ? LuSmartphone : LuMonitor;

  return (
    <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-white/[0.09] bg-[#1c1f28] text-ellipsis shadow-sm shadow-black/20">
      <ProjectPreviewBlock
        title={project.title}
        deployedUrl={project.deployed_url}
      />

      <div className="flex min-w-0 flex-col gap-2.5 px-3 pt-3 pb-2">
        <div className="flex w-full min-w-0 flex-row items-center gap-2">
          <h3
            className="min-w-0 flex-1 basis-0 truncate text-left text-xs font-medium text-white"
            dir="ltr"
            title={project.title}
          >
            {project.title}
          </h3>
          <span
            className="h-4 w-px shrink-0 rounded-full bg-white/22"
            aria-hidden
          />
          <RuntimeIcon
            className="h-3.5 w-3.5 shrink-0 text-white/55"
            aria-hidden
          />
        </div>

        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#9b9ba3]">
            {project.isPublic ? "Public" : "Private"}
          </span>
          <span className="shrink-0 text-xs font-medium text-[#9b9ba3]">
            Modified {moment(project.updatedAt).fromNow()}
          </span>
        </div>
      </div>

      <div className="flex w-full items-center justify-between border-t border-white/[0.07] px-2 py-2.5">
        <button
          type="button"
          onClick={onOpenProject}
          className="flex cursor-pointer items-center justify-center rounded-md px-2 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-white/[0.06]"
        >
          Open Project
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md p-[2px] text-white/85 transition-colors hover:bg-white/[0.06]"
          onClick={onOpenOptions}
          aria-label="Project options"
        >
          <CgOptions />
        </button>
      </div>
    </div>
  );
}

/** Pinned first, then unpinned — max `visibleCount` cards shown; then Load more. */
const PAGE_SIZE = 16;

const loadMoreButtonClass =
  "rounded-full border border-white/20 bg-transparent px-2 py-1 text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.06] hover:text-white";

const Page = () => {
  const { email } = useAuthenticated();
  const { projects, loading } = useProjectsData(email.value);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredProjects =
    projects?.filter((project) => {
      if (!searchQuery) return true;
      return project.title.toLowerCase().includes(searchQuery.toLowerCase());
    }) || [];

  const pinnedProjects =
    filteredProjects?.filter((project) => project.isPinned) || [];
  const unpinnedProjects =
    filteredProjects?.filter((project) => !project.isPinned) || [];

  const orderedProjects = useMemo(
    () => [...pinnedProjects, ...unpinnedProjects],
    [pinnedProjects, unpinnedProjects],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  const visibleSlice = orderedProjects.slice(0, visibleCount);
  const visiblePinnedProjects = visibleSlice.filter((p) => p.isPinned);
  const visibleUnpinnedProjects = visibleSlice.filter((p) => !p.isPinned);
  const hasMore = orderedProjects.length > visibleCount;

  const router = useRouter();

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    index: string;
    position: { top: number; left: number };
  }>({ isOpen: false, index: "", position: { top: 0, left: 0 } });

  const handleOptionsClick = (index: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setModalState({
      isOpen: true,
      index,
      position: { top: rect.bottom + 5, left: rect.left },
    });
  };

  const handleOpenProject = async (project: Project) => {
    if (window) window.location.href = `/projects/${project.generatedName}`;
  };

  const gridClass =
    "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="flex min-h-[50vh] w-full min-w-0 flex-col text-xs">
      <div className="mb-4">
        <h1 className="font-sans text-xs font-semibold text-white">
          Projects
        </h1>
        <p className="mt-1 text-xs text-[#b4b4bc]">
          Open, search, and manage your workspaces.
        </p>
      </div>

      <div className="border-b border-white/[0.08] py-2">
        <div className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 backdrop-blur-sm">
          <input
            disabled={loading !== "success"}
            className="w-full rounded-md bg-transparent py-1 pl-1 font-sans text-xs font-medium text-white placeholder:text-[#8b8b93] focus:outline-none"
            placeholder="Search projects…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading !== "success" ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex flex-1 items-center justify-center overflow-y-auto py-16"
        >
          <LuLoader className="animate-spin text-lg text-white" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex-1 overflow-y-auto pt-6"
        >
          {!projects?.length ? (
            <div className="flex h-full min-h-[40vh] flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  router.push("/");
                }}
                className="flex cursor-pointer items-center justify-center gap-x-1 rounded-md border border-white/[0.12] bg-white/[0.04] px-2 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-white/[0.08]"
              >
                <IoAddOutline className="text-lg" />
                Create New Project
              </button>
            </div>
          ) : (
            <>
              {pinnedProjects?.length > 0 && (
                <div className="border-b border-white/[0.07] pb-8">
                  <h2 className="mb-4 text-xs font-semibold text-white/90">
                    Pinned Projects
                  </h2>
                  <div className={gridClass}>
                    {visiblePinnedProjects.map((project, index) => (
                      <ProjectCard
                        key={project.generatedName ?? index}
                        project={project}
                        onOpenProject={() => handleOpenProject(project)}
                        onOpenOptions={(e) =>
                          handleOptionsClick(project.generatedName, e)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {visibleUnpinnedProjects.length > 0 && (
                <div
                  className={
                    visiblePinnedProjects.length > 0 ? "pt-8" : "pt-0"
                  }
                >
                  <div className={gridClass}>
                    {visibleUnpinnedProjects.map((project, index) => (
                      <ProjectCard
                        key={project.generatedName ?? index}
                        project={project}
                        onOpenProject={() => handleOpenProject(project)}
                        onOpenOptions={(e) =>
                          handleOptionsClick(project.generatedName, e)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {hasMore ? (
                <div className="mt-8 flex justify-center pb-6">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((c) =>
                        Math.min(c + PAGE_SIZE, orderedProjects.length),
                      )
                    }
                    className={loadMoreButtonClass}
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <ProjectOptionsModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          position={modalState.position}
          name={
            projects.find(
              (project) => project.generatedName === modalState.index,
            )?.title ?? ""
          }
          isPublic={
            projects.find(
              (project) => project.generatedName === modalState.index,
            )?.isPublic ?? false
          }
          projectId={modalState.index}
        />
      </AnimatePresence>
    </div>
  );
};

export default Page;
