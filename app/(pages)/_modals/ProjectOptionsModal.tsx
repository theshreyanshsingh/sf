import React, { useState } from "react";
import { LuPin } from "react-icons/lu";
import { MdOutlineDelete } from "react-icons/md";
import { AiOutlineDeploymentUnit } from "react-icons/ai";
import { MdOutlineDriveFileRenameOutline } from "react-icons/md";
import { motion } from "framer-motion";
import { TbCircuitSwitchClosed } from "react-icons/tb";

import { useDispatch } from "react-redux";
import { renameProject, setVisibility } from "@/app/redux/reducers/basicData";
import RenameModal from "./RenameModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { updateProject } from "@/app/_services/projects";

interface ProjectOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  onPin: (projectId: string) => void;
  projectId: string;
  isPinned: boolean;
  isPublic?: boolean;
  name: string;
}
const ProjectOptionsModal: React.FC<ProjectOptionsModalProps> = ({
  isOpen,
  onClose,
  position,
  onPin,
  projectId,
  isPinned,
  isPublic,
  name,
}) => {
  const dispatch = useDispatch();
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleRename = (newName: string) => {
    dispatch(renameProject({ projectId, newTitle: newName }));
    onClose();
  };

  return (
    <div>
      <RenameModal
        name={name}
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        projectId={projectId}
        onRename={handleRename}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        projectId={projectId}
      />

      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed left-5 inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="fixed z-50 bg-[#121212] rounded-lg shadow-lg py-1 min-w-[150px]"
            style={{
              top: position.top,
              left: position.left - 120,
            }}
          >
            <motion.button
              onClick={async () => {
                await updateProject({
                  projectId,
                  action: "pin",
                  value: !isPinned,
                });
                onPin(projectId);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2"
            >
              <LuPin className="text-sm" />
              {isPinned ? "Unpin" : "Pin"}
            </motion.button>
            <motion.button
              onClick={async () => {
                await updateProject({
                  projectId,
                  action: isPublic ? "make-private" : "make-public",
                });
                dispatch(setVisibility({ projectId, isPublic: !isPublic }));
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2"
            >
              <TbCircuitSwitchClosed className="text-sm" />
              Switch to {isPublic ? "private" : "public"}
            </motion.button>
            <motion.button
              onClick={() => {
                setIsRenameModalOpen(true);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2"
            >
              <MdOutlineDriveFileRenameOutline className="text-sm" />
              Rename
            </motion.button>
            <motion.button
              disabled
              onClick={onClose}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2"
            >
              <AiOutlineDeploymentUnit className="text-sm" />
              Deploy {"(Available soon)"}
            </motion.button>
            <motion.button
              onClick={() => {
                setIsDeleteModalOpen(true);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2"
            >
              <MdOutlineDelete className="text-sm" />
              Delete
            </motion.button>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default ProjectOptionsModal;
