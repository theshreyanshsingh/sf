"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { LuLoader } from "react-icons/lu";
import CodeBlock from "./CodeBlock";
import { useProgressiveLoading } from "./useProgressiveLoading";
import { streamStorage } from "./streamStorage";

interface CodeBlockPath {
  filePath: string;
  id: string;
}

interface CompleteCodeBlock {
  filePath: string;
  codeContent: string;
  id: string;
}

interface ProgressiveCodeBlockListProps {
  potentialCodeBlockPaths: CodeBlockPath[];
  identifiedCompleteCodeBlocks: CompleteCodeBlock[];
  openCodeBlocks: Set<string>;
  onToggleCodeBlock: (id: string, isComplete: boolean) => void;
  itemEnterVariant: Variants;
  codeRevealVariant: Variants;
  isStreaming: boolean;
  projectId: string; // Add projectId prop
}

const ProgressiveCodeBlockList: React.FC<ProgressiveCodeBlockListProps> = ({
  potentialCodeBlockPaths,
  identifiedCompleteCodeBlocks,
  openCodeBlocks,
  onToggleCodeBlock,
  itemEnterVariant,
  codeRevealVariant,
  isStreaming,
  projectId, // Add projectId prop
}) => {
  const [cachedData, setCachedData] = useState<{
    potentialPaths: CodeBlockPath[];
    completeBlocks: CompleteCodeBlock[];
  } | null>(null);

  // Initialize IndexedDB and try to load cached data
  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await streamStorage.init(projectId);

        // Try to load cached data if available
        const totalCached = await streamStorage.getTotalCount(projectId);
        if (totalCached > 0) {
          const chunks = await streamStorage.getChunks(projectId, 0, 200);

          // Deduplicate by filePath
          const uniqueChunks = new Map<string, (typeof chunks)[0]>();
          chunks.forEach((chunk) => {
            const existing = uniqueChunks.get(chunk.filePath);
            if (
              !existing ||
              (chunk.isComplete && !existing.isComplete) ||
              (chunk.isComplete === existing.isComplete &&
                chunk.timestamp > existing.timestamp)
            ) {
              uniqueChunks.set(chunk.filePath, chunk);
            }
          });

          const potentialPaths = Array.from(uniqueChunks.values()).map(
            (chunk) => ({
              filePath: chunk.filePath,
              id: chunk.id,
            })
          );

          const completeBlocks = Array.from(uniqueChunks.values())
            .filter((chunk) => chunk.isComplete && chunk.codeContent)
            .map((chunk) => ({
              filePath: chunk.filePath,
              codeContent: chunk.codeContent!,
              id: chunk.id,
            }));

          setCachedData({ potentialPaths, completeBlocks });
        }
      } catch (error) {
        console.error("Failed to initialize storage:", error);
      }
    };

    initializeStorage();
  }, [projectId]);

  // Use cached data if available and more recent, otherwise use props
  const displayData = React.useMemo(() => {
    if (
      cachedData &&
      cachedData.potentialPaths.length >= potentialCodeBlockPaths.length
    ) {
      return {
        potentialCodeBlockPaths: cachedData.potentialPaths,
        identifiedCompleteCodeBlocks: cachedData.completeBlocks,
      };
    }

    return {
      potentialCodeBlockPaths,
      identifiedCompleteCodeBlocks,
    };
  }, [cachedData, potentialCodeBlockPaths, identifiedCompleteCodeBlocks]);

  const { visibleCount, isLoading, progress } = useProgressiveLoading({
    totalItems: displayData.potentialCodeBlockPaths.length,
    batchSize: 3, // Load 3 code blocks at a time
    delay: 150,
    autoStart: true,
  });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const progressBarVariants: Variants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: progress / 100,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  if (displayData.potentialCodeBlockPaths.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-8"
      >
        <div className="w-12 h-12 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center mx-auto mb-3">
          <LuLoader className="w-6 h-6 text-white animate-spin" />
        </div>
        <p className="text-sm text-[#b1b1b1] font-sans">
          Searching file contents...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Progress indicator */}
      {visibleCount < displayData.potentialCodeBlockPaths.length && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-[#1c1c1d] border border-[#2a2a2b] rounded-lg px-2 py-1"
        >
          <div className="flex items-center justify-between text-sm text-[#b1b1b1] mb-3">
            <div className="flex items-center gap-2">
              <LuLoader className="w-4 h-4 animate-spin text-[#4a90e2]" />
              <span className="font-sans">Loading some more code...</span>
            </div>
            <span className="font-sans font-medium">
              {visibleCount} / {displayData.potentialCodeBlockPaths.length}
            </span>
          </div>
          <div className="w-full bg-[#272628] rounded-full h-2 overflow-hidden">
            <motion.div
              variants={progressBarVariants}
              className="h-full bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] origin-left rounded-full"
            />
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {displayData.potentialCodeBlockPaths
          .slice(0, visibleCount)
          .map((potentialBlock, index: number) => {
            const isComplete: boolean =
              displayData.identifiedCompleteCodeBlocks.some(
                (cb) => cb.id === potentialBlock.id
              );
            const completedBlockData: CompleteCodeBlock | null = isComplete
              ? displayData.identifiedCompleteCodeBlocks.find(
                  (cb) => cb.id === potentialBlock.id
                ) || null
              : null;
            const isOpen: boolean = openCodeBlocks.has(potentialBlock.id);

            return (
              <motion.div
                key={potentialBlock.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: index * 0.05, // Stagger animation
                  },
                }}
                exit={{
                  opacity: 0,
                  y: -20,
                  scale: 0.95,
                  transition: { duration: 0.2 },
                }}
              >
                <CodeBlock
                  potentialBlock={potentialBlock}
                  isComplete={isComplete}
                  completedBlockData={completedBlockData}
                  isOpen={isOpen}
                  onToggle={onToggleCodeBlock}
                  codeRevealVariant={codeRevealVariant}
                  itemEnterVariant={itemEnterVariant}
                />
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* Loading indicator for next batch */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center justify-center p-6 bg-[#1c1c1d] border border-[#2a2a2b] rounded-lg"
        >
          <div className="flex items-center gap-3">
            <LuLoader className="w-5 h-5 animate-spin text-[#4a90e2]" />
            <span className="text-sm text-[#b1b1b1] font-sans">
              Loading some more codes...
            </span>
          </div>
        </motion.div>
      )}

      {/* Streaming indicator */}
      {isStreaming &&
        visibleCount >= displayData.potentialCodeBlockPaths.length && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-6 bg-[#1c1c1d] border border-[#2a2a2b] rounded-lg"
          >
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-[#4a90e2] rounded-full animate-pulse"></div>
              <div
                className="w-2 h-2 bg-[#5ba0f2] rounded-full animate-pulse"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-[#4a90e2] rounded-full animate-pulse"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-sm text-[#b1b1b1] font-sans mt-2"
            >
              Agent is Writing files...
            </motion.p>
          </motion.div>
        )}
    </motion.div>
  );
};

export default ProgressiveCodeBlockList;
