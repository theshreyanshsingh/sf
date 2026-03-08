"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiFile, FiFolder, FiX } from "react-icons/fi";
import { UIFileEntry } from "../projects/[project]/_components/v1/types";

interface FileRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UIFileEntry | null;
  onRename: (item: UIFileEntry, newName: string) => void;
}

const FileRenameModal: React.FC<FileRenameModalProps> = ({
  isOpen,
  onClose,
  item,
  onRename,
}) => {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Initialize newName when the item changes or modal opens
  useEffect(() => {
    if (item && isOpen) {
      setNewName(item.name);
      setError(null);
    }
  }, [item, isOpen]);
  
  // Focus and select text when the modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      
      // Select filename without extension for files
      if (item?.type === 'file' && item.name.includes('.')) {
        const dotIndex = item.name.lastIndexOf('.');
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isOpen, item]);

  // Handle Enter key for quick submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!item) return;
    
    // Validate name
    if (!newName.trim()) {
      setError("Name cannot be empty");
      return;
    }
    
    if (newName.includes("/")) {
      setError("Name cannot contain slashes");
      return;
    }
    
    // No change, just close
    if (newName.trim() === item.name) {
      onClose();
      return;
    }
    
    // Pass the name to parent component for processing
    onRename(item, newName.trim());
    // Ensure we close the modal after processing
    onClose();
  };

  if (!item) return null;

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
            <div className="bg-[#1e1e1e] px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center">
                {item.type === "file" ? (
                  <FiFile className="mr-2 text-blue-400" size={16} />
                ) : (
                  <FiFolder className="mr-2 text-yellow-400" size={16} />
                )}
                Rename {item.type === "file" ? "File" : "Folder"}
              </h3>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 p-1 rounded"
              >
                <FiX size={14} />
              </button>
            </div>
            
            {/* Content */}
            <form onSubmit={handleSubmit} className="p-4">
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">
                  New name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setError(null); // Clear error when typing
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-[#2A2A2A] text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 border border-[#3a3a3a]"
                  autoFocus
                />
                
                {error && (
                  <div className="mt-2 text-xs text-red-400 bg-red-400/10 p-2 rounded-md border border-red-400/20">
                    {error}
                  </div>
                )}
                
                <div className="text-xs text-gray-400 mt-2">
                  Current path: {item.path}
                </div>
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
                  disabled={!newName.trim() || newName.trim() === item.name}
                >
                  Rename
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FileRenameModal;
