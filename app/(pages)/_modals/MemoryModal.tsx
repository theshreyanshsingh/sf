import { saveMemory } from "@/app/_services/projects";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { setMemory, setMemoryModal } from "@/app/redux/reducers/projectOptions";
import { RootState } from "@/app/redux/store";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { LuLoaderCircle } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";

const MemoryModal = () => {
  const { memoryModal, memory, projectId, generating } = useSelector(
    (state: RootState) => state.projectOptions
  );

  const { email } = useAuthenticated();
  const dispatch = useDispatch();

  if (!memoryModal) return null;

  const handleMemoryModal = () => {
    dispatch(setMemoryModal(!memoryModal));
  };

  const handleSave = async () => {
    if (memory === null || memory === undefined || !memory.trim()) return;

    if (email.value && projectId) {
      saveMemory({ text: memory as string, email: email.value, projectId });
      dispatch(setMemoryModal(!memoryModal));
    }
  };

  return (
    <AnimatePresence mode="wait">
      {memoryModal && (
        <motion.div
          className="fixed inset-0 flex  items-start justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 max-md:bg-black/30 max-md:backdrop-blur-sm z-50"
            onClick={handleMemoryModal}
          />

          <motion.div
            className="bg-[#0F0F0F] p-3 mt-50 md:mt-15 rounded-lg shadow-md md:w-1/3 space-y-3 w-[90vw] z-50"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <h2 className="text-lg font-bold font-sans text-white">Memory</h2>
            <p className="text-xs font-sans font-medium text-[#70717B]">
              This context will be remembered throughout the project!
            </p>
            <textarea
              disabled={generating}
              value={memory || ""}
              onChange={(e) => {
                dispatch(setMemory(e.target.value));
              }}
              className="flex-1 outline-none text-white w-full p-2 text-xs resize-none overflow-y-auto font-medium font-sans rounded-lg min-h-[80px] max-h-[150px]  bg-[#252525]"
              placeholder="Tell me to remember something..."
            />
            <div className="justify-end items-center flex space-x-2">
              <button
                className="px-2 p-1 text-white rounded-lg hover:bg-[#252525] font-sans font-medium text-xs"
                onClick={handleMemoryModal}
              >
                Close
              </button>
              <button
                disabled={generating}
                className="px-2 p-1 text-black bg-white rounded-lg hover:bg-gray-50 font-medium text-xs justify-center items-center flex"
                onClick={handleSave}
              >
                {generating ? (
                  <LuLoaderCircle className="animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MemoryModal;
