// app/_sub-components/Sheet.tsx
"use client";

import { NextPage } from "next";
import React, { useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RootState } from "../../../../redux/store";

import SubHeader from "./SubHeader";
// import Header from "./Header";
import { usePathname } from "next/navigation";
import EnhancedPrompt from "./_sub-components/EnhancedPrompt";
import Thoughts from "./_sub-components/Thoughts";
import CodeEditor from "./v1/Editor/CodeEditor";
import Preview from "./v1/Preview";
import MobilePreviewSnack from "./mobile/MobilePreviewSnack";
import Terminal from "./v1/Terminal";
import PagesManager from "./v1/PagesManager";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import { useResponse } from "@/app/_services/useResponse";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentFile } from "@/app/redux/reducers/projectFiles";
// import Grape from "./v1/Editor/Grape";

const Sheet: NextPage = () => {
  const {
    mode,
    framework,
    previewRuntime,
    url,
    isResponseCompleted,
    enh_prompt,
    generationSuccess,
  } = useSelector((state: RootState) => state.projectOptions);
  const isMobilePreviewRuntime = previewRuntime === "mobile";

  const { data: projectData, currentFile } = useSelector(
    (state: RootState) => state.projectFiles
  );

  const { fetchProjectFiles } = useResponse();
  const {
    bootContainer,
    state,
    // terminalInstanceRef,
    webcontainerInstance,
  } = useWebContainerContext();

  const dispatch = useDispatch();
  const path = usePathname();

  const getProjectId = useCallback(() => {
    const segments = path.split("/");
    const id = segments[2] || "";
    return id;
  }, [path]);

  const projectId = getProjectId();

  const lastFetchedUrlRef = useRef<string | null>(null);
  const filesWrittenRef = useRef(false);

  // Fetch project files when URL is available
  useEffect(() => {
    if (url && lastFetchedUrlRef.current !== url) {
      lastFetchedUrlRef.current = url;
      // Reset the files written flag when URL changes (new project)
      filesWrittenRef.current = false;
      fetchProjectFiles({ url });
    }
  }, [url, fetchProjectFiles]);

  // Write files to WebContainer when both data and WebContainer are ready
  useEffect(() => {
    const writeFilesToWebContainer = async () => {
      if (isMobilePreviewRuntime) {
        return;
      }

      if (!webcontainerInstance || filesWrittenRef.current || state !== "success") {
        return;
      }

      if (!projectData || Object.keys(projectData).length === 0) {
        return;
      }

      try {
        filesWrittenRef.current = true;

        // Normalize the file data
        const normalizeFileMap = (
          fileMap: Record<string, unknown> | object
        ): Record<string, string> => {
          const normalized: Record<string, string> = {};
          // Ensure fileMap is treated as a record with string keys
          const safeFileMap = fileMap as Record<string, unknown>;
          for (const [path, value] of Object.entries(safeFileMap)) {
            if (typeof value === "string") {
              normalized[path] = value;
            } else if (value && typeof value === "object" && "code" in value) {
              normalized[path] = (value as { code: string }).code;
            } else {
              normalized[path] = JSON.stringify(value, null, 2);
            }
          }
          return normalized;
        };

        const normalized = normalizeFileMap(projectData);

        // Write each file to WebContainer
        for (const [rawPath, contentStr] of Object.entries(normalized)) {
          if (typeof contentStr !== "string") continue;

          const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
          const dir = path.substring(0, path.lastIndexOf("/"));

          // --- INJECT WYSIWYG SUPPORT ---
          let finalContent = contentStr;
          if (path.endsWith(".html") && !finalContent.includes("wysiwyg-editor.js")) {
            const scriptTag = `\n    <script src="/wysiwyg-editor.js"></script>\n  `;
            if (finalContent.includes("</head>")) {
              finalContent = finalContent.replace("</head>", `${scriptTag}</head>`);
            } else if (finalContent.includes("</body>")) {
              finalContent = finalContent.replace("</body>", `${scriptTag}</body>`);
            } else {
              finalContent = finalContent + scriptTag;
            }
            console.log(`[Sheet] Activated WYSIWYG in ${path}`);
          }

          // Create directory if needed
          if (dir && dir !== "/") {
            try {
              await webcontainerInstance.fs.mkdir(dir, { recursive: true });
            } catch {
              // Directory already exists
            }
          }

          // Write the file
          try {
            await webcontainerInstance.fs.writeFile(path, finalContent, "utf-8");
          } catch (e) {
            console.error(`Failed writing ${path}:`, e);
          }
        }
      } catch (error) {
        console.error("Error writing files to WebContainer:", error);
        filesWrittenRef.current = false; // Reset to allow retry
      }
    };

    writeFilesToWebContainer();
  }, [webcontainerInstance, state, projectData, framework, isMobilePreviewRuntime]); // Depend on WebContainer state and project data

  const bootRetryCountRef = useRef<number>(0);
  const MAX_BOOT_RETRIES = 3;

  useEffect(() => {
    if (isMobilePreviewRuntime) {
      bootRetryCountRef.current = 0;
      return;
    }

    const shouldBoot =
      !webcontainerInstance && (state === null || state === "error");
    if (!shouldBoot) return;

    // Avoid infinite retry loops; allow a few retries for transient boot issues.
    if (state === "error") {
      if (bootRetryCountRef.current >= MAX_BOOT_RETRIES) return;
      bootRetryCountRef.current += 1;
    }

    const retryDelay = state === "error" ? bootRetryCountRef.current * 750 : 0;
    const timer = window.setTimeout(() => {
      void bootContainer();
    }, retryDelay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    state,
    bootContainer,
    webcontainerInstance,
    isMobilePreviewRuntime,
    MAX_BOOT_RETRIES,
  ]);

  useEffect(() => {
    if (state === "success" || state === null) {
      bootRetryCountRef.current = 0;
    }
  }, [state]);

  // Automatically select the first editable file if none selected and data is available
  useEffect(() => {
    if (!currentFile && projectData && Object.keys(projectData).length > 0) {
      const editableFiles = Object.entries(projectData).filter(([filePath]) => {
        return (
          filePath.endsWith(".html") ||
          filePath.endsWith(".tsx") ||
          filePath.endsWith(".jsx") ||
          filePath.endsWith(".js") ||
          filePath.endsWith(".css") ||
          filePath.endsWith(".json") ||
          filePath.endsWith(".md")
        );
      });

      if (editableFiles.length > 0) {
        const [filePath, content] = editableFiles[0];
        const fileName = filePath.split("/").pop() || filePath;
        const nextContent =
          typeof content === "string"
            ? content
            : content &&
                typeof content === "object" &&
                "code" in content &&
                typeof (content as { code?: unknown }).code === "string"
              ? (content as { code: string }).code
              : JSON.stringify(content);
        dispatch(
          setCurrentFile({
            name: fileName,
            path: filePath,
            contents: nextContent,
          })
        );
      }
    }
  }, [currentFile, projectData, dispatch, isMobilePreviewRuntime]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#121214]">
      {/* <Header /> */}

      {!isResponseCompleted && generationSuccess === null && enh_prompt && (
        <EnhancedPrompt enh_prompt={enh_prompt} projectId={projectId} />
      )}

      <AnimatePresence mode="wait">
        {generationSuccess === "success" && (
          <motion.div
            key="success"
            className="h-full min-h-0 w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <div className="h-full min-h-0 w-full ">
              <div className="h-full min-h-0 w-full md:h-full">
                {/* Edit Mode Content */}
                <motion.div
                  className="flex h-full min-h-0 flex-col"
                  animate={{
                    opacity: mode === "edit" ? 1 : 0,
                    display: mode === "edit" ? "flex" : "none",
                  }}
                  initial={false}
                  transition={{ duration: 0.1 }}
                >
                  <SubHeader />
                  {/* Quick File Selector for Edit Mode */}
                  {/* <div className="flex px-4  pt-4 gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide no-scrollbar">
                    {projectData && Object.entries(projectData).map(([filePath, content]) => {
                      // Filter for editable file types
                      const isEditable =
                        filePath.endsWith('.html') ||
                        filePath.endsWith('.tsx') ||
                        filePath.endsWith('.jsx') ||
                        filePath.endsWith('.js') ||
                        filePath.endsWith('.css') ||
                        filePath.endsWith('.json') ||
                        filePath.endsWith('.md');

                      if (!isEditable) return null;

                      const fileName = filePath.split('/').pop() || filePath;
                      const isActive = currentFile && (currentFile as any).path === filePath;

                      return (
                        <button
                          key={filePath}
                          onClick={() => {
                            dispatch(setCurrentFile({
                              name: fileName,
                              path: filePath,
                              contents: typeof content === 'string' ? content : (content as any).code || JSON.stringify(content)
                            }));
                          }}
                          className={`px-3 py-1.5 text-[10px] font-medium rounded-lg border transition-all duration-200 flex items-center gap-2 ${isActive
                            ? "bg-[#1e1e20] border-[#4a90e2] text-[#4a90e2] shadow-[0_0_10px_rgba(74,144,226,0.2)]"
                            : "bg-[#141415] border-[#2a2a2b] text-[#b1b1b1] hover:border-[#3a3a3b] hover:text-white"
                            }`}
                        >
                          <span className="opacity-70">{filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') + '/' : ''}</span>
                          <span className="font-bold">{fileName}</span>
                        </button>
                      );
                    })}
                  </div> */}

                  <div className="flex min-h-0 flex-grow flex-col gap-4 overflow-hidden p-4 md:flex-row">
                    {/* <div className="flex-grow  md:w-1/2 min-h-[40vh] relative border border-[#2a2a2b]  rounded-xl overflow-hidden shadow-2xl">
                      <TiptapEditor
                        content={
                          currentFile &&
                            typeof currentFile === "object" &&
                            "contents" in currentFile
                            ? (currentFile.contents as string)
                            : projectData && Object.keys(projectData).length > 0
                              ? `<div style='display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #b1b1b1; font-family: sans-serif;'>
                                <div style='font-size: 24px; margin-bottom: 12px;'>📝</div>
                                <p style='margin: 0; font-weight: 500;'>Select a file to start editing</p>
                                <p style='margin: 4px 0 0 0; font-size: 13px; opacity: 0.7;'>Choose an editable file from the tabs above</p>
                              </div>`
                              : generating
                                ? `<div style='display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #b1b1b1; font-family: sans-serif;'>
                                <div style='font-size: 24px; margin-bottom: 12px;'>🍳</div>
                                <p style='margin: 0; font-weight: 500;'>Preparing your project files...</p>
                                <p style='margin: 4px 0 0 0; font-size: 13px; opacity: 0.7;'>This may take a few moments</p>
                              </div>`
                                : `<div style='display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: #b1b1b1; font-family: sans-serif;'>
                                <div style='font-size: 24px; margin-bottom: 12px;'>📂</div>
                                <p style='margin: 0; font-weight: 500;'>No files found</p>
                                <p style='margin: 4px 0 0 0; font-size: 13px; opacity: 0.7;'>Generate a project to start editing visually</p>
                              </div>`
                        }
                        onChange={(html) => {
                          if (currentFile && typeof currentFile === "object" && "path" in currentFile) {
                            dispatch(
                              updateSpecificFile({
                                filePath: (currentFile as any).path,
                                content: html,
                              })
                            );
                          }
                        }}
                      />
                    </div> */}
                    <div
                      className={`relative h-full min-h-0 overflow-hidden rounded-xl border border-[#2a2a2b] shadow-2xl ${
                        isMobilePreviewRuntime ? "w-full flex-grow" : "flex-grow md:w-1/2"
                      }`}
                    >
                      {isMobilePreviewRuntime ? <MobilePreviewSnack /> : <Preview />}
                    </div>
                  </div>
                  {/* <Grape /> */}
                </motion.div>

                {/* Code Mode Content */}
                <motion.div
                  className="h-full w-full "
                  animate={{
                    opacity: mode === "code" ? 1 : 0,
                    display: mode === "code" ? "block" : "none", // Optional: hide completely
                  }}
                  initial={false}
                  transition={{ duration: 0.1 }}
                >
                  <CodeEditor />
                </motion.div>

                {/* Pages Manager */}
                <motion.div
                  className="h-full w-full"
                  animate={{
                    opacity: mode === "pages" ? 1 : 0,
                    display: mode === "pages" ? "block" : "none",
                  }}
                  initial={false}
                  transition={{ duration: 0.1 }}
                >
                  <PagesManager />
                </motion.div>

                {/* Split Mode Content */}
                <motion.div
                  className="h-full w-full flex "
                  animate={{
                    opacity: mode === "split" ? 1 : 0,
                    display: mode === "split" ? "flex" : "none", // Optional: hide completely
                  }}
                  initial={false}
                  transition={{ duration: 0.1 }}
                >
                  <Terminal />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {generationSuccess === "thinking" && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="justify-center items-center flex max-md:h-[90vh] h-full w-full flex-col space-y-3"
          >
            <Thoughts />
          </motion.div>
        )}

        {generationSuccess === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="justify-center items-center flex max-md:h-[90vh] h-full w-full flex-col space-y-3"
          >
            <h3 className="text-sm font-sans font-medium text-white">
              Something went wrong on our end! Please refresh and try again.
            </h3>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Sheet;
