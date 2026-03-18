import { FileEntry } from "@/app/(pages)/projects/[project]/_components/v1/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface ProjectFilesState {
  files: FileEntry | null;
  markdown: string | null;
  filesLoaded: boolean;
  data: object | null;
  fetchedData: Record<string, string> | null;
  currentFile: FileEntry | null;
  selectedFolderPath: string | null;
}

// Interface for updating specific files
interface UpdateSpecificFilePayload {
  filePath: string;
  content: string;
  createDirectories?: boolean;
}

const initialState: ProjectFilesState = {
  files: null,
  markdown: "",
  filesLoaded: false,
  data: null,
  fetchedData: null,
  currentFile: null,
  selectedFolderPath: null,
};

// Helper function to build file tree from flat file map
const buildFileTreeFromData = (
  fileMap: Record<string, string>
): Record<string, any> => {
  const tree: Record<string, any> = {};

  for (const [rawPath, contents] of Object.entries(fileMap)) {
    const parts = rawPath.replace(/^\/+/g, "").split("/");
    let current = tree;

    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      if (isFile) {
        current[part] = { file: { contents } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = current[part].directory;
      }
    });
  }

  return tree;
};

// Helper function to update file in nested tree structure
const updateFileInTree = (
  tree: Record<string, any>,
  pathParts: string[],
  content: string,
  createDirs: boolean = true
): Record<string, any> => {
  const updatedTree = JSON.parse(JSON.stringify(tree)); // Deep clone
  let current = updatedTree;

  // Navigate to the target location
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!current[part]) {
      if (createDirs) {
        current[part] = { directory: {} };
      } else {
        return tree; // Return original if we can't create directories
      }
    }
    current = current[part].directory || current[part];
  }

  // Update or create the file
  const fileName = pathParts[pathParts.length - 1];
  current[fileName] = { file: { contents: content } };

  return updatedTree;
};

const projectFilesSlice = createSlice({
  name: "projectFiles",
  initialState,
  reducers: {
    setprojectFiles: (state, action) => {
      state.files = {
        ...state.files, // Keep existing data
        ...action.payload, // Merge new data on top
      };
    },
    updateprojectFiles: (state, action) => {
      state.files = action.payload;
    },
    setprojectData: (state, action) => {
      state.data = action.payload;
    },
    setFetchedProjectData: (
      state,
      action: PayloadAction<Record<string, string> | null>
    ) => {
      state.fetchedData = action.payload;
    },
    setNewProjectData: (state, action) => {
      state.data = {
        ...state.data, // Keep existing data
        ...action.payload, // Merge new data on top
      };
    },
    updateSpecificFile: (
      state,
      action: PayloadAction<UpdateSpecificFilePayload>
    ) => {
      const { filePath, content, createDirectories = true } = action.payload;

      // Normalize the file path
      const normalizedPath = filePath.replace(/^\/+/, "");
      const pathParts = normalizedPath.split("/").filter(Boolean);

      // Update the data object (flat structure)
      const currentData = (state.data as Record<string, string>) || {};
      const updatedData = {
        ...currentData,
        [normalizedPath]: content,
      };
      state.data = updatedData;

      // Update the file tree structure
      if (state.files && typeof state.files === "object") {
        try {
          // If files is already a tree structure, update it directly
          const updatedTree = updateFileInTree(
            state.files as Record<string, any>,
            pathParts,
            content,
            createDirectories
          );
          state.files = updatedTree as any;
        } catch (error) {
          console.error("Error updating file tree:", error);
          // Fallback: rebuild tree from updated data
          state.files = buildFileTreeFromData(updatedData) as any;
        }
      } else {
        // If no existing tree, build it from the updated data
        state.files = buildFileTreeFromData(updatedData) as any;
      }

      // If this file is currently open, update the current file reference
      if (
        state.currentFile &&
        typeof state.currentFile === "object" &&
        "path" in state.currentFile &&
        (state.currentFile as any).path === normalizedPath
      ) {
        state.currentFile = {
          ...state.currentFile,
          contents: content,
        };
      }
    },
    updateSpecificFilesBatch: (
      state,
      action: PayloadAction<UpdateSpecificFilePayload[]>
    ) => {
      const updates = action.payload || [];
      if (!updates.length) return;

      const currentData = (state.data as Record<string, string>) || {};
      const updatedData = { ...currentData };
      let changed = false;

      updates.forEach(({ filePath, content }) => {
        const normalizedPath = filePath.replace(/^\/+/, "");
        if (!normalizedPath) return;
        if (updatedData[normalizedPath] === content) return;
        updatedData[normalizedPath] = content;
        changed = true;
      });

      if (!changed) return;

      state.data = updatedData;
      state.files = buildFileTreeFromData(updatedData) as any;

      if (
        state.currentFile &&
        typeof state.currentFile === "object" &&
        "path" in state.currentFile
      ) {
        const currentPath = (state.currentFile as any).path;
        if (typeof currentPath === "string" && currentPath in updatedData) {
          state.currentFile = {
            ...state.currentFile,
            contents: updatedData[currentPath],
          };
        }
      }
    },
    setMarkdown: (state, action) => {
      state.markdown += action.payload;
    },
    setCurrentFile: (state, action) => {
      state.currentFile = action.payload;
    },
    setSelectedFolderPath: (state, action) => {
      state.selectedFolderPath = action.payload;
    },
    setEmptyMarkdown: (state, action) => {
      state.markdown = action.payload;
    },
    clearAllFiles: (state) => {
      state.files = null;
      state.data = null;
      state.fetchedData = null;
      state.currentFile = null;
      state.selectedFolderPath = null;
      // Keep filesLoaded and markdown as they might be separate concerns
    },
    EmptySheet: () => initialState,
  },
});

export const {
  updateprojectFiles,
  setprojectData,
  setFetchedProjectData,
  setprojectFiles,
  setMarkdown,
  setEmptyMarkdown,
  setNewProjectData,
  EmptySheet,
  setCurrentFile,
  setSelectedFolderPath,
  updateSpecificFile,
  updateSpecificFilesBatch,
  clearAllFiles,
} = projectFilesSlice.actions;
export default projectFilesSlice.reducer;
