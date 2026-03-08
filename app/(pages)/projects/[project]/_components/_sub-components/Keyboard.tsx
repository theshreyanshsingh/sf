"use client";

import AttachmentPreview from "@/app/_components/AttachmentPreview";
// import { useGenerateFile } from "@/app/_services/useGenerateFile";
import { API } from "@/app/config/publicEnv";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import {
  addImage,
  addImageURL,
  removeImage,
  removeImageURL,
  setPricingModalOpen,
} from "@/app/redux/reducers/basicData";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import {
  setPendingAttachment,
  setPromptCount,
  setSelectedBlock,
} from "@/app/redux/reducers/projectOptions";
import { RootState } from "@/app/redux/store";
import { NextPage } from "next";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { BsArrowUp } from "react-icons/bs";
import { FaPaperclip, FaChevronDown } from "react-icons/fa6";
import { LuLoaderCircle } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
// import { createStreamableRequest } from "@/app/helpers/useSendRequest";
import { RxLightningBolt } from "react-icons/rx";
import { Meteors } from "@/components/magicui/meteors";
import { useCreateResponse } from "@/app/_services/useCreateResponse";
import { useSettings } from "@/app/helpers/useSettings";

// Add this type definition to match AttachmentPreview.tsx
type AttachmentType = {
  file: File;
  preview: string;
  type: "image" | "video" | "pdf" | "code" | "reference";
  isUploading?: boolean;
  fileType: string;
  previewUrl?: string;
  url: string;
  name: string;
  id: string;
};

const Keyboard: NextPage = () => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const [attachments, setAttachments] = useState<AttachmentType[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowedModels = new Set(["claude-opus-4.6", "claude-sonnet-4.5"]);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("model");
      if (stored && allowedModels.has(stored)) return stored;
      return "claude-sonnet-4.5";
    }
    return "claude-sonnet-4.5";
  });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const path = usePathname();

  const {
    generating,
    promptCount,
    generationSuccess,
    isStreamActive,
    pendingAttachment,
    selectedBlock,
  } = useSelector((state: RootState) => state.projectOptions);
  const { imageURLs, plan } = useSelector((state: RootState) => state.basicData);
  const { chatId } = useSelector((state: RootState) => state.messagesprovider);
  const { data: projectFilesData } = useSelector(
    (state: RootState) => state.projectFiles
  );

  const { workingdirRef } = useWebContainerContext();
  const { createSecondaryResponse } = useCreateResponse();
  const { data: settingsData } = useSettings();

  const modelOptions = [
    { name: "claude-opus-4.6", display: "Claude Opus 4.6", scale: false },
    { name: "claude-sonnet-4.5", display: "Claude Sonnet 4.5", scale: false },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("model");
    if (!stored) {
      sessionStorage.setItem("model", selectedModel);
    }
  }, [selectedModel]);
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelDropdownOpen &&
        modelDropdownRef.current &&
        dropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        console.log("Clicking outside, closing dropdown");
        setModelDropdownOpen(false);
      }
    };

    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modelDropdownOpen]);

  // Handle pending attachment from inspector
  useEffect(() => {
    if (pendingAttachment && projectFilesData) {
      console.log("🔍 Processing pending attachment:", pendingAttachment);
      const { fileName, lineNumber } = pendingAttachment;

      let matchedPath = "";
      let content = "";

      const files = projectFilesData as Record<string, string>;

      // Normalize inspector path: remove volume info, standardize slashes
      const normalizedInspectorPath = fileName
        .replace(/\\/g, "/")
        .toLowerCase();

      // Helper to check if path matches
      const isMatch = (projectPath: string) => {
        const normalizedProjectPath = projectPath
          .replace(/\\/g, "/")
          .toLowerCase();
        // Check if one ends with the other (handling potential leading slashes or relative paths)
        return (
          normalizedInspectorPath.endsWith(normalizedProjectPath) ||
          normalizedProjectPath.endsWith(normalizedInspectorPath)
        );
      };

      // 1. Try exact/suffix match
      if (pendingAttachment.code) {
        // Use the code provided directly by the inspector
        content = pendingAttachment.code;
        matchedPath = pendingAttachment.fileName;
      } else {
        // Fallback to searching for the file content
        const inspectorBasename = normalizedInspectorPath.split("/").pop();
        if (inspectorBasename) {
          for (const [path, fileContent] of Object.entries(files)) {
            if (
              path.toLowerCase().endsWith("/" + inspectorBasename) ||
              path.toLowerCase() === inspectorBasename
            ) {
              matchedPath = path;
              content = fileContent;
              break;
            }
          }

          // If not found by exact match, try fuzzy matching
          if (!matchedPath) {
            const basenameEntry = Object.entries(files).find(
              ([path]) =>
                path.toLowerCase().endsWith("/" + inspectorBasename) ||
                path.toLowerCase() === inspectorBasename
            );
            if (basenameEntry) {
              matchedPath = basenameEntry[0];
              content = basenameEntry[1];
            }
          }
        }
      }

      if (matchedPath && content) {
        console.log("✅ File matched:", matchedPath);
        // Use provided endLine or estimate it
        let endLine = pendingAttachment.endLine;

        if (!endLine) {
          // Estimate end line by counting braces if not provided
          endLine = lineNumber;
          try {
            const lines = content.split("\n");
            // Start from the start line (1-indexed to 0-indexed)
            let currentLine = Math.max(0, lineNumber - 1);
            let openBraces = 0;
            let foundStart = false;

            const maxLines = lines.length;

            // Simple brace counting
            for (let i = currentLine; i < maxLines; i++) {
              const line = lines[i];
              for (let char of line) {
                if (char === "{") {
                  openBraces++;
                  foundStart = true;
                } else if (char === "}") {
                  openBraces--;
                }
              }

              // If we found the start and braces are balanced back to 0, we found the end
              if (foundStart && openBraces === 0) {
                endLine = i + 1;
                break;
              }
            }

            // Fallback if no block found: take 20 lines
            if (!foundStart || endLine === lineNumber) {
              endLine = Math.min(lineNumber + 20, lines.length);
            }
          } catch (e) {
            console.error("Error estimating end line:", e);
          }
        }

        // Create attachment object
        const attachment: AttachmentType = {
          file: new File([content], matchedPath, { type: "text/plain" }),
          preview: content, // Use the content (code) as preview
          type: "code",
          fileType: "text/plain",
          url: "", // Not used for code references
          name: matchedPath,
          id: Date.now().toString(),
          // label: `${matchedPath}:${lineNumber}-${endLine}`, // Add label for display if supported
        };

        setAttachments((prev) => {
          // if (prev.some((a) => a.label === attachment.label)) return prev;
          return [...prev, attachment];
        });
      } else {
        console.warn("⚠️ File not found for path:", fileName);
        // Fallback: just append text if file not found
        const attachmentText = ` @${fileName.split("/").pop()}:${lineNumber} `;
        setMessage((prev) => {
          if (prev.endsWith(attachmentText.trim())) return prev;
          return prev + attachmentText;
        });
      }

      // Clear the pending attachment
      dispatch(setPendingAttachment(null));

      // Focus the textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
          }
        }, 0);
      }
    }
  }, [pendingAttachment, projectFilesData, dispatch]);

  const getProjectId = useCallback(() => {
    const segments = path.split("/");
    const id = segments[2] || "";
    return id;
  }, [path]);

  const sendAgentMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (isStreamActive) return;
      if (!message.trim()) return;

      try {
        if (typeof promptCount === "number" && promptCount > 0) {
          dispatch(setPromptCount(promptCount - 1));
        }

        setAttachments([]);

        setMessage("");
        const projectId = getProjectId();

        // const term = JSON.stringify({
        //   terminal: {
        //     currentDir: workingdirRef.current,
        //   },
        // });

        await createSecondaryResponse({
          input: message,
          attachments: attachments,
          projectId,
          email: email.value as string,
          chatId: chatId || undefined,
          model: selectedModel,
          save: true,
          blockContext: selectedBlock || undefined,
          blockMode: selectedBlock ? "strict" : "agent",
        });

        setAttachments([]);
        setMessage("");
      } catch (err) {
        console.error("Agent error:", err);
      }

      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    },
    [
      message,
      imageURLs,
      dispatch,
      promptCount,
      getProjectId,
      workingdirRef,
      createSecondaryResponse,
      email.value,
      chatId,
      selectedModel,
      attachments,
      selectedBlock,
      isStreamActive,
    ]
  );

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  function encodeImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Limit to 2 attachments
      if (attachments.length >= 2) {
        alert("You can only attach up to 2 files");
        return;
      }

      const newFile = files[0];

      // Validate file type
      const validImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
      ];
      const isValidType = validImageTypes.includes(newFile.type);

      if (!isValidType && attachments.length < 2) {
        alert("Please upload only images.");
        return;
      }

      // Generate a unique file name
      const uniqueFileName = `upload_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // Show loading state
      setAttachments((prev) => [
        ...prev,
        {
          file: newFile,
          preview: "",
          type: "image",
          isUploading: true,
          name: uniqueFileName,
          fileType: newFile.type,
          url: "",
          id: uniqueFileName,
        },
      ]);

      // Upload to S3 or server
      const uploadedUrl = await getPresignedUrl(newFile, uniqueFileName);
      if (!uploadedUrl) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: "Error uploading!",
          })
        );
        return;
      }

      dispatch(addImageURL(uploadedUrl));

      // Convert image to Base64
      const base64Image = await encodeImageToBase64(newFile);
      dispatch(addImage(base64Image));

      // Create preview URL
      const filePreview = URL.createObjectURL(newFile);

      // Update attachment list (remove loading state & add URL)
      setAttachments((prev) =>
        prev.map((att) =>
          att.file === newFile
            ? {
                ...att,
                preview: filePreview,
                isUploading: false,
                url: uploadedUrl,
              }
            : att
        )
      );
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      // Reset file input
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];

      // Remove from Redux using index
      dispatch(removeImage(index));
      dispatch(removeImageURL(index));

      // Revoke object URL to free memory
      if (newAttachments[index]?.preview) {
        URL.revokeObjectURL(newAttachments[index].preview);
      }

      // Remove the attachment from state
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const getPresignedUrl = async (file: File, name: string): Promise<string> => {
    try {
      const response = await fetch(`${API}/get-presigned-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: name,
          fileType: file.type,
          email: email.value,
        }),
      });

      const { uploadURL, url } = await response.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      return url;
    } catch (error) {
      console.error("Upload failed:", error);
      throw new Error("Failed to get presigned URL");
    }
  };

  const handleAttachClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const effectivePlan = settingsData?.plan || plan;
  const promptCountFromProject =
    typeof promptCount === "number" ? promptCount : null;
  const promptCountFromSettings =
    typeof settingsData?.remainingPrompts === "number"
      ? settingsData.remainingPrompts
      : null;
  const effectivePromptCount = promptCountFromProject ?? promptCountFromSettings;
  const hasQuotaToSend =
    typeof effectivePromptCount === "number" ? effectivePromptCount > 0 : true;
  const isLocalDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");
  const shouldShowUpgrade = !hasQuotaToSend && !isLocalDev;

  return (
    <form
      name="keyboard"
      onSubmit={sendAgentMessage}
      className="flex flex-col items-start justify-between rounded-lg space-y-3"
    >
      <Meteors />
      {shouldShowUpgrade && (
        <div className="flex justify-center items-center w-full bg-[#1c1c1d] border border-[#2a2a2b] p-2 rounded-lg">
          <p className="text-xs font-sans font-medium text-[#b1b1b1] text-center">
            {effectivePlan === "free"
              ? "You have used all 5 free prompts. Upgrade to Scale for 100 messages."
              : "You have used all 100 Scale messages for this billing cycle."}
          </p>
        </div>
      )}
      {/* Main Input Container */}
      <div className=" relative rounded-lg flex flex-col items-start justify-center shadow-lg min-h-[120px] w-full ">
        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />

        {selectedBlock && (
          <div className="w-full flex items-center justify-between bg-[#1c1c1d] border border-[#2a2a2b] rounded-md px-3 py-2 text-xs text-[#c5c5cb] mb-2">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2]">
                Edit Block
              </span>
              <span className="text-xs text-white">{selectedBlock.id}</span>
              {selectedBlock.page && (
                <span className="text-[10px] text-[#8b8b90]">
                  {selectedBlock.page}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => dispatch(setSelectedBlock(null))}
              className="text-[10px] text-[#9b9ba3] hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        {/* Text Area (Auto-Expanding) */}
        <textarea
          maxLength={10000}
          // disabled={(promptCount as number) < 1}
          ref={textareaRef}
          className="flex-1 bg-transparent outline-none text-white w-full p-1 text-sm resize-none overflow-y-auto rounded-lg min-h-[60px] max-h-[150px]"
          placeholder="Ask Agent to change anything..."
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && !e.shiftKey && !isStreamActive) {
              e.preventDefault();

              if (!hasQuotaToSend && !isLocalDev) {
                dispatch(setPricingModalOpen(true));
              } else {
                if (message.trim()) {
                  sendAgentMessage(e);
                }
              }
            }
          }}
          onInput={adjustTextareaHeight}
        />

        {/* Action Buttons */}
        <div className="justify-between items-center flex w-full mt-3">
          <div className="flex items-center gap-2">
            {/* Model Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const rect = e.currentTarget.getBoundingClientRect();
                  setDropdownPosition({
                    top: rect.top - 100, // Position dropdown above button but not too high
                    left: rect.left,
                  });
                  setModelDropdownOpen(!modelDropdownOpen);
                }}
                className="cursor-pointer text-[#b1b1b1] hover:bg-[#2a292c] px-3 py-1.5 rounded-full text-xs font-sans font-medium gap-x-1 flex justify-center items-center transition-colors min-w-[70px]"
              >
                <span className="truncate">
                  {modelOptions.find((option) => option.name === selectedModel)
                    ?.display || selectedModel}
                </span>
                <FaChevronDown
                  className={`transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Dropdown Portal */}
            {modelDropdownOpen && (
              <div
                ref={dropdownRef}
                className="fixed w-48 bg-[#2a292c] border border-[#2a2a2b] rounded-md shadow-xl max-h-50 overflow-y-auto"
                style={{
                  zIndex: 999999,
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {modelOptions.map((model) => (
                  <button
                    key={model.name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Mouse down on model:", model);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      setSelectedModel(model.name);
                      sessionStorage.setItem("model", model.name);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-sans font-medium transition-colors hover:bg-[#1a1a1b] cursor-pointer flex flow-row justify-between items-center ${
                      selectedModel === model.name
                        ? "text-white bg-[#1c1c1d]"
                        : "text-[#71717A]"
                    }`}
                  >
                    {model.display}
                    {model.scale && (
                      <span className="bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] font-sans text-white flex flex-row justify-center items-center rounded-md px-2 space-x-1">
                        Scale
                        <RxLightningBolt />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upgrade/Send msgs */}
          {shouldShowUpgrade ? (
            <motion.button
              type="button"
              onClick={() => {
                dispatch(setPricingModalOpen(true));
              }}
              className="justify-center items-center flex font-sans py-1 gap-x-1 font-medium text-white bg-[#4a90e2] rounded-md hover:bg-[#5ba0f2] text-xs border border-[#4a90e2] cursor-pointer px-2 p-1"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Upgrade to Scale
            </motion.button>
          ) : (
            <div className="justify-center items-center flex space-x-2">
              {/* Attach Icon */}
              <button
                onClick={handleAttachClick}
                disabled={!!isStreamActive}
                type="button"
                className="cursor-pointer p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center transition-colors text-[#b1b1b1] hover:bg-[#2a292c]"
                title="Attach image"
              >
                <FaPaperclip />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Send Button */}
              <button
                disabled={!!isStreamActive}
                type="button"
                onClick={sendAgentMessage}
                className="cursor-pointer hover:bg-gray-200 text-[#71717A]  p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center"
              >
                {isStreamActive ? (
                  <LuLoaderCircle className="text-sm animate-spin" />
                ) : (
                  <BsArrowUp className="text-sm" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default Keyboard;
