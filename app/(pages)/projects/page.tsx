"use client";
import React, { useState } from "react";
import { CgOptions } from "react-icons/cg";
import ProjectOptionsModal from "../_modals/ProjectOptionsModal";
import { LuBrain, LuLoader } from "react-icons/lu";
import { IoAddOutline } from "react-icons/io5";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/app/redux/store";
import { setPinned } from "@/app/redux/reducers/basicData";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useProjectsData } from "@/app/helpers/useProjectsData";
import moment from "moment";

interface Project {
  generatedName: string;
}
const Page = () => {
  const { email } = useAuthenticated();
  const { projects, loading } = useProjectsData(email.value);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects =
    projects?.filter((project) => {
      if (!searchQuery) return true;
      return project.title.toLowerCase().includes(searchQuery.toLowerCase());
    }) || [];

  const pinnedProjects =
    filteredProjects?.filter((project) => project.isPinned) || [];
  const unpinnedProjects =
    filteredProjects?.filter((project) => !project.isPinned) || [];

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  // Projects are now fetched via the useProjectsData hook

  const handlePinToggle = (projectId: string) => {
    const project = projects.find((p) => p.generatedName === projectId);
    if (project) {
      dispatch(setPinned({ projectId, isPinned: !project.isPinned }));
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    index: string;
    position: { top: number; left: number };
  }>({ isOpen: false, index: "", position: { top: 0, left: 0 } });

  const handleOptionsClick = (index: string, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setModalState({
      isOpen: true,
      index,
      position: { top: rect.bottom + 5, left: rect.left },
    });
  };

  const handleOpenProject = async (project: Project) => {
    if (window) window.location.href = `/projects/${project.generatedName}`;
  };

  return (
    <div className="flex flex-col bg-[#141415] h-screen max-md:w-screen overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#201F22] px-3 flex justify-between items-center space-x-7">
        <h2 className="font-bold text-left font-sans text-white">Projects</h2>
        <div className="flex items-center w-[70%] justify-center border-x border-[#28272a] h-full py-2 px-1">
          <input
            disabled={loading !== "success"}
            className="w-full text-xs font-sans font-medium text-white placeholder-gray-400 px-3 p-1 rounded-lg focus:outline-none bg-transparent"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-xs hidden font-sans font-medium text-[#838385] whitespace-nowrap md:inline-block justify-center items-center w-[13%]">
          Number of projects - {projects?.length || 0}
        </div>
        <div className="text-xs font-sans md:hidden font-medium text-[#838385] whitespace-nowrap inline-block justify-center items-center w-[13%]">
          NOP - {projects?.length || 0}
        </div>
      </div>

      {loading !== "success" ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex-1 overflow-y-auto justify-center items-center flex"
        >
          <LuLoader className="text-lg text-white animate-spin" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex-1 overflow-y-auto"
        >
          {!projects?.length ? (
            <div className="flex flex-col items-center justify-center h-full">
              <button
                onClick={() => {
                  router.push("/");
                }}
                className="border border-[#1A1A1A] text-white rounded-md cursor-pointer px-4 py-2 font-sans font-medium text-sm hover:bg-[#2A2A2A] transition-colors justify-center items-center flex gap-x-2"
              >
                <IoAddOutline className="text-lg" />
                Create New Project
              </button>
            </div>
          ) : (
            <>
              {/* Pinned Projects */}
              {pinnedProjects?.length > 0 && (
                <div className="px-10 pt-10 border-b border-[#201F22]">
                  <h2 className="text-white text-lg font-semibold mb-4">
                    Pinned Projects
                  </h2>
                  <div className="grid md:grid-cols-4 grid-cols-1 gap-8 pb-10">
                    {pinnedProjects.map((project, index) => (
                      <div
                        key={index}
                        className="rounded-md justify-center items-start flex flex-col bg-[#0f0f0f] pt-2 px-3 space-y-3 max-w-3xl overflow-hidden text-ellipsis"
                      >
                        <h3 className="text-sm font-sans font-medium text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                          {project.title}
                        </h3>

                        <div className="justify-start space-x-2 w-full items-center flex">
                          <LuBrain className="text-sm text-white" />
                          <h3 className="text-xs font-sans font-medium text-white  overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                            {project.memory ? project.memory : "Empty"}
                          </h3>
                        </div>
                        <div className="justify-between w-full items-center flex">
                          <h3 className="text-xs font-sans font-medium text-[#838385]">
                            {project.isPublic ? "Public" : "Private"}
                          </h3>
                          <h3 className="text-xs font-sans font-medium text-[#838385]">
                            Modified {moment(project.updatedAt).fromNow()}
                          </h3>
                        </div>
                        <div className="justify-between items-center flex w-full border-t border-[#201F22] py-3">
                          <button
                            onClick={() => [handleOpenProject(project)]}
                            className="justify-center items-center flex text-white rounded-md px-2 p-[2px] cursor-pointer hover:bg-[#1A1A1A] font-sans font-medium text-xs"
                          >
                            Open Project
                          </button>
                          <button
                            className="rounded-md p-[2px] cursor-pointer hover:bg-[#1A1A1A] text-white"
                            onClick={(e) =>
                              handleOptionsClick(project.generatedName, e)
                            }
                          >
                            <CgOptions />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Projects */}
              {unpinnedProjects.length > 0 && (
                <div className="p-10">
                  <h2 className="text-white text-lg font-semibold mb-4">
                    All Projects
                  </h2>
                  <div className="grid md:grid-cols-4 grid-cols-1 gap-8">
                    {unpinnedProjects.map((project, index) => (
                      <div
                        key={index}
                        className="rounded-md justify-center items-start flex flex-col bg-[#0f0f0f] pt-2 px-3 space-y-3 max-w-3xl overflow-hidden text-ellipsis"
                      >
                        <h3 className="text-sm font-sans font-medium text-white overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                          {project.title}
                        </h3>

                        <div className="justify-start space-x-2 w-full items-center flex">
                          <LuBrain className="text-sm text-white" />
                          <h3 className="text-xs font-sans font-medium text-white  overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                            {project.memory ? project.memory : "Empty"}
                          </h3>
                        </div>
                        <div className="justify-between w-full items-center flex">
                          <h3 className="text-xs font-sans font-medium text-[#838385]">
                            {project.isPublic ? "Public" : "Private"}
                          </h3>
                          <h3 className="text-xs font-sans font-medium text-[#838385]">
                            Modified {moment(project.updatedAt).fromNow()}
                          </h3>
                        </div>
                        <div className="justify-between items-center flex w-full border-t border-[#201F22] py-3">
                          <button
                            onClick={() => [handleOpenProject(project)]}
                            className="justify-center items-center flex text-white rounded-md px-2 p-[2px] cursor-pointer hover:bg-[#1A1A1A] font-sans font-medium text-xs "
                          >
                            Open Project
                          </button>
                          <button
                            className="rounded-md p-[2px] cursor-pointer hover:bg-[#1A1A1A] text-white"
                            onClick={(e) =>
                              handleOptionsClick(project.generatedName, e)
                            }
                          >
                            <CgOptions />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <ProjectOptionsModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          position={modalState.position}
          onPin={handlePinToggle}
          name={
            projects.find(
              (project) => project.generatedName === modalState.index
            )?.title ?? ""
          }
          isPublic={
            projects.find(
              (project) => project.generatedName === modalState.index
            )?.isPublic ?? false
          }
          projectId={modalState.index}
          isPinned={
            projects.find((p) => p.generatedName === modalState.index)
              ?.isPinned || false
          }
        />
      </AnimatePresence>
    </div>
  );
};

export default Page;
