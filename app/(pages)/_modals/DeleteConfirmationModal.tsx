"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch } from "react-redux";

import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { deleteProject } from "@/app/redux/reducers/basicData";
import { updateProject } from "@/app/_services/projects";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  projectId,
}) => {
  const [confirmationText, setConfirmationText] = useState("");
  const dispatch = useDispatch();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationText.toLowerCase() !== "delete") {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Please type 'delete' to confirm",
        })
      );
      return;
    }

    try {
      await updateProject({ projectId, action: "delete" });
      dispatch(deleteProject({ projectId }));

      onClose();
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: "Project deleted successfully",
        })
      );
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to delete project",
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
              Confirm Deletion
            </h3>
            <p className="text-xs font-sans font-medium text-gray-300 mb-4">
              This action is irreversible. Type{" "}
              <span className="text-red-500">&quot;delete&quot;</span> to
              confirm.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type 'delete' to confirm"
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
                  disabled={confirmationText.toLowerCase() !== "delete"}
                  className="px-4 py-[2px] cursor-pointer text-xs bg-red-500 text-white font-sans font-medium rounded-md hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DeleteConfirmationModal;
