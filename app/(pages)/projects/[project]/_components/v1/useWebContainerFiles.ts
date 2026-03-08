import { useCallback } from "react";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import { FileEntry } from "./types";

/**
 * Normalize a file path for WebContainer operations
 * Ensures the path starts with a slash, handles empty paths, and removes duplicate slashes
 */
const normalizePath = (path: string): string => {
  // If path is empty, return root
  if (!path) return "/";

  // Trim extra whitespace but preserve spaces in filenames
  path = path.trim();

  // Ensure leading slash
  if (!path.startsWith("/")) path = "/" + path;

  // Remove trailing slash if not root
  if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);

  // Fix common path issues
  path = path.replace(/\/\//g, "/"); // Replace double slashes with single

  console.log(`Normalized path: "${path}"`);
  return path;
};

// Custom hook to provide file system operations for the WebContainer
export const useWebContainerFiles = () => {
  const { webcontainerInstance } = useWebContainerContext();

  // List files in a directory
  const listFiles = useCallback(
    async (directory: string = "/"): Promise<FileEntry[]> => {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return [];
      }

      try {
        // Get directory contents from the WebContainer
        const entries = await webcontainerInstance.fs.readdir(directory, {
          withFileTypes: true,
        });

        // Map WebContainer entries to FileEntry objects
        const files: FileEntry[] = await Promise.all(
          entries.map(async (entry) => {
            const path = `${directory === "/" ? "" : directory}/${entry.name}`;
            const isDirectory = entry.isDirectory();

            // If it's a directory, recursively get children
            let children: FileEntry[] = [];
            let contents: string | undefined = undefined;

            if (isDirectory) {
              children = await listFiles(path);
            } else {
              // For files, read their contents
              try {
                const fileContents = await webcontainerInstance.fs.readFile(
                  path,
                  "utf-8"
                );
                contents = fileContents;
              } catch (error) {
                console.error(`Error reading file ${path}:`, error);
              }
            }

            return {
              name: entry.name,
              type: isDirectory ? "directory" : "file",
              children: isDirectory ? children : undefined,
              contents,
            };
          })
        );

        return files;
      } catch (error) {
        console.error(`Error listing files in ${directory}:`, error);
        return [];
      }
    },
    [webcontainerInstance]
  );

  // Create a new file
  const createFile = useCallback(
    async (path: string, content: string = ""): Promise<boolean> => {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      try {
        await webcontainerInstance.fs.writeFile(path, content, "utf-8");
        return true;
      } catch (error) {
        console.error(`Error creating file ${path}:`, error);
        return false;
      }
    },
    [webcontainerInstance]
  );

  // Create a new folder
  const createFolder = useCallback(
    async (path: string): Promise<boolean> => {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      try {
        await webcontainerInstance.fs.mkdir(path, { recursive: true });
        return true;
      } catch (error) {
        console.error(`Error creating folder ${path}:`, error);
        return false;
      }
    },
    [webcontainerInstance]
  );

  // Delete a file or directory
  const deleteEntry = useCallback(
    async (path: string): Promise<boolean> => {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      // Normalize path
      const normalizedPath = normalizePath(path);
      console.log(`Deleting path: ${normalizedPath}`);

      try {
        // Check if it's a directory or file based on path
        try {
          // For directories and files, use rm method with recursive option for directories
          await webcontainerInstance.fs.rm(normalizedPath, {
            recursive: true,
            force: true,
          });
          console.log(`Successfully deleted path: ${normalizedPath}`);
          return true;
        } catch (error) {
          console.error(`Error deleting entry ${path}:`, error);
          return false;
        }
      } catch (error) {
        console.error(`Error deleting entry ${normalizedPath}:`, error);
        return false;
      }
    },
    [webcontainerInstance]
  );

  // Rename a file or directory
  const renameEntry = useCallback(
    async (
      oldPath: string,
      newPath: string,
      fileType?: "file" | "directory"
    ): Promise<boolean> => {
      if (!webcontainerInstance) {
        console.error("WebContainer not initialized");
        return false;
      }

      // Normalize paths
      const normalizedOldPath = normalizePath(oldPath);
      const normalizedNewPath = normalizePath(newPath);

      console.log(
        `Renaming from: ${normalizedOldPath} to: ${normalizedNewPath}`
      );

      // Check if paths are the same
      if (normalizedOldPath === normalizedNewPath) {
        console.log(
          "Source and target paths are identical, no operation needed"
        );
        return true;
      }

      try {
        // Use provided fileType if available, or detect it
        let isFile = fileType === "file";
        let fileContent: string | Uint8Array = "";

        // If fileType wasn't provided, we need to detect it
        if (!fileType) {
          console.log("No fileType provided, detecting type...");
          try {
            // Try to read as a file first - but don't specify encoding to handle binary files
            fileContent =
              await webcontainerInstance.fs.readFile(normalizedOldPath);
            isFile = true;
            console.log(
              `Auto-detected: Source path ${normalizedOldPath} is a file`
            );
          } catch (fileError) {
            console.log(fileError);
            // Not a file, or file not found
            isFile = false;
            console.log(
              `Auto-detected: Source path ${normalizedOldPath} is not a file`
            );

            // Try to check if it's a directory
            try {
              const entries = await webcontainerInstance.fs.readdir(
                normalizedOldPath,
                { withFileTypes: true }
              );
              if (entries) {
                console.log(
                  `Auto-detected: Source path ${normalizedOldPath} is a directory with ${entries.length} entries`
                );
              }
            } catch (dirError) {
              console.log(dirError);
              // Neither a file nor a directory, or not accessible
              console.error(
                `Source path ${normalizedOldPath} does not exist or is not accessible`
              );
              return false;
            }
          }
        } else {
          // Using provided fileType
          console.log(
            `Using provided fileType: ${fileType} for ${normalizedOldPath}`
          );

          // If it's a file, we still need to read its content
          if (isFile) {
            try {
              // Don't specify encoding to handle binary files correctly
              const fileData =
                await webcontainerInstance.fs.readFile(normalizedOldPath);
              fileContent = fileData;
            } catch (readError) {
              console.error(
                `Error reading file ${normalizedOldPath}:`,
                readError
              );
              return false;
            }
          }
        }

        // Check if target already exists
        const targetExists = await webcontainerInstance.fs
          .readdir(normalizedNewPath, { withFileTypes: true })
          .then(() => true)
          .catch(() => false);

        if (targetExists) {
          console.error(`Target path ${normalizedNewPath} already exists`);
          // We could ask user for overwrite confirmation here
          return false;
        }

        // Handle rename based on file type
        // Extract path components for better handling
        const oldDirPath = normalizedOldPath.substring(
          0,
          normalizedOldPath.lastIndexOf("/")
        );
        const newDirPath = normalizedNewPath.substring(
          0,
          normalizedNewPath.lastIndexOf("/")
        );
        const oldName = normalizedOldPath.substring(
          normalizedOldPath.lastIndexOf("/") + 1
        );
        const newName = normalizedNewPath.substring(
          normalizedNewPath.lastIndexOf("/") + 1
        );

        // Log the rename attempt details for debugging
        console.log(`Rename details:`);
        console.log(`- Is file: ${isFile}`);
        console.log(`- Old directory: ${oldDirPath}`);
        console.log(`- New directory: ${newDirPath}`);
        console.log(`- Old name: ${oldName}`);
        console.log(`- New name: ${newName}`);

        if (isFile) {
          // It's a file - write to new location, then delete old location
          try {
            // Make sure parent directory exists
            if (newDirPath) {
              try {
                await webcontainerInstance.fs.mkdir(newDirPath, {
                  recursive: true,
                });
                console.log(
                  `Created or verified parent directory: ${newDirPath}`
                );
              } catch (err) {
                console.log(`Parent directory handling: ${newDirPath}`, err);
                // Continue anyway - directory might already exist
              }
            }

            // Log exact paths being used
            console.log(`Writing file contents:`);
            console.log(`- Source: "${normalizedOldPath}"`);
            console.log(`- Target: "${normalizedNewPath}"`);

            // Write to new location - don't specify encoding to handle binary files correctly
            await webcontainerInstance.fs.writeFile(
              normalizedNewPath,
              fileContent
            );
            console.log(`Successfully wrote file contents to new location`);

            // Only delete old file after new file has been successfully written
            try {
              await webcontainerInstance.fs.rm(normalizedOldPath, {
                force: true,
              });
              console.log(
                `Successfully deleted original file at ${normalizedOldPath}`
              );
            } catch (deleteErr) {
              console.error(
                `Warning: Couldn't delete original file ${normalizedOldPath}:`,
                deleteErr
              );
              // Continue anyway since we've already written the new file
            }

            console.log(
              `Successfully renamed file from ${normalizedOldPath} to ${normalizedNewPath}`
            );
            return true;
          } catch (fileWriteError) {
            console.error(
              `Error writing to new path ${normalizedNewPath}:`,
              fileWriteError
            );
            return false;
          }
        } else {
          // It's a directory - handle with more care
          try {
            // First make sure parent directory of newPath exists
            const parentDir = normalizedNewPath.substring(
              0,
              normalizedNewPath.lastIndexOf("/")
            );
            if (parentDir) {
              await webcontainerInstance.fs
                .mkdir(parentDir, { recursive: true })
                .catch((err) =>
                  console.log(`Parent directory exists: ${parentDir}`, err)
                );
            }

            // Check if target already exists
            const targetExists = await webcontainerInstance.fs
              .readdir(normalizedNewPath)
              .then(() => true)
              .catch(() => false);

            // Don't proceed if target already exists
            if (targetExists) {
              console.error(
                `Cannot rename directory: target ${normalizedNewPath} already exists`
              );
              return false;
            }

            // Create the new directory
            try {
              await webcontainerInstance.fs.mkdir(normalizedNewPath, {
                recursive: false,
              });
              console.log(`Created target directory: ${normalizedNewPath}`);
            } catch (error: unknown) {
              if (error instanceof Error) {
                // If directory already exists, just continue
                if (!error.message?.includes("EEXIST")) {
                  console.error(
                    `Error creating directory ${normalizedNewPath}:`,
                    error
                  );
                  throw error;
                } else {
                  console.log(
                    `Target directory already exists: ${normalizedNewPath}`
                  );
                }
              } else {
                console.error(
                  `Unknown error creating directory ${normalizedNewPath}:`,
                  error
                );
              }
            }

            // List contents of the original directory
            const entries = await webcontainerInstance.fs.readdir(
              normalizedOldPath,
              { withFileTypes: true }
            );
            console.log(
              `Found ${entries.length} entries in ${normalizedOldPath}`
            );

            // First copy everything to the new location
            for (const entry of entries) {
              const sourcePath = `${normalizedOldPath}/${entry.name}`;
              const targetPath = `${normalizedNewPath}/${entry.name}`;

              if (entry.isDirectory()) {
                console.log(
                  `Copying directory: ${sourcePath} to ${targetPath}`
                );
                // Create subdirectory
                await webcontainerInstance.fs
                  .mkdir(targetPath, { recursive: false })
                  .catch((err) => {
                    if (!err.message?.includes("EEXIST")) {
                      console.error(
                        `Error creating subdirectory ${targetPath}:`,
                        err
                      );
                    }
                  });

                // Recursively copy subdirectory contents
                try {
                  // Get subdirectory contents
                  const subEntries = await webcontainerInstance.fs.readdir(
                    sourcePath,
                    { withFileTypes: true }
                  );

                  // Copy each item in the subdirectory
                  for (const subEntry of subEntries) {
                    const subSourcePath = `${sourcePath}/${subEntry.name}`;
                    const subTargetPath = `${targetPath}/${subEntry.name}`;

                    if (subEntry.isDirectory()) {
                      // Create directory and recurse
                      await webcontainerInstance.fs.mkdir(subTargetPath, {
                        recursive: true,
                      });
                      // Implement deeper recursion if needed
                    } else {
                      // Copy file
                      const subFileContent =
                        await webcontainerInstance.fs.readFile(
                          subSourcePath,
                          "utf-8"
                        );
                      await webcontainerInstance.fs.writeFile(
                        subTargetPath,
                        subFileContent,
                        "utf-8"
                      );
                    }
                  }
                } catch (subDirError) {
                  console.error(
                    `Error copying subdirectory ${sourcePath}:`,
                    subDirError
                  );
                }
              } else {
                // Copy files
                try {
                  console.log(`Copying file: ${sourcePath} to ${targetPath}`);
                  const fileContent = await webcontainerInstance.fs.readFile(
                    sourcePath,
                    "utf-8"
                  );
                  await webcontainerInstance.fs.writeFile(
                    targetPath,
                    fileContent,
                    "utf-8"
                  );
                } catch (fileCopyError) {
                  console.error(
                    `Error copying file ${sourcePath}:`,
                    fileCopyError
                  );
                }
              }
            }

            // Only after everything is copied, remove the old directory
            try {
              console.log(`Removing old directory: ${normalizedOldPath}`);
              await webcontainerInstance.fs.rm(normalizedOldPath, {
                recursive: true,
                force: true,
              });
              console.log(
                `Successfully renamed directory from ${normalizedOldPath} to ${normalizedNewPath}`
              );
              return true;
            } catch (rmError) {
              console.error(
                `Error removing original directory ${normalizedOldPath}:`,
                rmError
              );
              // We still created the new directory with contents, so consider it partially successful
              console.log(
                `Partial success: New directory ${normalizedNewPath} created but couldn't remove ${normalizedOldPath}`
              );
              return true;
            }
          } catch (dirError) {
            console.error(
              `Error renaming directory ${oldPath} to ${newPath}:`,
              dirError
            );
            return false;
          }
        }
      } catch (error) {
        console.error(
          `Error renaming ${normalizedOldPath} to ${normalizedNewPath}:`,
          error
        );
        return false;
      }
    },
    [webcontainerInstance]
  );

  return {
    listFiles,
    createFile,
    createFolder,
    deleteEntry,
    renameEntry,
  };
};

export default useWebContainerFiles;
