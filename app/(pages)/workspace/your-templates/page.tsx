"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CgOptions } from "react-icons/cg";
import { LuLoader, LuMonitor } from "react-icons/lu";

import {
  fetchMyTemplates,
  forkProjectFromTemplateSlug,
} from "@/app/_services/templatesApi";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { useDispatch } from "react-redux";
import DeleteConfirmationModal from "../../_modals/DeleteConfirmationModal";
import TemplateAboutUrlModal from "../../_modals/TemplateAboutUrlModal";

type Row = Awaited<ReturnType<typeof fetchMyTemplates>>[number];

function normalizeDeployedUrl(url?: string | null): string | null {
  const u = url?.trim();
  if (!u) return null;
  return u.startsWith("http") ? u : `https://${u}`;
}

const PREVIEW_W = 1280;
const PREVIEW_H = 800;

function TemplatePreviewBlock({
  title,
  previewUrl,
}: {
  title: string;
  previewUrl?: string | null;
}) {
  const href = normalizeDeployedUrl(previewUrl);
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

const PAGE_SIZE = 16;

function TemplateCard({
  row,
  busy,
  onUseTemplate,
  onOpenOptions,
}: {
  row: Row;
  busy: boolean;
  onUseTemplate: () => void;
  onOpenOptions: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-white/[0.09] bg-[#1c1f28] text-ellipsis shadow-sm shadow-black/20">
      <TemplatePreviewBlock title={row.title} previewUrl={row.previewUrl} />

      <div className="flex min-w-0 flex-col px-3 pt-3 pb-2">
        <div className="flex w-full min-w-0 flex-row items-center gap-2">
          <h3
            className="min-w-0 flex-1 basis-0 truncate text-left text-xs font-medium text-white"
            dir="ltr"
            title={row.title}
          >
            {row.title}
          </h3>
          <span
            className="h-4 w-px shrink-0 rounded-full bg-white/22"
            aria-hidden
          />
          <LuMonitor
            className="h-3.5 w-3.5 shrink-0 text-white/55"
            aria-hidden
          />
        </div>
      </div>

      <div className="flex w-full items-center justify-between border-t border-white/[0.07] px-2 py-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={onUseTemplate}
          className="flex cursor-pointer items-center justify-center rounded-md px-2 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          {busy ? "…" : "Use template"}
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md p-[2px] text-white/85 transition-colors hover:bg-white/[0.06]"
          onClick={onOpenOptions}
          aria-label="Template options"
        >
          <CgOptions />
        </button>
      </div>
    </div>
  );
}

export default function YourTemplatesPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { data } = useSession();
  const email =
    data?.user?.email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");
  const [rows, setRows] = useState<Row[]>([]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [detailsEditTarget, setDetailsEditTarget] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [menu, setMenu] = useState<{
    open: boolean;
    slug: string;
    position: { top: number; left: number };
  }>({ open: false, slug: "", position: { top: 0, left: 0 } });

  const load = useCallback(() => {
    if (!email.trim()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchMyTemplates(email).then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [email]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => {
      const inTitle = t.title.toLowerCase().includes(q);
      const inSlug = t.slug.toLowerCase().includes(q);
      const inAbout =
        typeof t.about === "string" && t.about.toLowerCase().includes(q);
      return inTitle || inSlug || inAbout;
    });
  }, [rows, searchQuery]);

  const visibleSlice = filteredRows.slice(0, visibleCount);
  const hasMore = filteredRows.length > visibleCount;

  const closeMenu = () => setMenu((m) => ({ ...m, open: false }));

  const onUseTemplate = async (t: Row) => {
    if (!email.trim()) return;
    setBusySlug(t.slug);
    try {
      const res = await forkProjectFromTemplateSlug({
        email,
        templateSlug: t.slug,
      });
      if (res.ok) {
        window.location.href = `/projects/${res.projectId}`;
        return;
      }
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: res.message,
        }),
      );
    } finally {
      setBusySlug(null);
    }
  };

  const handleOptionsClick = (slug: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      open: true,
      slug,
      position: { top: rect.bottom + 5, left: rect.left },
    });
  };

  const menuRow = rows.find((r) => r.slug === menu.slug);

  const gridClass =
    "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="flex min-h-[50vh] w-full min-w-0 flex-col text-xs">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-sans text-xs font-semibold text-white">
            Templates from your projects
          </h1>
          <p className="mt-1 text-xs text-[#b4b4bc]">
            Start a build from a template you published, or open the menu on a
            card to update the URL or remove it.
          </p>
        </div>
        <Link
          href="/templates"
          className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-white/[0.08] sm:py-1.5"
        >
          Browse more templates
        </Link>
      </div>

      <div className="border-b border-white/[0.08] py-2">
        <div className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 backdrop-blur-sm">
          <input
            disabled={loading}
            className="w-full rounded-md bg-transparent py-1 pl-1 font-sans text-xs font-medium text-white placeholder:text-[#8b8b93] focus:outline-none"
            placeholder="Search templates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 items-center justify-center overflow-y-auto py-16"
        >
          <LuLoader className="animate-spin text-lg text-white" />
        </motion.div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
          <p className="max-w-sm text-center text-xs text-[#a1a1aa]">
            No templates yet. Open a web project, then create a template from{" "}
            <span className="text-white/80">Options → Templates</span>.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 overflow-y-auto pt-6"
        >
          {filteredRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#9b9ba3]">
              No templates match your search.
            </p>
          ) : (
            <>
              <div className={gridClass}>
                {visibleSlice.map((t) => {
                  const busy = busySlug === t.slug;
                  return (
                    <TemplateCard
                      key={`${t.generatedName}-${t.slug}`}
                      row={t}
                      busy={busy}
                      onUseTemplate={() => void onUseTemplate(t)}
                      onOpenOptions={(e) => handleOptionsClick(t.slug, e)}
                    />
                  );
                })}
              </div>
              {hasMore ? (
                <div className="mt-8 flex justify-center pb-6">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((c) =>
                        Math.min(c + PAGE_SIZE, filteredRows.length),
                      )
                    }
                    className="rounded-full border border-white/20 bg-transparent px-2 py-1 text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {menu.open && menuRow ? (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={closeMenu}
            />
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="fixed z-50 max-h-[min(70vh,calc(100dvh-4rem))] w-[min(calc(100vw-2rem),260px)] overflow-y-auto rounded-md bg-[#121212] py-1 shadow-lg ring-1 ring-white/10"
              style={{
                top: menu.position.top,
                left: Math.max(
                  8,
                  Math.min(
                    menu.position.left,
                    typeof window !== "undefined"
                      ? window.innerWidth - 268
                      : menu.position.left,
                  ),
                ),
              }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white transition-colors hover:bg-[#2A2A2A]"
                onClick={() => {
                  setDetailsEditTarget(menuRow);
                  closeMenu();
                }}
              >
                Edit template details
              </button>
              <button
                type="button"
                disabled={busySlug === menuRow.slug}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-[#2A2A2A] disabled:opacity-50"
                onClick={() => {
                  setDeleteTarget(menuRow);
                  closeMenu();
                }}
              >
                Delete
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        projectId={deleteTarget?.generatedName ?? ""}
        mode="templateVersion"
        templateVersionSlug={deleteTarget?.slug}
        onDeleted={() => {
          load();
          setDeleteTarget(null);
        }}
      />
      <TemplateAboutUrlModal
        isOpen={detailsEditTarget != null}
        onClose={() => setDetailsEditTarget(null)}
        projectId={detailsEditTarget?.generatedName ?? ""}
        title={detailsEditTarget?.title ?? ""}
        currentSlug={detailsEditTarget?.slug ?? ""}
        about={detailsEditTarget?.about ?? null}
        isPublic={detailsEditTarget?.isPublic !== false}
        onSaved={() => {
          load();
        }}
      />
    </div>
  );
}
