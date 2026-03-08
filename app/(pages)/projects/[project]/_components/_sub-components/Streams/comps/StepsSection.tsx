"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { LuLoader } from "react-icons/lu";
import { ProcessedJson } from "./streamTypes";

interface StepsSectionProps {
  processedContent: ProcessedJson;
  itemEnterVariant: Variants;
}

const StepsSection: React.FC<StepsSectionProps> = ({
  processedContent,
  itemEnterVariant,
}) => {
  if (
    !processedContent.hasStepsArray ||
    processedContent.stepsArray.length === 0
  ) {
    return null;
  }

  return (
    <motion.section variants={itemEnterVariant} className="mb-6">
      <h2 className="text-xl font-bold mb-4">This is what I am doing:</h2>
      <div className="text-[#d7d9dc] text-sm leading-relaxed ">
        {processedContent.stepsArray.map((step, index) => (
          <div
            key={`step-${index}-${step.slice(0, 20)}`}
            className="flex items-start gap-2 mb-1"
          >
            <span className="text-gray-400 mt-1 flex-shrink-0">•</span>
            <span>{step}</span>
          </div>
        ))}
        {/* Show loading indicator if steps are still streaming */}
        {processedContent.status === "streaming_json" &&
          !processedContent.isStepsComplete && (
            <div className="flex items-start gap-2 mb-1 text-gray-400 italic">
              <LuLoader className="w-3 h-3 animate-spin mt-1 flex-shrink-0" />
              <span>Loading more steps...</span>
            </div>
          )}
      </div>
    </motion.section>
  );
};

export default StepsSection;
