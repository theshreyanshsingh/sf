"use client";

import React from "react";
import { motion } from "framer-motion";
import { ProcessedRaw } from "./streamTypes";
import { LuLoader } from "react-icons/lu";

interface RawUnexpectedDisplayProps {
  processedContent: ProcessedRaw;
  containerVariants: any;
}

const RawUnexpectedDisplay: React.FC<RawUnexpectedDisplayProps> = ({
  processedContent,
  containerVariants,
}) => {
  return (
    <motion.div
      className="text-white p-4 border border-[#1c1b1b] rounded-md bg-black"
      initial="initial"
      animate="animate"
      variants={containerVariants}
    >
      <div className="flex items-center justify-center space-x-2">
        <LuLoader className="text-lg text-white animate-spin" />
        <p className="text-sm text-white font-semibold">
          Processing stream data...
        </p>
      </div>
    </motion.div>
  );
};

export default RawUnexpectedDisplay;
