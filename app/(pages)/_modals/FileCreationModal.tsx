"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";
import { FiFile, FiFolder } from "react-icons/fi";

interface FileCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "file" | "folder";
  parentPath: string;
  onConfirm: (name: string) => void;
}

const FileCreationModal: React.FC<FileCreationModalProps> = ({
  isOpen,
  onClose,
  type,
  parentPath,
  onConfirm,
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Clear name and error when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
    }
  }, [isOpen]);

  // Handle Enter key for quick submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    
    if (name.includes("/")) {
      setError("Name cannot contain slashes");
      return;
    }
    
    // Pass the name to parent component for processing
    onConfirm(name.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[#121212] rounded-md shadow-lg overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1e1e1e] px-4 py-3 border-b border-[#2a2a2a]">
              <h3 className="text-sm font-medium text-white flex items-center">
                {type === "file" ? (
                  <FiFile className="mr-2 text-blue-400" size={16} />
                ) : (
                  <FiFolder className="mr-2 text-yellow-400" size={16} />
                )}
                Create New {type === "file" ? "File" : "Folder"}
              </h3>
              {parentPath && (
                <div className="text-xs text-gray-400 mt-1 truncate">
                  Location: {parentPath === "/" ? "Root" : parentPath}
                </div>
              )}
            </div>
            
            {/* Content */}
            <form onSubmit={handleSubmit} className="p-4">
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  {type === "file" ? "File name" : "Folder name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null); // Clear error when typing
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={type === "file" ? "filename.ext" : "folder name"}
                  className="w-full bg-[#2A2A2A] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-[#3a3a3a]"
                  autoFocus
                />
                
                {error && (
                  <div className="mt-2 text-xs text-red-400 bg-red-400/10 p-2 rounded-md border border-red-400/20">
                    {error}
                  </div>
                )}
              </div>
              
              {/* Buttons */}
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-[6px] text-xs text-white font-sans font-medium hover:bg-[#2A2A2A] rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-[6px] text-xs bg-blue-600 cursor-pointer text-white font-sans font-medium rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center"
                  disabled={!name.trim()}
                >
                  Create
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FileCreationModal;
