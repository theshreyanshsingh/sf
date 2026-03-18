// Stream parsing for Claude models
"use client";

import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion, Variants } from "framer-motion";
import { useDispatch } from "react-redux";
import { useParams } from "next/navigation";

import { setReaderMode } from "@/app/redux/reducers/projectOptions";

// Import separated components (NO parsing functions - all moved to worker)
import {
  ProcessedResult,
  ProcessedJson,
  EmptyState,
  RawUnexpectedDisplay,
  StatusIndicator,
  StepsSection,
  GeneratedFilesSection,
  FilesListSection,
  streamStorage,
} from "./comps";
import { useProjectWorker } from "./comps/useProjectWorker";
import { useWorkerDataSync } from "./comps/useWorkerDataSync";

// --- Main Component ---
const StreamedProgressiveDisplay: React.FC = () => {
  const dispatch = useDispatch();
  const params = useParams();
  const projectId = (params?.project as string) || "default";

  // PERFORMANCE OPTIMIZATION: Pure worker-based processing (NO main thread parsing)
  const {
    processedContent: workerProcessedContent,
    isProcessing,
    refreshData,
  } = useProjectWorker();

  const handleRead = useCallback(() => {
    dispatch(setReaderMode(false));
  }, [dispatch]);

  // Auto-sync worker data to catch updates from useSendRequest
  useWorkerDataSync({
    refreshData,
    isProcessing,
    enabled: true,
    syncInterval: 1000, // Reduced frequency for better concurrent performance
  });

  // Pure display component - NO parsing, just use worker data or empty state
  const processedContent: ProcessedResult = useMemo(() => {
    // Primary: Use worker-processed data (all parsing done in worker)
    if (workerProcessedContent) {
      return workerProcessedContent;
    }

    // Fallback: Empty state only (NO main thread parsing)
    return { status: "empty", raw: "" };
  }, [workerProcessedContent]);

  // --- State & Toggle ---
  const [openCodeBlocks, setOpenCodeBlocks] = useState<Set<string>>(new Set());

  const toggleCodeBlock = useCallback((id: string, isComplete: boolean) => {
    if (isComplete) {
      setOpenCodeBlocks((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          // Limit open code blocks to prevent memory issues
          if (next.size >= 10) {
            const firstItem = next.values().next().value || "";
            next.delete(firstItem);
          }
          next.add(id);
        }
        return next;
      });
    }
  }, []);

  // PERFORMANCE OPTIMIZATION: Enhanced auto-scroll with intersection observer
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const isAutoScrolling = useRef(true);

  const clearStorage = useCallback(async () => {
    try {
      await streamStorage.clear(projectId);
    } catch (error) {
      console.warn(`Failed to clear storage for project ${projectId}:`, error);
    }
  }, [projectId]);

  // Cleanup on component unmount (navigation away)
  useEffect(() => {
    return () => {
      clearStorage();
    };
  }, [clearStorage]);

  useEffect(() => {
    if (!isAutoScrolling.current) return;

    const now = Date.now();
    // Throttle auto-scroll more aggressively for large streams
    if (now - lastScrollTime.current > 300) {
      const container = scrollContainerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          const isNearBottom =
            container.scrollTop + container.clientHeight >=
            container.scrollHeight - 100;
          if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
          }
        });
        lastScrollTime.current = now;
      }
    }
    return () => {
      clearStorage();
    };
  }, [processedContent, clearStorage]);

  // Detect manual scrolling to pause auto-scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const isNearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 100;
      isAutoScrolling.current = isNearBottom;
    }
  }, []);

  // --- Animation Variants (optimized) ---
  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.2, staggerChildren: 0.05 }, // Reduced for better performance
    },
  };

  const itemEnterVariant: Variants = {
    initial: { opacity: 0, y: 5 }, // Reduced movement for better performance
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 200, damping: 20 }, // Faster spring
    },
  };

  const codeRevealVariant: Variants = {
    collapsed: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }, // Faster transition
    },
    open: {
      opacity: 1,
      height: "auto",
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
  };

  // --- Render Logic ---

  if (processedContent.status === "empty") {
    return <EmptyState />;
  }

  if (processedContent.status === "raw_unexpected") {
    return (
      <RawUnexpectedDisplay
        processedContent={processedContent}
        containerVariants={containerVariants}
      />
    );
  }

  // --- Render JSON Stream ---
  const jsonProcessedContent = processedContent as ProcessedJson;

  return (
    <motion.div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="container mx-auto p-4 text-white overflow-y-auto max-h-[calc(100vh-100px)] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      {/* <StatusIndicator
        processedContent={jsonProcessedContent}
        onRead={handleRead}
      /> */}
      {/* 
      <StepsSection
        processedContent={jsonProcessedContent}
        itemEnterVariant={itemEnterVariant}
      /> */}

      <GeneratedFilesSection
        processedContent={jsonProcessedContent}
        openCodeBlocks={openCodeBlocks}
        onToggleCodeBlock={toggleCodeBlock}
        itemEnterVariant={itemEnterVariant}
        codeRevealVariant={codeRevealVariant}
      />

      {/* <FilesListSection
        processedContent={jsonProcessedContent}
        itemEnterVariant={itemEnterVariant}
      /> */}

      {/* <PerformanceIndicator rawLength={processedContent.raw.length} /> */}
    </motion.div>
  );
};

export default StreamedProgressiveDisplay;
