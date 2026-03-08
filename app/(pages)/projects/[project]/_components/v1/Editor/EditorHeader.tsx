"use client";

import React, { useState, useEffect } from "react";
import { BiArrowToRight } from "react-icons/bi";
import { LuFileJson } from "react-icons/lu";
import {
  TbBrandCss3,
  TbBrandJavascript,
  TbBrandReact,
  TbBrandTypescript,
  TbFileCode,
  TbFileText,
  TbPhoto,
} from "react-icons/tb";
import {
  VscFile,
  VscChevronRight,
  VscRss,
  VscMarkdown,
  VscCheck,
} from "react-icons/vsc";
import { IoFolderOpenOutline } from "react-icons/io5";

interface BreadcrumbItem {
  name: string;
  path: string;
  type: "folder" | "file";
}

interface EditorHeaderProps {
  currentFilePath?: string;
  onNavigate?: (path: string) => void;
  onSave?: () => void;
  isSaved?: boolean; // New prop to indicate if file was just saved
}

export default function EditorHeader({
  currentFilePath,
  onNavigate,
  onSave,
  isSaved = false,
}: EditorHeaderProps) {
  // Local state to handle save animation
  const [showSaved, setShowSaved] = useState(false);

  // Effect to handle displaying the saved checkmark and reverting back
  useEffect(() => {
    if (isSaved) {
      setShowSaved(true);

      // Set timeout to revert to "Save" button after 3 seconds
      const timeout = setTimeout(() => {
        setShowSaved(false);
      }, 3000);

      // Cleanup timeout
      return () => clearTimeout(timeout);
    }
  }, [isSaved]);

  // If no file is open, show a default message
  if (!currentFilePath) {
    return null;
  }

  let pathParts: string[] = [];

  if (currentFilePath.includes("/")) {
    // Regular path with slashes - split normally
    pathParts = currentFilePath.split("/").filter(Boolean);
  } else {
    // If it's just a filename without path, don't add fake folders
    // Just show the filename as is
    pathParts = [currentFilePath];
  }

  // Create breadcrumb items with proper paths for navigation
  const breadcrumbs: BreadcrumbItem[] = pathParts.map((part, index) => {
    // Reconstruct path for navigation
    const path = "/" + pathParts.slice(0, index + 1).join("/");
    const isLastItem = index === pathParts.length - 1;

    return {
      name: part,
      path,
      type: isLastItem ? "file" : "folder",
    };
  });

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    const iconSize = 14;

    switch (extension) {
      case "js":
        return (
          <TbBrandJavascript className="text-gray-400 mr-1" size={iconSize} />
        );
      case "jsx":
        return <TbBrandReact className="text-gray-400 mr-1" size={iconSize} />;
      case "ts":
        return (
          <TbBrandTypescript className="text-gray-400 mr-1" size={iconSize} />
        );
      case "tsx":
        return <TbBrandReact className="text-gray-400 mr-1" size={iconSize} />;
      case "css":
        return <TbBrandCss3 className="text-gray-400 mr-1" size={iconSize} />;
      case "scss":
      case "sass":
      case "less":
        return <VscRss className="text-gray-400 mr-1" size={iconSize} />;
      case "html":
      case "htm":
        return <VscFile className="text-gray-400 mr-1" size={iconSize} />;
      case "json":
        return <LuFileJson className="text-gray-400 mr-1" size={iconSize} />;
      case "md":
        return <VscMarkdown className="text-gray-400 mr-1" size={iconSize} />;
      case "svg":
        return <TbFileCode className="text-gray-400 mr-1" size={iconSize} />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
        return <TbPhoto className="text-gray-400 mr-1" size={iconSize} />;
      default:
        return <TbFileText className="text-gray-400 mr-1" size={iconSize} />;
    }
  };

  return (
    <div className="h-7 flex-1 flex items-center justify-between px-3 text-sm ">
      {/* Left side - Path */}
      <div className="justify-start items-center flex overflow-x-auto no-scrollbar">
        <span className="border-r border-[#2a2a2a] mr-2" />

        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.path}>
            {index > 0 && (
              <VscChevronRight className="text-[#3A4148]" size={14} />
            )}

            <button
              className={`flex items-center px-1.5 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors ${
                index === breadcrumbs.length - 1
                  ? "text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              onClick={() => onNavigate?.(item.path)}
            >
              {item.type === "folder" ? (
                <IoFolderOpenOutline className="mr-1 text-gray-400" size={14} />
              ) : (
                getFileIcon(item.name)
              )}
              <span className="text-xs font-sans font-normal truncate max-md:max-w-[100px] block">
                {item.name}
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center">
        <button
          className="flex items-center px-2 py-0.5 rounded hover:bg-[#2a2a2a] transition-colors hover:text-white"
          onClick={onSave}
          title="Save (Ctrl+S or Cmd+S)"
        >
          {showSaved ? (
            <span className="text-xs font-sans font-medium text-white flex items-center">
              <VscCheck size={14} className="mr-1" />
              Saved
            </span>
          ) : (
            <span className="text-xs font-sans font-medium text-gray-300">
              Save
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
