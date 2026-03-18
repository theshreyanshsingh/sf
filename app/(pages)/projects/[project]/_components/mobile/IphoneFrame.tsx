"use client";

import React from "react";

type IphoneFrameProps = {
  iframeSrc?: string;
  iframeTitle?: string;
  iframeRef?: (iframe: HTMLIFrameElement | null) => void;
  iframeOnLoad?: React.ReactEventHandler<HTMLIFrameElement>;
  iframeOnError?: React.ReactEventHandler<HTMLIFrameElement>;
  className?: string;
};

export const IphoneFrame = ({
  iframeSrc,
  iframeTitle = "Mobile preview",
  iframeRef,
  iframeOnLoad,
  iframeOnError,
  className = "",
}: IphoneFrameProps) => {
  return (
    <div
      className={`mx-auto flex h-full w-full items-center justify-center ${className}`}
    >
      <div className="relative mx-auto h-full max-h-full w-auto max-w-full aspect-[9/19.5] rounded-[2.2rem] border border-[#232329] bg-[#07070a] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute left-1/2 top-2 h-5 w-28 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="h-full overflow-hidden rounded-[1.8rem] border border-[#1f1f24] bg-black">
          <iframe
            ref={(node) => {
              if (node) {
                node.setAttribute("credentialless", "");
              }
              iframeRef?.(node);
            }}
            title={iframeTitle}
            src={iframeSrc}
            onLoad={iframeOnLoad}
            onError={iframeOnError}
            className="h-full w-full border-0 bg-black"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            allow="screen-wake-lock; clipboard-read; clipboard-write"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
};

export default IphoneFrame;
