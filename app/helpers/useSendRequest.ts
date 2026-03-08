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
import { getWorkerManager } from "../(pages)/projects/[project]/_components/_sub-components/Streams/comps/WorkerManager";
import { streamStorage } from "../(pages)/projects/[project]/_components/_sub-components/Streams/comps";

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
      silent?: boolean;
    },
    requestId?: string,
    onComplete?: (success: boolean) => void
  ) => {
    const projectId = requestPayload.projectId;
    // Avoid duplicate requests
    if (requestId && sentRequests.has(requestId)) {
      return;
    }

    // Mark as sent if we have an ID
    if (requestId) {
      sentRequests.add(requestId);
    }

    try {
      // Prepare UI for progressive streaming
      if (!requestPayload.silent) {
        dispatch(setEmptyMarkdown(""));
        dispatch(
          setGenerating({
            generating: true,
            isResponseCompleted: true,
            generationSuccess: "thinking",
          })
        );
      }

      const res = await fetch(`${API}/v2/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...requestPayload,
          framework: "react",
          fix: true,
        }),
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

      setTimeout(() => { }, 500);
      // Fetch files from backend after stream ends
      try {
        const fetchResponse = await fetch(`${API}/fetch-code`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: projectId || "",
            userEmail: (requestPayload.owner as string) || "",
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

          console.warn("Starting server");
          wc.spawn("bash", ["-c", "cd frontend && npm run dev"]).catch((e) => {
            console.warn("Error starting project", e);
          });
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

        const message = extractMessage(filedata);

        if (!requestPayload.silent) {
          dispatch(
            setGenerating({
              generating: false,
              generationSuccess: "success",
              isResponseCompleted: true,
            })
          );
        }
      } else if (!requestPayload.silent) {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          })
        );
      }

      if (!requestPayload.silent) {
        dispatch(setEmptyMarkdown(""));
        dispatch(setReaderMode(false));
      }

      // Call onComplete callback with success
      if (onComplete) {
        onComplete(true);
      }
    } catch (err) {
      console.error("Agent error:", err);

      if (!requestPayload.silent) {
        // Reset generation states on error
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          })
        );
        dispatch(setReaderMode(false));
      }

      // Call onComplete callback with failure
      if (onComplete) {
        onComplete(false);
      }
    } finally {
      // Mark stream as complete in case of any error
      const finalProjectId = projectId || "default";
      streamStorage.markStreamComplete(finalProjectId);
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
