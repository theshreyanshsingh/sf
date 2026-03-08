"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";

import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { updateProject } from "@/app/_services/projects";

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onRename: (newName: string) => void;
  name: string;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onRename,
  name,
}) => {
  const [newName, setNewName] = useState("");
  const dispatch = useDispatch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Project name cannot be empty",
        })
      );
      return;
    }
    if (newName.trim() === name.trim()) {
      onClose();
      return;
    }
    try {
      await updateProject({
        projectId,
        action: "update-name",
        name: newName.trim(),
      });
      onRename(newName.trim());
      onClose();
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: "Project renamed successfully",
        })
      );
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to rename project",
        })
      );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[#121212] rounded-md shadow-lg p-3"
          >
            <h3 className="text-sm font-medium text-white mb-4">
              Rename Project
            </h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={newName ? newName : name}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new project name"
                className="w-full bg-[#2A2A2A] text-white rounded-md px-3 py-1 text-sm focus:outline-none mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-[2px] text-xs text-white font-sans font-medium hover:bg-[#2A2A2A] rounded-md transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-[2px] text-xs bg-white cursor-pointer text-black font-sans font-medium rounded-md hover:bg-gray-100 transition-colors duration-200"
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

export default RenameModal;
