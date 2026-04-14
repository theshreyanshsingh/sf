import React, { useState } from "react";
import { MdOutlineDelete } from "react-icons/md";
import { MdOutlineDriveFileRenameOutline } from "react-icons/md";
import { motion } from "framer-motion";
import { TbCircuitSwitchClosed } from "react-icons/tb";
import { LuCopy } from "react-icons/lu";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useDispatch } from "react-redux";
import {
  fetchAllProjects,
  renameProject,
  setVisibility,
} from "@/app/redux/reducers/basicData";
import type { AppDispatch } from "@/app/redux/store";
import RenameModal from "./RenameModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import { remixProject, updateProject } from "@/app/_services/projects";

interface ProjectOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  projectId: string;
  isPublic?: boolean;
  name: string;
}

const ProjectOptionsModal: React.FC<ProjectOptionsModalProps> = ({
  isOpen,
  onClose,
  position,
  projectId,
  isPublic,
  name,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [remixBusy, setRemixBusy] = useState(false);
  const { data: session } = useSession();
  const resolvedEmail =
    session?.user?.email ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || "" : "");

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
            className="fixed z-50 bg-[#121212] rounded-md shadow-lg py-1 min-w-[190px]"
            style={{
              top: position.top,
              left: position.left - 120,
            }}
          >
            <motion.button
              type="button"
              disabled={remixBusy || !resolvedEmail}
              onClick={async () => {
                if (!resolvedEmail || remixBusy) return;
                setRemixBusy(true);
                try {
                  const result = await remixProject({
                    sourceProjectId: projectId,
                    email: resolvedEmail,
                  });
                  if (result.success && result.projectId) {
                    onClose();
                    void dispatch(fetchAllProjects({ email: resolvedEmail }));
                    window.location.href = `/projects/${result.projectId}`;
                  }
                } finally {
                  setRemixBusy(false);
                }
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#2A2A2A] transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <LuCopy className="text-sm" />
              {remixBusy ? "Creating…" : "Use as template"}
            </motion.button>
            <motion.button
              type="button"
              onClick={async () => {
                await updateProject({
                  projectId,
                  action: isPublic ? "make-private" : "make-public",
                  email: resolvedEmail,
                });
                dispatch(setVisibility({ projectId, isPublic: !isPublic }));
                onClose();
                void dispatch(fetchAllProjects({ email: resolvedEmail }));
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
