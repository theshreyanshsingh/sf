"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import { FaFilePdf, FaCode } from "react-icons/fa6";
import { createPortal } from "react-dom";

export type AttachmentType = {
  file: File;
  preview: string;
  type: "image" | "video" | "pdf" | "code" | "reference";
  isUploading?: boolean;
  fileType: string;
  previewUrl?: string;
  url: string;
  name: string;
  id: string;
};

type AttachmentPreviewProps = {
  attachments: AttachmentType[];
  onRemove: (index: number) => void;
};

const AttachmentPreview = ({
  attachments,
  onRemove,
}: AttachmentPreviewProps) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc, closeLightbox]);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mb-2 flex w-full flex-wrap gap-2">
        <AnimatePresence>
          {attachments.map((attachment, index) => (
            <motion.div
              key={index}
              className="group relative h-auto w-full max-w-[36px] overflow-visible rounded-[10px]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              {attachment.type === "image" && (
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[10px] border border-[#3f3f46] bg-[#27272a] shadow-sm">
                  <button
                    type="button"
                    disabled={attachment.isUploading}
                    onClick={() => {
                      if (!attachment.isUploading) {
                        setLightboxSrc(attachment.preview);
                      }
                    }}
                    className="relative block h-full w-full cursor-zoom-in disabled:cursor-wait"
                    title="View image"
                  >
                    {/* Native img: blob URLs from file picker are unreliable with next/image fill */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.preview}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>

                  {attachment.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#151515]/60">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-white shadow-md ring-1 ring-white/10 transition hover:bg-red-900/90"
                    title="Remove attachment"
                  >
                    <IoClose size={12} />
                  </button>
                </div>
              )}

              {attachment.type === "video" && (
                <div className="relative h-[180px] w-full overflow-hidden rounded-md bg-[#151515]">
                  <video
                    src={attachment.preview}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-sm font-medium text-white">
                      View Full
                    </span>
                  </div>
                  {attachment.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#151515]/60">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white"
                  >
                    <IoClose size={14} />
                  </button>
                </div>
              )}

              {attachment.type === "pdf" && (
                <div className="relative flex h-[180px] w-full flex-col items-center justify-center overflow-hidden rounded-md bg-[#1D1E22]">
                  <FaFilePdf className="text-3xl text-white" />
                  <span className="mt-2 font-sans text-sm font-medium text-white">
                    PDF
                  </span>
                  {attachment.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#151515]/60">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white"
                  >
                    <IoClose size={14} />
                  </button>
                </div>
              )}

              {attachment.type === "code" && (
                <div
                  className="relative flex h-[60px] w-full flex-row gap-2 overflow-hidden rounded-md border border-[#2a2a2b] bg-[#1D1E22] p-2"
                  title={attachment.name}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#2a2a2b]">
                    <FaCode className="text-sm text-[#4a90e2]" />
                  </div>
                  <div className="flex min-w-0 flex-col overflow-hidden">
                    <span className="truncate font-sans text-[10px] font-medium text-white">
                      {attachment.name.split("/").pop()}
                    </span>
                    <span className="truncate font-mono text-[9px] text-[#71717A]">
                      {attachment.preview.slice(0, 50).replace(/\n/g, " ")}...
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white"
                  >
                    <IoClose size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {lightboxSrc && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              className="fixed inset-0 z-[600] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              onClick={closeLightbox}
            >
              <div
                className="relative max-h-[min(90vh,900px)] max-w-[min(96vw,1200px)]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="absolute -right-1 -top-10 z-10 rounded-md p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white md:-right-3 md:-top-3 md:bg-black/50"
                  title="Close"
                >
                  <IoClose size={22} />
                </button>
                <div className="max-h-[min(90vh,900px)] max-w-[min(96vw,1200px)] overflow-hidden rounded-lg border border-zinc-700/80 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxSrc}
                    alt="Attachment preview"
                    className="max-h-[min(90vh,900px)] w-full object-contain"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default AttachmentPreview;
