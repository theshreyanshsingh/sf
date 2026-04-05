"use client";

import React, { useCallback, useEffect, useState } from "react";

import {
  SB_COMPOSER_PREFILL,
  SB_PREVIEW_RUNTIME_ERROR,
  buildTryFixPrompt,
  type PreviewRuntimeErrorDetail,
} from "@/app/helpers/previewRuntimeErrorEvents";

type Props = {
  /** Only show for web WebContainer preview flows */
  enabled: boolean;
};

/**
 * Bottom overlay on the preview pane: shows forwarded WebContainer / iframe errors
 * with Try fixing (one click: sends agent fix request) and Hide.
 */
const PreviewRuntimeErrorBar = ({ enabled }: Props) => {
  const [detail, setDetail] = useState<PreviewRuntimeErrorDetail | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onError = (ev: Event) => {
      const e = ev as CustomEvent<PreviewRuntimeErrorDetail>;
      if (!e.detail?.body) return;
      setDetail(e.detail);
      setOpen(true);
    };
    window.addEventListener(SB_PREVIEW_RUNTIME_ERROR, onError);
    return () => window.removeEventListener(SB_PREVIEW_RUNTIME_ERROR, onError);
  }, [enabled]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const tryFix = useCallback(() => {
    if (!detail) return;
    const text = buildTryFixPrompt(detail);
    window.dispatchEvent(
      new CustomEvent(SB_COMPOSER_PREFILL, {
        detail: { text, autoSubmit: true },
      }),
    );
    setOpen(false);
  }, [detail]);

  if (!enabled || !open || !detail) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-3">
      <div
        className="pointer-events-auto max-h-[40vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[#2a2a2b] bg-[#111116]/95 shadow-2xl backdrop-blur-xl"
        role="alert"
      >
        <div className="border-b border-[#2a2a2b] px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E06C75]">
            Preview error
          </span>
          <span className="truncate text-[10px] text-[#7d7d84]">{detail.title}</span>
        </div>
        <div className="max-h-[min(28vh,200px)] overflow-y-auto px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#d5d7df]">
            {detail.body}
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2a2a2b] px-3 py-2">
          <button
            type="button"
            onClick={hide}
            className="rounded-lg border border-[#2a2a2b] bg-[#1a1a1d] px-3 py-1.5 text-xs font-medium text-[#c5c5cb] transition-colors hover:border-[#3d3d44] hover:text-white"
          >
            Hide
          </button>
          <button
            type="button"
            onClick={tryFix}
            className="rounded-lg border border-[#4a90e2]/50 bg-[#4a90e2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#5ba0f2]"
          >
            Try fixing
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewRuntimeErrorBar;
