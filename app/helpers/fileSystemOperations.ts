import { WebContainer } from "@webcontainer/api";
import { UIFileEntry } from "../(pages)/projects/[project]/_components/v1/types";
import { setprojectFiles } from "../redux/reducers/projectFiles";
import { AppDispatch } from "../redux/store";

interface FileSystemOperations {
  writeFile: (
    path: string,
    content: string,
    encoding?: { encoding: string }
  ) => Promise<boolean>;
  mkdir: (path: string, options?: { recursive: boolean }) => Promise<boolean>;
  uploadFile: (file: File, targetPath: string) => Promise<boolean>;
  updateFileTree: (newFile: UIFileEntry) => void;
}

/**
 * Creates file system operations for WebContainer integration
 */
export const createFileSystemOperations = (
  webcontainerInstance: WebContainer,
  dispatch: AppDispatch,
  fileTree: Record<string, any>
): FileSystemOperations => {
  // Track last update to prevent redundant updates
  let lastUpdatePath: string | null = null;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE_MS = 100; // Minimum time between updates

  /**
   * Updates the Redux store with the new file entry
   */
  const updateFileTree = (newFile: UIFileEntry) => {
    try {
      // Skip redundant updates to the same path in quick succession
      const now = Date.now();
      if (
        lastUpdatePath === newFile.path &&
        now - lastUpdateTime < UPDATE_THROTTLE_MS
      ) {
        console.log(`Skipping redundant update to ${newFile.path}`);
        return;
      }

      // Update tracking variables
      lastUpdatePath = newFile.path;
      lastUpdateTime = now;

      // Create a completely new object instead of trying to modify the existing one
      // This avoids issues with read-only properties
      let newFileSystem: Record<string, any> = {};

      // First, make a deep copy of the existing tree if it exists
      if (fileTree && typeof fileTree === "object") {
        // Deep clone using JSON parse/stringify to break all references
        try {
          newFileSystem = JSON.parse(JSON.stringify(fileTree));
        } catch (error) {
          console.error("Error cloning file tree:", error);
          newFileSystem = {};
        }
      }

      // Add the new file to the appropriate location
      if (newFile.path && newFile.path.includes("/")) {
        const pathParts = newFile.path.split("/").filter(Boolean);

        // If we need to add a file deep in the structure
        if (pathParts.length > 1) {
          // Create a recursive function to navigate and create the path
          const addToPath = (
            obj: Record<string, any>,
            parts: string[],
            depth: number
          ): Record<string, any> => {
            // If we've reached the end of the path, add the file/directory
            if (depth === parts.length - 1) {
              const result = { ...obj };
              if (newFile.type === "file") {
                result[parts[depth]] = {
                  file: {
                    contents: newFile.contents || "",
                  },
                };
              } else {
                result[parts[depth]] = {
                  directory: {},
                };
              }
              return result;
            }

            // Otherwise, continue building the path
            const currentPart = parts[depth];
            const newObj = { ...obj };

            // If the path doesn't exist yet, create it
            if (!newObj[currentPart]) {
              newObj[currentPart] = {
                directory: {},
              };
            }

            // Clone the existing directory to avoid modifying it directly
            const clonedDirectory = { ...newObj[currentPart].directory };

            // Recursively build the next level
            newObj[currentPart] = {
              ...newObj[currentPart],
              directory: addToPath(clonedDirectory, parts, depth + 1),
            };

            return newObj;
          };

          // Start the recursive path building
          newFileSystem = addToPath(newFileSystem, pathParts, 0);
        } else {
          // Just adding to the root level
          const fileName = pathParts[0];
          if (newFile.type === "file") {
            newFileSystem[fileName] = {
              file: {
                contents: newFile.contents || "",
              },
            };
          } else {
            newFileSystem[fileName] = {
              directory: {},
            };
          }
        }
      } else {
        // Root level file/directory with no path or simple name
        if (newFile.type === "file") {
          newFileSystem[newFile.name] = {
            file: {
              contents: newFile.contents || "",
            },
          };
        } else {
          newFileSystem[newFile.name] = {
            directory: {},
          };
        }
      }

      // Update Redux state with the new file system
      // Wrap in setTimeout to break potential render cycles
      setTimeout(() => {
        dispatch(setprojectFiles(newFileSystem));
      }, 0);
      return true;
    } catch (error) {
      console.error("Error updating file tree:", error);
      return false;
    }
  };

  /**
   * Writes content to a file
   */
  const writeFile = async (
    path: string,
    content: string,
    encoding?: { encoding: string }
  ): Promise<boolean> => {
    try {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      // Write the file using WebContainer API
      await webcontainerInstance.fs.writeFile(path, content, encoding);

      // Create file entry for Redux update
      const pathParts = path.split("/").filter(Boolean);
      const fileName = pathParts[pathParts.length - 1];

      const newFile: UIFileEntry = {
        name: fileName,
        type: "file",
        contents: content,
        path: path,
      };

      // Update Redux state
      updateFileTree(newFile);

      console.log(`File written successfully: ${path}`);
      return true;
    } catch (error) {
      console.error(`Error writing file ${path}:`, error);
      return false;
    }
  };

  /**
   * Creates a directory
   */
  const mkdir = async (
    path: string,
    options?: { recursive: boolean }
  ): Promise<boolean> => {
    try {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      // Create directory using WebContainer API with proper typing
      if (options?.recursive) {
        await webcontainerInstance.fs.mkdir(path, { recursive: true });
      } else {
        await webcontainerInstance.fs.mkdir(path);
      }

      // Create directory entry for Redux update
      const pathParts = path.split("/").filter(Boolean);
      const dirName = pathParts[pathParts.length - 1];

      const newDir: UIFileEntry = {
        name: dirName,
        type: "directory",
        path: path,
        children: [],
      };

      // Update Redux state
      updateFileTree(newDir);

      console.log(`Directory created successfully: ${path}`);
      return true;
    } catch (error) {
      console.error(`Error creating directory ${path}:`, error);
      return false;
    }
  };

  /**
   * Uploads a file by reading its contents and writing to the file system
   */
  const uploadFile = async (
    file: File,
    targetPath: string
  ): Promise<boolean> => {
    try {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      // Calculate the full path including filename
      const fullPath = targetPath.endsWith("/")
        ? `${targetPath}${file.name}`
        : `${targetPath}/${file.name}`;

      // Extract directory path from the full path
      const pathParts = fullPath.split("/");
      pathParts.pop(); // Remove filename
      const dirPath = pathParts.join("/");

      // Always create parent directories recursively to ensure they exist
      if (dirPath) {
        try {
          console.log(`Ensuring parent directories exist: ${dirPath}`);
          // Create parent directories with recursive option
          await mkdir(dirPath, { recursive: true });
        } catch (dirError) {
          console.error(
            `Error creating parent directories: ${dirPath}`,
            dirError
          );
          return false;
        }
      }

      // For binary files like images, we need to handle them differently
      if (
        file.type.startsWith("image/") ||
        file.type.startsWith("application/") ||
        file.name.endsWith(".pdf") ||
        file.name.endsWith(".png") ||
        file.name.endsWith(".jpg") ||
        file.name.endsWith(".jpeg") ||
        file.name.endsWith(".gif")
      ) {
        try {
          // Read file as ArrayBuffer for binary files
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await webcontainerInstance.fs.writeFile(fullPath, uint8Array);

          // Create file entry for Redux update
          const fileName = file.name;
          const newFile: UIFileEntry = {
            name: fileName,
            type: "file",
            contents: "[binary data]", // Placeholder for binary content
            path: fullPath,
          };

          // Update Redux state
          updateFileTree(newFile);
          console.log(`Binary file written successfully: ${fullPath}`);
          return true;
        } catch (binaryError) {
          console.error(`Error writing binary file ${fullPath}:`, binaryError);
          return false;
        }
      } else {
        // Handle text files with the existing approach
        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });

        // Write file using our writeFile function
        return await writeFile(fullPath, content);
      }
    } catch (error) {
      console.error(`Error uploading file to ${targetPath}:`, error);
      return false;
    }
  };

  return {
    writeFile,
    mkdir,
    uploadFile,
    updateFileTree,
  };
};
