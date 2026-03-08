"use client";

import React, { lazy, Suspense } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { LuLoader } from "react-icons/lu";
import { guessLanguage } from "./streamHelpers";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({
    default: module.Prism,
  }))
);

interface CodeBlockProps {
  potentialBlock: { filePath: string; id: string };
  isComplete: boolean;
  completedBlockData: {
    filePath: string;
    codeContent: string;
    id: string;
  } | null;
  isOpen: boolean;
  onToggle: (id: string, isComplete: boolean) => void;
  codeRevealVariant: Variants;
  itemEnterVariant: Variants;
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  potentialBlock,
  isComplete,
  completedBlockData,
  isOpen,
  onToggle,
  codeRevealVariant,
  itemEnterVariant,
}) => {
  const codeContent = completedBlockData?.codeContent ?? "";
  const language = guessLanguage(potentialBlock.filePath);

  return (
    <motion.div
      key={potentialBlock.id}
      variants={itemEnterVariant}
      className="rounded-lg bg-[#1c1c1d] border border-[#2a2a2b] overflow-hidden hover:border-[#3a3a3b] transition-colors duration-200"
    >
      <button
        disabled={!isComplete}
        onClick={() => onToggle(potentialBlock.id, isComplete)}
        className={`w-full text-left flex justify-between items-center text-sm font-medium p-4 transition-colors duration-200 ${
          !isComplete
            ? "cursor-default opacity-70 text-[#71717A]"
            : "hover:bg-[#2a292c] cursor-pointer text-white"
        }`}
        aria-expanded={isComplete ? isOpen : undefined}
        aria-controls={
          isComplete ? `code-content-${potentialBlock.id}` : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              isComplete ? "bg-[#4a90e2]" : "bg-[#71717A] animate-pulse"
            }`}
          ></div>
          <span className="truncate font-sans">{potentialBlock.filePath}</span>
        </div>
        <div className="ml-2 flex-shrink-0 w-4 h-4">
          {!isComplete ? (
            <LuLoader className="animate-spin w-full h-full text-[#4a90e2]" />
          ) : (
            <motion.div
              animate={{ rotate: isOpen ? 0 : -90 }}
              transition={{ duration: 0.2 }}
              className="text-[#b1b1b1]"
            >
              <svg
                className="w-full h-full"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path
                  fillRule="evenodd"
                  d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
                />
              </svg>
            </motion.div>
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isComplete && isOpen && (
          <motion.div
            id={`code-content-${potentialBlock.id}`}
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={codeRevealVariant}
            className="border-t border-[#2a2a2b] bg-[#141415]"
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center p-6 text-[#b1b1b1]">
                  <div className="flex items-center gap-3">
                    <LuLoader className="animate-spin w-5 h-5 text-[#4a90e2]" />
                    <span className="text-sm font-sans">Loading code...</span>
                  </div>
                </div>
              }
            >
              <SyntaxHighlighter
                language={language}
                style={oneDark}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  maxHeight: "400px",
                  overflowY: "auto",
                  backgroundColor: "#0F0F0F",
                  fontSize: "0.8rem",
                  borderRadius: "0",
                }}
                wrapLongLines={true}
                showLineNumbers={codeContent.split("\n").length > 10}
                className="scrollbar-thin scrollbar-thumb-[#4a90e2] scrollbar-track-[#1c1c1d]"
              >
                {codeContent.length > 50000
                  ? `${codeContent.slice(0, 50000)}\n\n...`
                  : codeContent}
              </SyntaxHighlighter>
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CodeBlock;
