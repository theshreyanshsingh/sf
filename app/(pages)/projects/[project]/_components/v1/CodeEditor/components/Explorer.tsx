"use client";
import { RootState } from "@/app/redux/store";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FileEntry, UIFileEntry } from "../../types";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import {
  TbBrandCss3,
  TbBrandJavascript,
  TbBrandReact,
  TbBrandTypescript,
  TbFileCode,
  TbFileText,
  TbPhoto,
  TbTrash,
  TbEdit,
} from "react-icons/tb";
import { VscFile, VscMarkdown, VscRss } from "react-icons/vsc";
import { LuFileJson } from "react-icons/lu";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import {
  setCurrentFile,
  setSelectedFolderPath,
} from "@/app/redux/reducers/projectFiles";

// processing file tree
const processFileTree = (
  obj: Record<string, any>,
  path: string = ""
): UIFileEntry[] => {
  const result: UIFileEntry[] = [];

  Object.keys(obj).forEach((key) => {
    const currentPath = path ? `${path}/${key}` : key;
    if (obj[key].directory) {
      const dirEntry: UIFileEntry = {
        name: key,
        type: "directory",
        children: [],
        path: currentPath,
      };
      result.push(dirEntry);
      dirEntry.children = processFileTree(
        obj[key].directory,
        currentPath
      ) as FileEntry[];
    } else if (obj[key].file) {
      result.push({
        name: key,
        type: "file",
        contents: obj[key].file.contents,
        path: currentPath,
      } as UIFileEntry);
    }
  });

  return result;
};

//getting file icons
const getFileIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const iconSize = 16;

  switch (extension) {
    case "js":
      return <TbBrandJavascript className="text-yellow-300" size={iconSize} />;
    case "jsx":
      return <TbBrandReact className="text-blue-400" size={iconSize} />;
    case "ts":
      return <TbBrandTypescript className="text-blue-500" size={iconSize} />;
    case "tsx":
      return <TbBrandReact className="text-blue-500" size={iconSize} />;
    case "css":
      return <TbBrandCss3 className="text-blue-400" size={iconSize} />;
    case "scss":
    case "sass":
    case "less":
      return <VscRss className="text-purple-400" size={iconSize} />;
    case "html":
    case "htm":
      return <VscFile className="text-orange-400" size={iconSize} />;
    case "json":
      return <LuFileJson className="text-yellow-300" size={iconSize} />;
    case "md":
      return <VscMarkdown className="text-blue-300" size={iconSize} />;
    case "svg":
      return <TbFileCode className="text-green-400" size={iconSize} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
      return <TbPhoto className="text-green-400" size={iconSize} />;
    default:
      return <TbFileText className="text-gray-400" size={iconSize} />;
  }
};

const Explorer = () => {
  const { files: rawFiles, currentFile } = useSelector(
    (state: RootState) => state.projectFiles
  );

  const dispatch = useDispatch();

  const { webcontainerInstance } = useWebContainerContext();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileEntry[]>([]);

  useEffect(() => {
    if (rawFiles) {
      try {
        let allFiles = processFileTree(rawFiles);

        // Effect 1: Set files with correct isOpen state, but do NOT update expandedDirs here
        const setIsOpenRecursive = (items: UIFileEntry[]): UIFileEntry[] => {
          return items.map((item) => {
            if (item.type === "directory") {
              const isOpen = expandedDirs.has(item.path);
              let children = item.children || [];
              return {
                ...item,
                isOpen,
                children: setIsOpenRecursive(children as UIFileEntry[]),
              };
            }
            return item;
          });
        };
        allFiles = setIsOpenRecursive(allFiles);
        setFiles(allFiles);

        // Effect 2: Prune expandedDirs if directories are deleted, but do NOT depend on expandedDirs
        const collectAllDirPaths = (
          items: UIFileEntry[],
          paths: Set<string>
        ): void => {
          items.forEach((item) => {
            if (item.type === "directory") {
              paths.add(item.path);
              if (item.children)
                collectAllDirPaths(item.children as UIFileEntry[], paths);
            }
          });
        };
        const validDirPaths = new Set<string>();
        collectAllDirPaths(allFiles, validDirPaths);
        setExpandedDirs((prev) => {
          if (prev.size === 0) return prev;
          const pruned = new Set([...prev].filter((p) => validDirPaths.has(p)));
          return pruned.size === prev.size ? prev : pruned;
        });
      } catch (error) {
        console.error("Error parsing file data:", error);
      }
    }
  }, [rawFiles, expandedDirs]);

  const handleRightClick = useCallback(
    (e: React.MouseEvent, item: FileEntry) => {
      e.preventDefault();
      e.stopPropagation();

      // Close any existing context menu
      //   setContextMenu({
      //     visible: true,
      //     x: e.clientX,
      //     y: e.clientY,
      //     item: item as UIFileEntry,
      //   });
    },
    []
  );

  const renderFileTree = (items: FileEntry[] = files, level = 0) => {
    return items.map((item, index) => (
      <div
        key={index}
        className="relative"
        style={{
          marginLeft: `${level * 12}px`,
        }}
        onContextMenu={(e) => handleRightClick(e, item)}
      >
        {/* Vertical line */}
        {level > 0 && (
          <span
            className="absolute left-[-6.5px] top-0 bottom-0 border-l border-[#222121]"
            style={{ width: 0 }}
          />
        )}

        <div
          className={`flex items-center py-1.5 rounded cursor-pointer transition-colors duration-150 ${
            // Apply bg color to the currently selected file
            currentFile &&
            item.type === "file" &&
            currentFile.name === item.name &&
            // For path comparison, handle both with UIFileEntry and regular FileEntry
            (("path" in currentFile &&
              "path" in item &&
              currentFile.path === (item as UIFileEntry).path) ||
              (!("path" in currentFile) &&
                !("path" in item) &&
                currentFile.name === item.name))
              ? "bg-[#2a2a2a]"
              : "hover:bg-[#212121]"
          }`}
          onClick={() => {
            if (item.type === "directory") {
              //   toggleDirectory(item);
              dispatch(setSelectedFolderPath((item as UIFileEntry).path));
            } else {
              // Only dispatch if not already current
              const currentPath = (currentFile as UIFileEntry)?.path;
              const itemPath = (item as UIFileEntry)?.path;
              if (itemPath && currentPath !== itemPath) {
                dispatch(setCurrentFile(item));
              }
              dispatch(setSelectedFolderPath(null));
            }
          }}
        >
          {/* Chevron Icon */}
          <span className="mr-1.5">
            {item.type === "directory" ? (
              (item as UIFileEntry).isOpen ? (
                <FiChevronDown className="text-gray-600" />
              ) : (
                <FiChevronRight className="text-gray-600" />
              )
            ) : null}
          </span>

          {/* File Icon */}
          {item.type !== "directory" && (
            <span className="mr-2 text-xs font-sans font-normal  text-white">
              {getFileIcon(item.name)}
            </span>
          )}

          {/* File/Folder Name */}
          <span className="text-xs truncate font-sans font-normal  text-white">
            {item.name}
          </span>
        </div>

        {/* Recursive Children */}
        {item.type === "directory" &&
          (item as UIFileEntry).isOpen &&
          item.children && (
            <div className="animate-fadeIn">
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
      </div>
    ));
  };

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // Only handle direct clicks on the container, not on file/folder items
      if (e.target === e.currentTarget) {
        console.log(
          "Empty space clicked in file explorer, selecting root path"
        );
        // Select the root path when clicking on empty space
        dispatch(setSelectedFolderPath("/"));
      }
    },
    [dispatch]
  );

  return (
    <div className="bg-[#141415] text-white h-full overflow-y-auto flex flex-col border-r border-[#2a2a2a]">
      <div
        className="p-1 overflow-y-auto flex-grow"
        onClick={handleBackgroundClick}
      >
        {renderFileTree()}
      </div>
    </div>
  );
};

export default Explorer;
