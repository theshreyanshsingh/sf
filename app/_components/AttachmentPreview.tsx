"use client";

import { motion, AnimatePresence } from "framer-motion";
import { IoClose } from "react-icons/io5";
import { FaFilePdf, FaCode } from "react-icons/fa6";
import Image from "next/image";

export type AttachmentType = {
  file: File;
  preview: string;
  type: "image" | "video" | "pdf" | "code" | "reference";
  isUploading?: boolean;
  fileType: string;
  previewUrl?: string;
  url: string;
  name: string;
  id: string;
};

type AttachmentPreviewProps = {
  attachments: AttachmentType[];
  onRemove: (index: number) => void;
};

const AttachmentPreview = ({
  attachments,
  onRemove,
}: AttachmentPreviewProps) => {
  if (attachments.length === 0) return null;

  return (
    <div className="w-full flex flex-wrap gap-2 mb-2">
      <AnimatePresence>
        {attachments.map((attachment, index) => (
          <motion.div
            key={index}
            className="relative w-full max-w-[50px] h-auto rounded-md overflow-hidden group"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            {attachment.type === "image" && (
              <div className="relative w-[50px] h-[50px] rounded-md overflow-hidden">
                <Image
                  src={attachment.preview}
                  alt="Attachment"
                  fill
                  className="object-cover"
                  unoptimized
                />

                {attachment.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#151515] bg-opacity-50">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}

            {attachment.type === "video" && (
              <div className="w-full h-[180px] rounded-md overflow-hidden bg-[#151515] relative">
                <video
                  src={attachment.preview}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    View Full
                  </span>
                </div>
                {attachment.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#151515] bg-opacity-50">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}

            {attachment.type === "pdf" && (
              <div className="w-full h-[180px] rounded-md overflow-hidden bg-[#1D1E22] flex items-center justify-center flex-col relative">
                <FaFilePdf className="text-white text-3xl" />
                <span className="text-white text-sm font-sans font-medium mt-2">
                  PDF
                </span>
                {attachment.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#151515] bg-opacity-50">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            )}

            {attachment.type === "code" && (
              <div
                className="w-full h-[60px] rounded-md overflow-hidden bg-[#1D1E22] flex flex-row items-center p-2 relative border border-[#2a2a2b] gap-2"
                title={attachment.name}
              >
                <div className="flex-shrink-0 w-8 h-8 bg-[#2a2a2b] rounded flex items-center justify-center">
                  <FaCode className="text-[#4a90e2] text-sm" />
                </div>
                <div className="flex flex-col overflow-hidden w-full">
                  <span className="text-white text-[10px] font-sans font-medium truncate w-full">
                    {attachment.name.split("/").pop()}
                  </span>
                  <span className="text-[#71717A] text-[9px] font-mono truncate w-full">
                    {attachment.preview.slice(0, 50).replace(/\n/g, " ")}...
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => onRemove(index)}
              className="absolute top-0 right-0 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <IoClose size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default AttachmentPreview;
