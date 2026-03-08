import { API } from "../config/publicEnv";

import { Dispatch } from "redux";
import { setGenerating, setReaderMode } from "../redux/reducers/projectOptions";
import {
  setMarkdown,
  setprojectFiles,
  setNewProjectData,
  setEmptyMarkdown,
  setprojectData,
} from "../redux/reducers/projectFiles";
import { store } from "../redux/store";
import { getActiveWebContainer } from "./useWebContainer";
import { saveMoreDatatoProject } from "../_services/projects";

export const createStreamableRequest = (dispatch: Dispatch) => {
  // Use regular object instead of useRef
  const sentRequests = new Set<string>();

  return async (
    requestPayload: {
      owner: string;
      projectId: string;
      terminal: string;
      prompt: string;
      images: string[];
      model: string;
    },
    requestId?: string,
    onComplete?: (success: boolean) => void
  ) => {
    // Avoid duplicate requests
    if (requestId && sentRequests.has(requestId)) {
      return;
    }

    // Mark as sent if we have an ID
    if (requestId) {
      sentRequests.add(requestId);
    }

    try {
      // Initial message to show loading state (chat) plus toggle generation UI
      // dispatch(
      //   smartSendMessage({
      //     role: "user",
      //     text: requestPayload.prompt, // will stream in later
      //     images: [],
      //     isLoading: true,
      //   })
      // );

      // Prepare UI for progressive streaming (reader mode etc.)
      dispatch(setEmptyMarkdown(""));
      dispatch(
        setGenerating({
          generating: true,
          isResponseCompleted: true,
          generationSuccess: "thinking",
        })
      );
      dispatch(setReaderMode(true));

      const selectedFramework = sessionStorage.getItem("framework") || "react";
      const selectedModel =
        sessionStorage.getItem("model") || "claude-sonnet-4.5";
      const res = await fetch(`${API}/v2/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...requestPayload,
          framework: selectedFramework,
          fix: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      if (!res.body) {
        throw new Error("Res body is null");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let files: Record<string, unknown> | null = null;
      let streamBuffer = "";
      let completecontent = "";
      let markdownBuffer = "";
      let isCapturingMarkdown = false;

      let dispatchstreamBuffer = "";
      let isCapturing = false;

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

            streamBuffer += content;
            completecontent += content;

            // Process the buffer for markdown extraction
            while (true) {
              if (!isCapturingMarkdown) {
                // Look for the start pattern ___start___
                const startPattern = "___start___";
                const startIndex = streamBuffer.indexOf(startPattern);

                if (startIndex === -1) break;

                // Start capturing and immediately dispatch the start pattern
                const startContent = streamBuffer.slice(startIndex);
                markdownBuffer = startContent;
                dispatch(setMarkdown(markdownBuffer));

                streamBuffer = streamBuffer.slice(
                  startIndex + startContent.length
                );
                isCapturingMarkdown = true;
              } else {
                // Look for the end pattern ___end___
                const endPattern = "___end___";
                const endIndex = streamBuffer.indexOf(endPattern);

                if (endIndex === -1) {
                  // End pattern not found yet, stream all available content except potential split
                  if (streamBuffer.length > endPattern.length) {
                    const safeLength = streamBuffer.length - endPattern.length;
                    const contentToAdd = streamBuffer.slice(0, safeLength);
                    markdownBuffer += contentToAdd;

                    // Dispatch word by word streaming
                    dispatch(setMarkdown(markdownBuffer));

                    // Keep the remaining buffer
                    streamBuffer = streamBuffer.slice(safeLength);
                  }
                  break;
                } else {
                  // Found end pattern, capture the final content and stop
                  const finalContent = streamBuffer.slice(0, endIndex);
                  markdownBuffer += finalContent;

                  // Dispatch the final markdown content
                  dispatch(setMarkdown(markdownBuffer));

                  // Reset for next capture
                  streamBuffer = streamBuffer.slice(
                    endIndex + endPattern.length
                  );
                  isCapturingMarkdown = false;
                  markdownBuffer = "";
                  break; // Stop processing after finding end pattern
                }
              }
            }
          }
        }
      }

      // Handle any remaining content
      if (isCapturingMarkdown && markdownBuffer) {
        dispatch(setMarkdown(markdownBuffer));
      }

      console.log("Stream processing completed", completecontent);

      // Extract files from the completed content
      files = extractGeneratedFilesObjectString(completecontent);

      if (files) {
        // Merge with existing data map so we don't lose prior variants
        const existingData = (store.getState().projectFiles.data ||
          {}) as Record<string, unknown>;

        const mergedFiles = { ...existingData, ...files };

        // Build explorer tree from merged map
        const fileTree = buildFileTree(mergedFiles);
        dispatch(setprojectFiles({ ...fileTree }));

        // Persist raw map in state for future prompts - use mergedFiles to keep existing data
        dispatch(setprojectData(mergedFiles));
        dispatch(setNewProjectData(files));

        // ---- Write ONLY changed/new files into WebContainer ----
        const wc = getActiveWebContainer();

        if (wc) {
          for (const [rawPath, content] of Object.entries(files)) {
            // Extract string content using helper function
            const contentStr = extractContentString(content);

            // Skip if we couldn't extract valid content
            if (typeof contentStr !== "string") {
              console.warn(`Skipping file ${rawPath} - invalid content type`);
              continue;
            }

            const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
            const dir = path.substring(0, path.lastIndexOf("/"));

            // Create directory if needed
            if (dir) {
              try {
                await wc.fs.mkdir(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
              } catch {
                // Directory already exists
                console.log(`Directory exists: ${dir}`);
              }
            }

            // Write the file
            try {
              await wc.fs.writeFile(path, contentStr, "utf-8");
              console.log(`Written file: ${path}`);
            } catch (e) {
              console.error(`Failed writing ${path}:`, e);
            }
          }
          //start server again
          if (selectedFramework !== "web-components") {
            console.warn("Starting server");
            wc.spawn("bash", ["-c", "cd frontend && npm run dev"]).catch(
              (e) => {
                console.warn("Error starting project", e);
              }
            );
          }
        }

        // ---- Persist merged data to backend ----
        try {
          const email = (requestPayload.owner as string) || "";
          const projectId = (requestPayload.projectId as string) || "";
          if (email && projectId) {
            await saveMoreDatatoProject({
              data: JSON.stringify(mergedFiles),
              email,
              projectId,
            });
          }
        } catch (e) {
          console.error("Failed saving project", e);
        }

        const message = extractMessage(completecontent);

        // dispatch(
        //   smartSendMessage({
        //     role: "ai",
        //     text: message || "", // will stream in later
        //     images: [],
        //     isLoading: false,
        //     replaceLastMessage: false,
        //   })
        // );

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

      // Call onComplete callback with success
      if (onComplete) {
        onComplete(true);
      }
    } catch (err) {
      console.error("Agent error:", err);

      // Update with error message
      // dispatch(
      //   smartSendMessage({
      //     role: "ai",
      //     text: "Something went wrong with the agent response. Please try again.",
      //     replaceLastMessage: true,
      //     isLoading: false,
      //   })
      // );

      // Reset generation states on error
      dispatch(
        setGenerating({
          generating: false,
          generationSuccess: "failed",
          isResponseCompleted: true,
        })
      );
      dispatch(setReaderMode(false));

      // Call onComplete callback with failure
      if (onComplete) {
        onComplete(false);
      }
    }
  };
};

// Helper function to extract string content from various formats
function extractContentString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (content && typeof content === "object" && "code" in content) {
    return (content as { code: string }).code;
  }

  // Fallback to JSON string representation
  return JSON.stringify(content, null, 2);
}

function extractMessage(input: string): string | null {
  const match = input.match(
    /"filesCount"\s*:\s*\d+\s*,\s*"message"\s*:\s*"([^"]+)"/
  );
  return match ? match[1] : null;
}

function extractGeneratedFilesObjectString(
  rawMarkdown: string
): Record<string, unknown> | null {
  if (typeof rawMarkdown !== "string" || !rawMarkdown.trim()) {
    return null;
  }

  try {
    // Find the generatedFiles object in the string
    const generatedFilesMatch = rawMarkdown.match(
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

// Helper function to build file tree for Redux store
const buildFileTree = (
  fileMap: Record<string, unknown>
): Record<string, unknown> => {
  const tree: Record<string, unknown> = {};

  for (const [rawPath, contents] of Object.entries(fileMap)) {
    // Handle both string content and {code: "..."} format using helper function
    const fileContents = extractContentString(contents);

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
