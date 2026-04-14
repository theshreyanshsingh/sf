"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SiteDeployAppearancePanel } from "./SiteDeployAppearancePanel";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  remoteSiteMetaTitle?: string | null;
  remoteSiteFaviconUrl?: string | null;
  suppressReduxSync?: boolean;
};

const SiteDeployOptionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  remoteSiteMetaTitle,
  remoteSiteFaviconUrl,
  suppressReduxSync,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
            <SiteDeployAppearancePanel
              projectId={projectId}
              remoteSiteMetaTitle={remoteSiteMetaTitle}
              remoteSiteFaviconUrl={remoteSiteFaviconUrl}
              suppressReduxSync={suppressReduxSync}
              onClose={onClose}
            />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modalTree, document.body);
};

export default SiteDeployOptionsModal;
