"use client";

import React from "react";
import { MdOutlineChevronLeft } from "react-icons/md";
import { LuLoader } from "react-icons/lu";
import { FaCheck } from "react-icons/fa6";
import { ProcessedJson } from "./streamTypes";

interface StatusIndicatorProps {
  processedContent: ProcessedJson;
  onRead: () => void;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  processedContent,
  onRead,
}) => {
  return (
    <div className="flex justify-between sticky top-0 items-center border-b border-[#1c1b1b] pb-2 mb-4 rounded-lg bg-black/50 backdrop-blur-sm py-2 -mx-4 px-4 z-10">
      <button onClick={onRead} className="cursor-pointer">
        <MdOutlineChevronLeft className="text-white" />
      </button>
      <p className="text-sm text-white font-sans font-medium">
        {processedContent.status === "streaming_json"
          ? "Generation in progress..."
          : "Preview is available"}
      </p>
      {!processedContent.hasJsonSuffix && (
        <span className="text-xs bg-yellow-700 px-2 py-0.5 rounded animate-pulse">
          <LuLoader className="text-sm text-white animate-spin" />
        </span>
      )}
      {processedContent.hasJsonSuffix && (
        <span className="text-xs px-2 py-0.5 rounded">
          <FaCheck className="text-white" />
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;
