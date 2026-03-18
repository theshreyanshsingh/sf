import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { FileEntry, UIFileEntry } from "../types";
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
import {
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiFile,
  FiFolder,
} from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import { AppDispatch } from "@/app/redux/store";
import {
  setCurrentFile,
  setprojectFiles,
  setprojectData,
  setSelectedFolderPath,
} from "@/app/redux/reducers/projectFiles";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
// TODO: re-wire after webcontainer rewrite
const createFileSystemOperations = (dispatch: any, fileTree: any) => ({
  writeFile: async (_path: string, _content: string | Uint8Array) => false,
  mkdir: async (_path: string, _opts?: { recursive?: boolean }) => false,
  uploadFile: async (_file: File, _destPath: string) => false,
  updateFileTree: () => {},
});
const deleteWebContainerEntry = async (_path: string) => false;
const renameWebContainerEntry = async (_old: string, _new: string, _type?: string) => false;
import FileRenameModal from "../../../../../_modals/FileRenameModal";

interface FileSystemObject {
  directory?: Record<string, FileSystemObject>;
  file?: { contents: string };
}

const processFileTree = (
  obj: Record<string, FileSystemObject>,
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

const normalizeDataPath = (value: string) => value.replace(/^\/+/, "");

const removeFromProjectData = (
  data: Record<string, unknown>,
  targetPath: string,
  isDirectory: boolean
) => {
  const trimmedTarget = normalizeDataPath(targetPath);
  const baseTarget = trimmedTarget.startsWith("workspace/")
    ? trimmedTarget.replace(/^workspace\//, "")
    : trimmedTarget;
  const variants = new Set<string>([baseTarget, `workspace/${baseTarget}`]);

  const nextData: Record<string, unknown> = { ...data };
  for (const key of Object.keys(nextData)) {
    const normalizedKey = normalizeDataPath(key);
    for (const variant of variants) {
      if (normalizedKey === variant) {
        delete nextData[key];
        break;
      }
      if (isDirectory && normalizedKey.startsWith(`${variant}/`)) {
        delete nextData[key];
        break;
      }
    }
  }
  return nextData;
};

const renameInProjectData = (
  data: Record<string, unknown>,
  oldPath: string,
  newPath: string
) => {
  const oldTrim = normalizeDataPath(oldPath);
  const newTrim = normalizeDataPath(newPath);
  const oldBase = oldTrim.startsWith("workspace/")
    ? oldTrim.replace(/^workspace\//, "")
    : oldTrim;
  const newBase = newTrim.startsWith("workspace/")
    ? newTrim.replace(/^workspace\//, "")
    : newTrim;

  const nextData: Record<string, unknown> = { ...data };
  for (const key of Object.keys(nextData)) {
    const normalizedKey = normalizeDataPath(key);
    const hasWorkspace = normalizedKey.startsWith("workspace/");
    const compareKey = hasWorkspace
      ? normalizedKey.replace(/^workspace\//, "")
      : normalizedKey;

    if (compareKey === oldBase || compareKey.startsWith(`${oldBase}/`)) {
      const suffix = compareKey.slice(oldBase.length);
      const nextCompare = `${newBase}${suffix}`;
      const nextKey = hasWorkspace ? `workspace/${nextCompare}` : nextCompare;
      nextData[nextKey] = nextData[key];
      delete nextData[key];
    }
  }
  return nextData;
};

// Context Menu Modal component for right-click actions
interface ContextMenuProps {
  x: number;
  y: number;
  item: UIFileEntry;
  onClose: () => void;
  onDelete: (item: UIFileEntry) => void;
  onRename: (item: UIFileEntry) => void;
  onUpload: (path: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  item,
  onClose,
  onDelete,
  onRename,
  onUpload,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust position if menu would go off screen
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const newPos = { x, y };

      // Adjust for right edge of screen
      if (x + rect.width > window.innerWidth) {
        newPos.x = window.innerWidth - rect.width - 10;
      }

      // Adjust for bottom edge of screen
      if (y + rect.height > window.innerHeight) {
        newPos.y = window.innerHeight - rect.height - 10;
      }

      setPosition(newPos);
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      className="absolute z-50 bg-[#1e1e1e] border border-[#3a3a3a] rounded-md shadow-lg w-48 overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: 1,
        animation: "fadeIn 0.15s ease-in-out",
      }}
    >
      <div className="p-2 bg-[#252525] text-xs text-gray-300 flex justify-between items-center">
        <span className="truncate max-w-[140px]">{item.name}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 p-1 rounded"
        >
          <FiX size={12} />
        </button>
      </div>

      <div className="p-1">
        <button
          className="flex items-center w-full px-3 py-1.5 text-xs text-left hover:bg-[#3a3a3a] rounded"
          onClick={() => {
            onRename(item);
            onClose();
          }}
        >
          <TbEdit className="mr-2" size={14} />
          Rename {item.type === "directory" ? "folder" : "file"}
        </button>

        {item.type === "directory" && (
          <button
            className="flex items-center w-full px-3 py-1.5 text-xs text-left hover:bg-[#3a3a3a] rounded"
            onClick={() => {
              onUpload(item.path);
              onClose();
            }}
          >
            <FiFile className="mr-2" size={14} />
            Upload File
          </button>
        )}

        <button
          className="flex items-center w-full px-3 py-1.5 text-xs text-left text-red-400 hover:bg-[#3a3a3a] rounded"
          onClick={() => {
            onDelete(item);
            onClose();
          }}
        >
          <TbTrash className="mr-2" size={14} />
          Delete {item.type === "directory" ? "folder" : "file"}
        </button>
      </div>
    </div>,
    document.body
  );
};

// Old RenameModal removed - now using FileRenameModal

// Delete Confirmation Modal
interface DeleteConfirmModalProps {
  item: UIFileEntry;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[#121212] rounded-md shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1e1e1e] px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center">
            {item.type === "file" ? (
              <FiFile className="mr-2 text-red-400" size={16} />
            ) : (
              <FiFolder className="mr-2 text-red-400" size={16} />
            )}
            Confirm Delete
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded"
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs font-sans font-medium text-gray-300 mb-4">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">{item.name}</span>?
            {item.type === "directory" && (
              <>
                {" "}
                All contents will be{" "}
                <span className="text-red-500">permanently deleted</span>.
              </>
            )}
          </p>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-[6px] text-xs text-white font-sans font-medium hover:bg-[#2A2A2A] rounded-md transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-[6px] text-xs bg-red-600 cursor-pointer text-white font-sans font-medium rounded-md hover:bg-red-700 transition-colors duration-200"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

const FileExplorer = () => {
  // Redux state and dispatch
  const { files: rawFiles, data: projectData } = useSelector(
    (state: RootState) => state.projectFiles
  );
  const dispatch = useDispatch();

  // Get WebContainer context for all file operations
  const webContainerContext = useWebContainerContext();
  const { webcontainerInstance } = webContainerContext || {};

  const deleteEntry = useCallback(
    (path: string) => deleteWebContainerEntry(path),
    []
  );
  const renameEntry = useCallback(
    (oldPath: string, newPath: string, fileType?: "file" | "directory") =>
      renameWebContainerEntry(oldPath, newPath, fileType),
    []
  );

  // Create file system operations for uploads
  const fileSystemData = useSelector(
    (state: RootState) => state.projectFiles.files
  );

  const fileSystem = useMemo(() => {
    return createFileSystemOperations(
      dispatch as AppDispatch,
      typeof fileSystemData === "object" && fileSystemData !== null
        ? fileSystemData
        : {}
    );
  }, [dispatch, fileSystemData]);

  // Get the currently selected file from Redux store to highlight it
  const currentFile = useSelector(
    (state: RootState) => state.projectFiles.currentFile
  );

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const iconSize = 16;

    switch (extension) {
      case "js":
        return <TbBrandJavascript className="text-gray-400" size={iconSize} />;
      case "jsx":
        return <TbBrandReact className="text-gray-400" size={iconSize} />;
      case "ts":
        return <TbBrandTypescript className="text-gray-400" size={iconSize} />;
      case "tsx":
        return <TbBrandReact className="text-gray-400" size={iconSize} />;
      case "css":
        return <TbBrandCss3 className="text-gray-400" size={iconSize} />;
      case "scss":
      case "sass":
      case "less":
        return <VscRss className="text-gray-400" size={iconSize} />;
      case "html":
      case "htm":
        return <VscFile className="text-gray-400" size={iconSize} />;
      case "json":
        return <LuFileJson className="text-gray-400" size={iconSize} />;
      case "md":
        return <VscMarkdown className="text-gray-400" size={iconSize} />;
      case "svg":
        return <TbFileCode className="text-gray-400" size={iconSize} />;
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
        return <TbPhoto className="text-gray-400" size={iconSize} />;
      default:
        return <TbFileText className="text-gray-400" size={iconSize} />;
    }
  };

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  // Track the currently selected folder (for new file creation)
  const selectedFolderPath = useSelector(
    (state: RootState) => state.projectFiles.selectedFolderPath
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: UIFileEntry | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  // Rename modal state (enhanced with our new modal)
  const [renameModal, setRenameModal] = useState<{
    visible: boolean;
    item: UIFileEntry | null;
  }>({ visible: false, item: null });

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    item: UIFileEntry | null;
  }>({ visible: false, item: null });

  // Effect 1: Set files with correct isOpen state, but do NOT update expandedDirs here
  useEffect(() => {
    if (rawFiles) {
      try {
        // Type guard to check if rawFiles is a Record<string, FileSystemObject>
        const isFileSystemObject = (
          obj: any
        ): obj is Record<string, FileSystemObject> => {
          return (
            obj &&
            typeof obj === "object" &&
            !Array.isArray(obj) &&
            Object.keys(obj).some(
              (key) => obj[key] && (obj[key].directory || obj[key].file)
            )
          );
        };

        let allFiles: UIFileEntry[];

        if (isFileSystemObject(rawFiles)) {
          allFiles = processFileTree(rawFiles);
        } else {
          // If rawFiles is already a FileEntry array, convert it to UIFileEntry
          const fileEntries = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
          allFiles = fileEntries.map((item, index) => ({
            ...item,
            path: item.name, // Use name as path for root level items
            isOpen:
              item.type === "directory"
                ? expandedDirs.has(item.name)
                : undefined,
            children: item.children
              ? (item.children as FileEntry[]).map((child, childIndex) => ({
                  ...child,
                  path: `${item.name}/${child.name}`,
                }))
              : undefined,
          }));
        }

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
      } catch (error) {
        console.error("Error parsing file data:", error);
      }
    }
  }, [rawFiles, expandedDirs]);

  // Effect 2: Prune expandedDirs if directories are deleted, but do NOT depend on expandedDirs
  // useEffect(() => {
  //   if (rawFiles) {
  //     try {
  //       let allFiles = processFileTree(rawFiles);
  //       const collectAllDirPaths = (
  //         items: UIFileEntry[],
  //         paths: Set<string>
  //       ): void => {
  //         items.forEach((item) => {
  //           if (item.type === "directory") {
  //             paths.add(item.path);
  //             if (item.children)
  //               collectAllDirPaths(item.children as UIFileEntry[], paths);
  //           }
  //         });
  //       };
  //       const validDirPaths = new Set<string>();
  //       collectAllDirPaths(allFiles, validDirPaths);
  //       setExpandedDirs((prev) => {
  //         if (prev.size === 0) return prev;
  //         const pruned = new Set([...prev].filter((p) => validDirPaths.has(p)));
  //         return pruned.size === prev.size ? prev : pruned;
  //       });
  //     } catch (error) {
  //       // ignore
  //     }
  //   }
  // }, [rawFiles]);

  const toggleDirectory = (item: FileEntry) => {
    console.log("Toggle directory:", item.name);

    // Find the item in the file tree
    const updatedFiles = [...files] as UIFileEntry[];
    const findAndToggle = (
      items: UIFileEntry[],
      currentPath: string = ""
    ): boolean => {
      for (let i = 0; i < items.length; i++) {
        // Create path for current item
        const itemPath = currentPath
          ? `${currentPath}/${items[i].name}`
          : items[i].name;

        if (
          items[i].name === item.name &&
          items[i].type === "directory" &&
          // If the original item has a path, compare with it
          (!(item as UIFileEntry).path ||
            itemPath === (item as UIFileEntry).path)
        ) {
          // Toggle isOpen property
          items[i] = {
            ...items[i],
            path: itemPath,
            isOpen: items[i].isOpen === undefined ? true : !items[i].isOpen,
          };

          // Update expanded directories set
          const newExpandedDirs = new Set(expandedDirs);
          if (items[i].isOpen) {
            newExpandedDirs.add(itemPath);
          } else {
            newExpandedDirs.delete(itemPath);
          }
          setExpandedDirs(newExpandedDirs);

          return true;
        }

        // Recursively check children - safely handle potentially undefined children
        const children = items[i].children;
        if (children && children.length > 0) {
          // Convert children to UIFileEntry type for recursion
          const typedChildren = children.map((child) => ({
            ...child,
            path: currentPath
              ? `${currentPath}/${items[i].name}/${child.name}`
              : `${items[i].name}/${child.name}`,
          }));

          if (findAndToggle(typedChildren, itemPath)) {
            // Update the children in the original array if a match was found and toggled
            items[i].children = typedChildren;
            return true;
          }
        }
      }
      return false;
    };

    findAndToggle(updatedFiles);
    setFiles(updatedFiles as FileEntry[]);
    console.log("After toggle:", updatedFiles);
  };

  // Handle right click on file/folder
  const handleRightClick = useCallback(
    (e: React.MouseEvent, item: FileEntry) => {
      e.preventDefault();
      e.stopPropagation();

      // Close any existing context menu
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        item: item as UIFileEntry,
      });
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
              : "hover:bg-[#2a2a2a]"
          }`}
          onClick={() => {
            if (item.type === "directory") {
              toggleDirectory(item);
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

  const handleCreateNew = useCallback((type: "file" | "folder") => {
    // Mock implementation for now
    console.log(`Creating new ${type}`);

    // In a real app, this would:
    // 1. Show a popup/modal for naming the new file/folder
    // 2. Create the file/folder in the correct location
    // 3. Update the file tree

    alert(`Create new ${type} functionality would appear here`);
  }, []);

  // Function to delete a file or directory
  const handleDelete = useCallback(
    async (item: UIFileEntry) => {
      console.log(`Deleting ${item.type}: ${(item as UIFileEntry).path}`);

      // Close the confirmation modal
      setDeleteModal({ visible: false, item: null });

      // Check if the current file would be affected by this deletion
      // We need to do this BEFORE updating Redux state to have proper comparison
      let shouldClearEditor = false;

      if (
        currentFile &&
        typeof currentFile === "object" &&
        "path" in currentFile &&
        typeof currentFile.path === "string"
      ) {
        const currentFilePath: string = currentFile.path;
        const deletedItemPath: string = (item as UIFileEntry).path;

        // Case 1: The exact file is being deleted
        const exactFileDeleted: boolean = currentFilePath === deletedItemPath;

        // Case 2: A parent folder containing the current file is being deleted
        // Normalize paths with trailing slashes for proper prefix matching
        const normalizedCurrentPath: string = currentFilePath.endsWith("/")
          ? currentFilePath
          : `${currentFilePath}/`;
        const normalizedDeletedPath: string = deletedItemPath.endsWith("/")
          ? deletedItemPath
          : `${deletedItemPath}/`;
        const folderDeleted: boolean =
          item.type === "directory" &&
          normalizedCurrentPath.startsWith(normalizedDeletedPath);

        shouldClearEditor = exactFileDeleted || folderDeleted;

        if (shouldClearEditor) {
          console.log(
            "File/folder deletion will affect the currently open file:"
          );
          console.log("Current file path:", currentFilePath);
          console.log("Deleted item path:", deletedItemPath);
        }
      }

      // Update file structure in Redux
      if (rawFiles) {
        // Deep clone the rawFiles object to avoid mutating the original
        const newFiles = JSON.parse(JSON.stringify(rawFiles));

        // Find and remove the item from the file structure
        const pathParts = (item as UIFileEntry).path.split("/").filter(Boolean);
        let current = newFiles;

        // Navigate to the parent directory
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (current[pathParts[i]] && current[pathParts[i]].directory) {
            current = current[pathParts[i]].directory;
          } else {
            console.error("Path not found:", (item as UIFileEntry).path);
            return;
          }
        }

        // Delete the item
        const itemName = pathParts[pathParts.length - 1];
        if (current[itemName]) {
          // Actually delete the item from our file structure
          delete current[itemName];

          // IMPORTANT: First clear the editor if needed, then update file structure
          // This ensures correct rendering sequence
          if (shouldClearEditor) {
            console.log(
              "Clearing editor/viewer because the displayed file is being deleted"
            );
            dispatch(setCurrentFile(null));
          }

          // Finally update the project files in Redux
          dispatch(setprojectFiles(newFiles));
          if (projectData && typeof projectData === "object") {
            const updatedData = removeFromProjectData(
              projectData as Record<string, unknown>,
              (item as UIFileEntry).path,
              item.type === "directory"
            );
            dispatch(setprojectData(updatedData));
          }

          // Now perform the actual deletion in WebContainer

          // Perform actual delete in WebContainer
          if (webcontainerInstance) {
            try {
              // Create path for WebContainer API (ensure it starts with '/')
              const fsPath = "/" + (item as UIFileEntry).path;

              // Use recursive option for directories
              const options =
                item.type === "directory" ? { recursive: true } : undefined;

              console.log(
                `Deleting ${item.type} at path: ${fsPath}`,
                options ? "with options" : ""
              );

              // Call the WebContainer delete operation
              const success = await deleteEntry(fsPath);
              if (!success) {
                console.error(`WebContainer deletion failed for ${fsPath}`);
              } else {
                console.log(`Successfully deleted ${item.type} at ${fsPath}`);

                // Extra check: if the deletion was successful but we didn't clear the editor
                // (e.g., if the path comparison failed), force a refresh
                if (
                  currentFile &&
                  typeof currentFile === "object" &&
                  "path" in currentFile &&
                  typeof currentFile.path === "string"
                ) {
                  const filePath: string = currentFile.path.startsWith("/")
                    ? currentFile.path
                    : `/${currentFile.path}`;

                  if (
                    filePath === fsPath ||
                    (item.type === "directory" &&
                      filePath.startsWith(fsPath + "/"))
                  ) {
                    console.log(
                      "Safety check: clearing editor view after WebContainer deletion"
                    );
                    dispatch(setCurrentFile(null));
                  }
                }
              }
            } catch (error) {
              console.error(
                "Error during WebContainer delete operation:",
                error
              );
            }
          }
        }
      }
    },
    [rawFiles, projectData, dispatch, currentFile, webcontainerInstance, deleteEntry]
  );

  // Function to rename a file or directory
  const handleRename = useCallback(
    async (item: UIFileEntry, newName: string) => {
      console.log(`Renaming ${item.type} from "${item.name}" to "${newName}"`);

      // Don't proceed if the name hasn't changed
      if (item.name === newName) return;

      if (rawFiles) {
        // Get file extension to determine if it's a media file
        const fileExt = item.name.split(".").pop()?.toLowerCase();
        const isMediaFile =
          item.type === "file" &&
          ["png", "jpg", "jpeg", "gif", "svg"].includes(fileExt || "");

        // Deep clone the rawFiles object to avoid mutating the original
        const newFiles = JSON.parse(JSON.stringify(rawFiles));

        // Find the item to rename
        const pathParts = (item as UIFileEntry).path.split("/").filter(Boolean);
        let current = newFiles;

        // Navigate to the parent directory
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (current[pathParts[i]] && current[pathParts[i]].directory) {
            current = current[pathParts[i]].directory;
          } else {
            console.error("Path not found:", (item as UIFileEntry).path);
            return;
          }
        }

        // Get the item to rename
        const itemName = pathParts[pathParts.length - 1];
        if (current[itemName]) {
          // For media files, store the content temporarily to ensure we don't lose it
          const fileContent = isMediaFile && current[itemName]?.file?.contents;

          // Create a new entry with the new name
          current[newName] = current[itemName];
          // Delete the old entry
          delete current[itemName];

          // Build the new path
          const pathParts = (item as UIFileEntry).path
            .split("/")
            .filter(Boolean);
          pathParts.pop(); // Remove old filename
          let newPath = "";

          if (pathParts.length > 0) {
            newPath = pathParts.join("/") + "/" + newName;
          } else {
            newPath = newName;
          }

          console.log(`Old path: ${(item as UIFileEntry).path}`);
          console.log(`New path: ${newPath}`);

          // Perform actual rename in WebContainer BEFORE updating the Redux state
          // This ensures the file is already available at the new path when the UI refreshes
          if (webcontainerInstance) {
            try {
              // Create paths for WebContainer API (handle paths carefully)
              const itemPath = (item as UIFileEntry).path;
              // Ensure path starts with a slash
              const oldPath = itemPath.startsWith("/")
                ? itemPath
                : `/${itemPath}`;

              // Get parent directory path
              const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
              // Create new path correctly
              const newPath =
                parentPath === "" ? `/${newName}` : `${parentPath}/${newName}`;

              console.log(
                `WebContainer rename attempt from: ${oldPath} to: ${newPath}`
              );
              console.log(`Item type: ${item.type}`); // Log the type for debugging

              // Pass item type to ensure correct handling based on whether it's a file or directory
              const success = await renameEntry(oldPath, newPath, item.type);

              if (!success) {
                console.error("WebContainer rename operation failed");
                return; // Don't update UI if file operation failed
              } else {
                console.log("WebContainer rename operation succeeded");

                // For media files, ensure the content is properly transferred
                if (isMediaFile && fileContent) {
                  console.log(
                    "Verifying media file content transfer to new path"
                  );
                  // Short delay to ensure file system operations are complete
                  await new Promise((resolve) => setTimeout(resolve, 100));
                }
              }
            } catch (error) {
              console.error(
                "Error during WebContainer rename operation:",
                error
              );
              return; // Don't update UI if file operation failed
            }
          }

          // Now update Redux state after WebContainer operations are complete
          dispatch(setprojectFiles(newFiles));
          if (projectData && typeof projectData === "object") {
            const updatedData = renameInProjectData(
              projectData as Record<string, unknown>,
              (item as UIFileEntry).path,
              newPath
            );
            dispatch(setprojectData(updatedData));
          }

          // If this was the current file, update the current file reference
          if (
            currentFile &&
            item.type === "file" &&
            (currentFile as UIFileEntry).path === (item as UIFileEntry).path
          ) {
            console.log(`Updating current file reference after rename:`);
            console.log(`- Old path: ${(currentFile as UIFileEntry).path}`);
            console.log(`- New path: ${newPath}`);

            // For media files, force refresh by recreating the object more completely
            if (isMediaFile) {
              console.log(
                "Applying special handling for media file display refresh"
              );
              dispatch(
                setCurrentFile({
                  ...currentFile,
                  name: newName,
                  path: newPath,
                  // Add a timestamp to force media component to reload
                  _refreshKey: Date.now(),
                })
              );
            } else {
              dispatch(
                setCurrentFile({
                  ...currentFile,
                  name: newName,
                  path: newPath,
                })
              );
            }
          }
        }
      }
    },
    [rawFiles, projectData, dispatch, currentFile, webcontainerInstance, renameEntry]
  );

  const handleUploadFile = useCallback(
    (targetPath?: string) => {
      // Create a hidden file input
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";

      // Get the target upload path (provided path, selected folder, or root)
      const uploadPath = targetPath || selectedFolderPath || "/";
      console.log(`File will be uploaded to: ${uploadPath}`);

      // Append to DOM
      document.body.appendChild(fileInput);

      // Listen for file selection
      fileInput.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files;

        if (files && files.length > 0) {
          // Use the file system operations to upload the file
          fileSystem
            .uploadFile(files[0], uploadPath)
            .then((success: boolean) => {
              console.log(
                success
                  ? `File "${files[0].name}" uploaded successfully to ${uploadPath}`
                  : `Failed to upload file "${files[0].name}"`
              );
            });
        }

        // Clean up
        document.body.removeChild(fileInput);
      });

      // Trigger file input click
      fileInput.click();
    },
    [selectedFolderPath, fileSystem]
  );

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
      {/* File Tree */}
      <div
        className="p-1 overflow-y-auto flex-grow"
        onClick={handleBackgroundClick}
      >
        {renderFileTree()}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.item && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() =>
            setContextMenu({ visible: false, x: 0, y: 0, item: null })
          }
          onDelete={(item) => {
            setContextMenu({ visible: false, x: 0, y: 0, item: null });
            setDeleteModal({ visible: true, item });
          }}
          onRename={(item) => {
            setContextMenu({ visible: false, x: 0, y: 0, item: null });
            setRenameModal({ visible: true, item });
          }}
          onUpload={(path) => {
            setContextMenu({ visible: false, x: 0, y: 0, item: null });
            handleUploadFile(path);
          }}
        />
      )}

      {/* Rename Modal - Using our new enhanced FileRenameModal component */}
      <FileRenameModal
        isOpen={renameModal.visible}
        item={renameModal.item}
        onClose={() => setRenameModal({ visible: false, item: null })}
        onRename={handleRename}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.visible && deleteModal.item && (
        <DeleteConfirmModal
          item={deleteModal.item}
          onClose={() => setDeleteModal({ visible: false, item: null })}
          onConfirm={() => handleDelete(deleteModal.item!)}
        />
      )}
    </div>
  );
};

export default FileExplorer;
