"use client";

import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { IoAddOutline, IoClose } from "react-icons/io5";
import { LuBrain } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useAuthenticated } from "../helpers/useAuthenticated";
import { useProjectsData } from "../helpers/useProjectsData";
import moment from "moment";
import { MdArrowOutward } from "react-icons/md";

interface ProjectsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_VISIBLE_PROJECTS = 10;
const LOAD_MORE_PROJECTS_STEP = 10;

const ProjectsSidebar: React.FC<ProjectsSidebarProps> = ({
  isOpen,
  onClose,
}) => {
  const { email } = useAuthenticated();
  const { projects, loading } = useProjectsData(email.value);
  const router = useRouter();
  const [visibleProjectsCount, setVisibleProjectsCount] = React.useState(
    INITIAL_VISIBLE_PROJECTS
  );

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setVisibleProjectsCount(INITIAL_VISIBLE_PROJECTS);
  }, [isOpen]);

  const visibleProjects = React.useMemo(
    () => projects.slice(0, visibleProjectsCount),
    [projects, visibleProjectsCount]
  );

  const hasMoreProjects = projects.length > visibleProjectsCount;

  const handleOpenProject = (project: any) => {
    onClose();
    window.location.href = `/projects/${project.generatedName}`;
  };

  const handleCreateNewProject = () => {
    router.push("/");
    onClose();
  };

  const sidebarVariants: Variants = {
    hidden: { x: "-100%", opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      x: "-100%",
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-90"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-0 top-0 h-full w-80 bg-[#141415]/50 border-r border-[#201F22] z-[1501] flex flex-col"
            style={{ zIndex: 99999 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#201F22]">
              <div className="flex items-center space-x-2">
                <h2 className="text-white font-bold text-lg">Projects</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            {/* Projects List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <h3 className="text-gray-400 text-sm font-medium my-3">
                Recents
              </h3>

              {loading === "loading" ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              ) : projects && projects.length > 0 ? (
                <div className="space-y-2">
                  {visibleProjects.map((project) => (
                    <div
                      key={project.generatedName}
                      className="p-3 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <h4 className="text-white text-sm font-medium truncate transition-colors">
                              {project.title}
                            </h4>
                            {project.deployed_url && (
                              <div className="cursor-pointer group">
                                <a
                                  href={
                                    project.deployed_url.startsWith("http")
                                      ? project.deployed_url
                                      : `https://${project.deployed_url}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 mt-1 text-xs flex justify-start items-center space-x-1"
                                >
                                  Visit
                                  <MdArrowOutward className="w-3 h-3 text-gray-400" />
                                </a>
                              </div>
                            )}
                          </div>
                          <div
                            onClick={() => handleOpenProject(project)}
                            className="flex rounded-lg bg-[#2A2A2A] cursor-pointer hover:bg-white/80  hover:text-black items-center space-x-2 mt-2 w-fit px-2 p-1 text-xs flex justify-start items-center "
                          >
                            Open
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-500 text-xs">
                              {project.isPublic ? "Public" : "Private"}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {moment(project.updatedAt).fromNow()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {hasMoreProjects && (
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleProjectsCount((currentCount) =>
                          Math.min(
                            currentCount + LOAD_MORE_PROJECTS_STEP,
                            projects.length
                          )
                        )
                      }
                      className="w-full rounded-xl border border-[#2A2A2A] bg-[#1B1B1D] px-4 py-3 text-sm font-medium text-white transition-colors hover:border-[#3A3A3D] hover:bg-[#232326]"
                    >
                      Load more
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">No projects yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProjectsSidebar;
