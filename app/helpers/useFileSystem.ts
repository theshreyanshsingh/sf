import { useDispatch } from "react-redux";
import { updateprojectFiles } from "../redux/reducers/projectFiles";
import { useWebContainerContext } from "../redux/useWebContainerContext";

export const useFileSystem = () => {
  const dispatch = useDispatch();
  const { webcontainerInstance } = useWebContainerContext();

  const addFile = async (filePath: string, code: string) => {
    if (!webcontainerInstance) {
      console.log("WebContainer instance is not available");
      return;
    }

    try {
      // Extract directory path (e.g., "frontend/src/components" from "frontend/src/components/Header.tsx")
      const pathSegments = filePath.split("/").filter((segment) => segment);
      const dirPath = pathSegments.slice(0, -1).join("/");

      // Check and create directories if they don't exist
      if (dirPath) {
        try {
          await webcontainerInstance.fs.readdir(dirPath);
        } catch (error) {
          console.log(
            `Directory ${dirPath} does not exist, creating it`,
            error
          );
          await webcontainerInstance.fs.mkdir(dirPath, { recursive: true });
        }
      }

      // Check if file exists
      try {
        await webcontainerInstance.fs.readFile(filePath, "utf8");
      } catch (error) {
        console.log(`File ${filePath} does not exist, creating it`, error);
      }

      // Write the file to WebContainer filesystem
      await webcontainerInstance.fs.writeFile(filePath, code);

      // Dispatch with the proper format expected by updateprojectFiles
      dispatch(
        updateprojectFiles({
          filePath,
          code,
        })
      );
    } catch (error) {
      console.error(`Failed to process file ${filePath}:`, error);
    }
  };

  return {
    addFile,
  };
};
