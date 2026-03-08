"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, Variants } from "framer-motion";
import { ProcessedJson } from "./streamTypes";
import ProgressiveCodeBlockList from "./ProgressiveCodeBlockList";
import { useStreamWorker } from "./useStreamWorker";
import { streamStorage } from "./streamStorage";
import { useParams } from "next/navigation";

interface GeneratedFilesSectionProps {
  processedContent: ProcessedJson;
  openCodeBlocks: Set<string>;
  onToggleCodeBlock: (id: string, isComplete: boolean) => void;
  itemEnterVariant: Variants;
  codeRevealVariant: Variants;
}

const GeneratedFilesSection: React.FC<GeneratedFilesSectionProps> = ({
  processedContent,
  openCodeBlocks,
  onToggleCodeBlock,
  itemEnterVariant,
  codeRevealVariant,
}) => {
  const params = useParams();
  const projectId = (params?.project as string) || "default";

  const [workerData, setWorkerData] = useState<{
    potentialPaths: { filePath: string; id: string }[];
    completeBlocks: { filePath: string; codeContent: string; id: string }[];
  } | null>(null);

  const [lastProcessedContent, setLastProcessedContent] = useState("");
  const { processChunk, totalChunks } = useStreamWorker(projectId);

  // Process content through Web Worker when it changes
  useEffect(() => {
    const currentContent = processedContent.innerContent || "";

    if (
      processedContent.hasGenFilesKey &&
      currentContent !== lastProcessedContent &&
      currentContent.length > 100
    ) {
      processChunk(currentContent);
      setLastProcessedContent(currentContent);
    }
  }, [
    processedContent.innerContent,
    processedContent.hasGenFilesKey,
    processChunk,
    lastProcessedContent,
  ]);

  // Load processed data from IndexedDB when available
  useEffect(() => {
    const loadWorkerData = async () => {
      if (totalChunks > 0) {
        try {
          await streamStorage.init(projectId);
          const chunks = await streamStorage.getChunks(projectId, 0, 200);

          // Deduplicate by filePath (should already be deduplicated in storage, but extra safety)
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

          // Sort chunks by timestamp to ensure new files appear at bottom
          const deduplicatedChunks = Array.from(uniqueChunks.values()).sort(
            (a, b) => a.timestamp - b.timestamp
          );

          const potentialPaths = deduplicatedChunks.map((chunk) => ({
            filePath: chunk.filePath,
            id: chunk.filePath, // Use filePath as ID for consistency
          }));

          const completeBlocks = deduplicatedChunks
            .filter((chunk) => chunk.isComplete && chunk.codeContent)
            .map((chunk) => ({
              filePath: chunk.filePath,
              codeContent: chunk.codeContent!,
              id: chunk.filePath, // Use filePath as ID for consistency
            }));

          setWorkerData({ potentialPaths, completeBlocks });
        } catch (error) {
          console.error("Failed to load worker data:", error);
        }
      }
    };

    loadWorkerData();
  }, [totalChunks, projectId]);

  // Use worker data if available, fallback to original data
  const displayData = useMemo(() => {
    if (workerData && workerData.potentialPaths.length > 0) {
      return {
        potentialCodeBlockPaths: workerData.potentialPaths,
        identifiedCompleteCodeBlocks: workerData.completeBlocks,
      };
    }

    // Fallback to original data
    return {
      potentialCodeBlockPaths: processedContent.potentialCodeBlockPaths,
      identifiedCompleteCodeBlocks:
        processedContent.identifiedCompleteCodeBlocks,
    };
  }, [
    workerData,
    processedContent.potentialCodeBlockPaths,
    processedContent.identifiedCompleteCodeBlocks,
  ]);

  if (!processedContent.hasGenFilesKey) {
    return null;
  }

  const isStreaming =
    processedContent.status === "streaming_json" &&
    !processedContent.innerContent?.match(
      /"generatedFiles":\s*\{[\s\S]*?\},?\s*"files"/
    );

  return (
    <motion.section variants={itemEnterVariant} className="mb-6">
      <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white font-sans">
              Files Written
            </h2>
          </div>
        </div>

        <ProgressiveCodeBlockList
          potentialCodeBlockPaths={displayData.potentialCodeBlockPaths}
          identifiedCompleteCodeBlocks={
            displayData.identifiedCompleteCodeBlocks
          }
          openCodeBlocks={openCodeBlocks}
          onToggleCodeBlock={onToggleCodeBlock}
          itemEnterVariant={itemEnterVariant}
          codeRevealVariant={codeRevealVariant}
          isStreaming={isStreaming}
          projectId={projectId}
        />
      </div>
    </motion.section>
  );
};

export default GeneratedFilesSection;
