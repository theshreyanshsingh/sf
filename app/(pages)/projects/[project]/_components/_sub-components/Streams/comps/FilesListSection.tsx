"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { ProcessedJson } from "./streamTypes";

interface FilesListSectionProps {
  processedContent: ProcessedJson;
  itemEnterVariant: Variants;
}

const FilesListSection: React.FC<FilesListSectionProps> = ({
  processedContent,
  itemEnterVariant,
}) => {
  if (!processedContent.hasFilesKey) {
    return null;
  }

  return (
    <motion.section variants={itemEnterVariant} className="mb-4">
      <h2 className="text-xl font-semibold mb-2">
        Files Created/Modified:
        {processedContent.filesCount > 0 && (
          <span className="text-sm text-gray-400 ml-2">
            ({processedContent.filesCount} files)
          </span>
        )}
      </h2>
      {processedContent.identifiedFileListItems.length > 0 ? (
        <div className="border border-[#1c1b1b] rounded-md bg-black p-3 max-h-80 overflow-y-auto">
          <div className="flex flex-col space-y-1">
            {processedContent.identifiedFileListItems.map((filePath, index) => (
              <p
                key={`file-${index}-${filePath}`}
                className="text-xs font-mono text-gray-300 break-all"
              >
                {filePath}
              </p>
            ))}
          </div>
          {processedContent.status === "streaming_json" &&
            processedContent.identifiedFileListItems.length <
              processedContent.filesCount && (
              <p className="text-xs italic text-gray-400 mt-2">
                ...loading{" "}
                {processedContent.filesCount -
                  processedContent.identifiedFileListItems.length}{" "}
                more files
              </p>
            )}
        </div>
      ) : processedContent.filesCount > 0 ? (
        <p className="text-xs italic text-gray-400">
          Loading files list... ({processedContent.filesCount} files expected)
        </p>
      ) : (
        <p className="text-xs italic text-gray-400">Identifying file list...</p>
      )}
    </motion.section>
  );
};

export default FilesListSection;
