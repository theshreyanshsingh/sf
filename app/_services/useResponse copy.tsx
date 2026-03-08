import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";

import { useState } from "react";

import { setGenerating, setReaderMode } from "../redux/reducers/projectOptions";
import {
  EmptySheet,
  setEmptyMarkdown,
  setMarkdown,
  setprojectData,
  setprojectFiles,
} from "../redux/reducers/projectFiles";
import { API } from "../config/publicEnv";
import { saveMoreDatatoProject } from "./projects";
import { setNotification } from "../redux/reducers/NotificationModalReducer";

export const useResponse = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { framework } = useSelector((state: RootState) => state.projectOptions);
  const { data } = useSelector((state: RootState) => state.projectFiles); //files
  const { images } = useSelector((state: RootState) => state.basicData);

  const [isGenerating, setIsGenerating] = useState(false);

  function extractGeneratedFilesObjectString(
    rawMarkdown: string
  ): Record<string, unknown> | null {
    if (typeof rawMarkdown !== "string" || !rawMarkdown.trim()) {
      return null;
    }

    // Extract content between ___start___ and ___end___ markers if present
    let processedMarkdown = rawMarkdown;
    const startMarker = "___start___";
    const endMarker = "___end___";
    const startIndex = rawMarkdown.indexOf(startMarker);
    const endIndex = rawMarkdown.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      processedMarkdown = rawMarkdown
        .substring(startIndex + startMarker.length, endIndex)
        .trim();
    }

    try {
      // Find the generatedFiles object in the string
      const generatedFilesMatch = processedMarkdown.match(
        /"generatedFiles":\s*({[\s\S]*?})\s*(?:,\s*"files"|$)/
      );

      if (!generatedFilesMatch) {
        return null;
      }

      // Parse just the generatedFiles object
      const generatedFilesString = generatedFilesMatch[1];
      const generatedFiles = JSON.parse(generatedFilesString) as Record<
        string,
        unknown
      >;

      return generatedFiles;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  const generateResponse = async ({
    input,
    email,
    projectId,
    save,
  }: {
    input: string;
    email: string;
    projectId: string;
    save: boolean;
  }): Promise<void> => {
    try {
      if (!email) return;

      const selectedModel = sessionStorage.getItem("model") || "claude-sonnet-4.5";
      const selectedFramework =
        sessionStorage.getItem("framework") || framework;

      const rawString = JSON.stringify({
        prompt: input,
        memory: sessionStorage.getItem("memory") || "",
        cssLib: sessionStorage.getItem("css") || "tailwindcss",
        framework: selectedFramework || "react",
        projectId: projectId || "",
        owner: email || "",
        images,
        model: selectedModel,
        save,
      });

      dispatch(
        setGenerating({
          generating: true,
          isResponseCompleted: true,
          generationSuccess: "thinking",
        })
      );
      dispatch(EmptySheet());
      dispatch(setReaderMode(false));
      setIsGenerating(true);

      const res = await fetch(`${API}/v2/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: rawString,
      });

      if (!res.ok)
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
      if (!res.body) throw new Error("Response body is null");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let files: Record<string, unknown> | null = null;
      let completecontent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const content = line.slice(6);

            if (content === "[DONE]") break;
            if (content.startsWith("stream_start")) continue;

            completecontent += content;
          }
        }
      }

      let filedata;

      setTimeout(() => {}, 500);
      // Fetch files from backend after stream ends
      try {
        const fetchResponse = await fetch(`${API}/fetch-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: projectId || "",
            userEmail: email || "",
          }),
        });

        if (fetchResponse.ok) {
          const fetchedFiles = await fetchResponse.json();
          filedata = fetchedFiles.initialCode;
        }
      } catch (fetchError) {
        console.error("Error fetching files from backend:", fetchError);
      }

      files = extractGeneratedFilesObjectString(filedata);

      if (files) {
        // 1. Build hierarchical tree & expose to explorer
        const fileTree = buildFileTree(files);
        dispatch(setprojectFiles(fileTree));

        // 2. Keep raw map in state for future prompts / save-to-backend
        dispatch(setprojectData({ ...files }));
        saveMoreDatatoProject({
          data: JSON.stringify({ ...data, ...files }),
          email: email || "",
          projectId: projectId || "",
        });

        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "success",
            isResponseCompleted: true,
          })
        );
      } else {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          })
        );
      }
      dispatch(setEmptyMarkdown(""));
      dispatch(setReaderMode(false));
    } catch (e) {
      console.log("Error in generateResponse:", e);
      dispatch(
        setGenerating({
          generating: false,
          isResponseCompleted: true,
          generationSuccess: "failed",
        })
      );
    } finally {
      setIsGenerating(false);
      dispatch(
        setGenerating({
          generating: false,
          isResponseCompleted: true,
          generationSuccess: "success",
        })
      );
    }
  };

  const fetchProjectFiles = async (data: {
    url: string;
  }): Promise<Record<string, unknown> | null> => {
    try {
      const response = await fetch(data.url, {
        method: "GET",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const responseData = (await response.json()) as Record<string, unknown>;

        // Just set the data in Redux - WebContainer writing will be handled elsewhere
        dispatch(setprojectFiles(buildFileTree(responseData)));
        dispatch(setprojectData({ ...responseData }));
        dispatch(setReaderMode(false));
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "success",
            isResponseCompleted: true,
          })
        );

        // Return the data so it can be used by WebContainer-aware components
        return responseData;
      } else {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          })
        );
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: "Preview is not available at the moment! Please try again.",
          })
        );
        return null;
      }
    } catch (error) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to fetch project files!",
        })
      );
      console.error(error);
      return null;
    }
  };

  // Helper function to build file tree for Redux store
  type FileContent = string | { code: string } | unknown;

  const buildFileTree = (
    fileMap: Record<string, FileContent>
  ): Record<string, unknown> => {
    const tree: Record<string, unknown> = {};

    for (const [rawPath, contents] of Object.entries(fileMap)) {
      // Handle both string content and {code: "..."} format
      const fileContents = (() => {
        if (typeof contents === "string") {
          return contents;
        }
        if (contents && typeof contents === "object" && contents !== null) {
          if ("code" in contents && typeof contents.code === "string") {
            return (contents as { code: string }).code;
          }
          return JSON.stringify(contents, null, 2);
        }
        return String(contents || "");
      })();

      const parts = rawPath.replace(/^\/+/, "").split("/");
      let current = tree;

      parts.forEach((part, idx) => {
        const isFile = idx === parts.length - 1;

        if (isFile) {
          (current as Record<string, unknown>)[part] = {
            file: { contents: fileContents },
          };
        } else {
          if (!(part in current)) {
            (current as Record<string, unknown>)[part] = { directory: {} };
          }
          current = (
            (current as Record<string, unknown>)[part] as {
              directory: Record<string, unknown>;
            }
          ).directory;
        }
      });
    }

    return tree;
  };

  return {
    generateResponse,
    isGenerating,
    fetchProjectFiles,
  };
};
