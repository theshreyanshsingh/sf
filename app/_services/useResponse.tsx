import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../redux/store";

import { useState } from "react";

import {
  setGenerating,
  setPreviewRuntime,
  setReaderMode,
} from "../redux/reducers/projectOptions";
import {
  EmptySheet,
  setEmptyMarkdown,
  setprojectData,
  setprojectFiles,
} from "../redux/reducers/projectFiles";
import { API } from "../config/publicEnv";
import { saveMoreDatatoProject } from "./projects";
import { setNotification } from "../redux/reducers/NotificationModalReducer";
import {
  extractFileWritesFromSnapshot,
  inferPreviewRuntimeFromWrites,
  normalizeIncomingFileContent,
} from "./fileUpdatesMobile";

export const useResponse = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { framework, previewRuntime } = useSelector(
    (state: RootState) => state.projectOptions,
  );
  const { data } = useSelector((state: RootState) => state.projectFiles); //files
  const { images } = useSelector((state: RootState) => state.basicData);

  const [isGenerating, setIsGenerating] = useState(false);
  function extractGeneratedFilesObjectString(
    rawContent: string,
  ): Record<string, unknown> | null {
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      return null;
    }
    try {
      // First, try to find content between ___start___ and ___end___ markers
      const messageMatches = [
        ...rawContent.matchAll(/___start___(.*?)___end___/gs),
      ];

      if (messageMatches.length > 0) {
        for (let i = 0; i < messageMatches.length; i++) {
          const match = messageMatches[i];
          const matchContent = match[1];

          try {
            // Clean the content first - remove leading \n and convert literal \n to actual newlines
            // let cleanedContent = matchContent
            //   .replace(/^\\n/, "")
            //   .replace(/\\n/g, "\n")
            //   .replace(/\\"/g, '"')
            //   .replace(/\\\\/g, "\\");

            // Remove any leading/trailing whitespace
            // cleanedContent = cleanedContent.trim();

            // Try JSON.parse first
            let parsedContent;
            try {
              parsedContent = JSON.parse(matchContent);
            } catch (jsonError) {
              console.log(
                "JSON.parse failed, trying eval approach:",
                (jsonError as Error).message,
              );
              // Fallback to eval if JSON.parse fails
              try {
                parsedContent = eval("(" + matchContent + ")");
              } catch (evalError) {
                console.log("Eval also failed:", (evalError as Error).message);
                continue; // Skip to next match
              }
            }

            if (parsedContent && parsedContent.generatedFiles) {
              return parsedContent.generatedFiles as Record<string, unknown>;
            }
          } catch (parseError) {
            console.log(
              "Could not parse match content as JSON:",
              (parseError as Error).message,
            );

            // Clean the match content before regex extraction
            let cleanedMatch = matchContent
              .replace(/^\\n/, "")
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, "\\")
              .trim();

            // Try to extract generatedFiles using improved regex
            console.log("Trying regex extraction as fallback...");

            // Look for "generatedFiles": followed by an opening brace
            // Then find the matching closing brace using a counter
            const generatedFilesStart =
              cleanedMatch.indexOf('"generatedFiles":');
            if (generatedFilesStart !== -1) {
              console.log(
                "Found generatedFiles key at position:",
                generatedFilesStart,
              );

              // Find the opening brace after "generatedFiles":
              const afterKey = cleanedMatch.substring(
                generatedFilesStart + '"generatedFiles":'.length,
              );
              const openBraceMatch = afterKey.match(/^\s*\{/);

              if (openBraceMatch) {
                const openBracePos =
                  generatedFilesStart +
                  '"generatedFiles":'.length +
                  openBraceMatch.index!;
                console.log("Found opening brace at position:", openBracePos);

                // Find matching closing brace
                let braceCount = 0;
                let inString = false;
                let escaped = false;
                let closeBracePos = -1;

                for (let j = openBracePos; j < cleanedMatch.length; j++) {
                  const char = cleanedMatch[j];

                  if (escaped) {
                    escaped = false;
                    continue;
                  }

                  if (char === "\\") {
                    escaped = true;
                    continue;
                  }

                  if (char === '"' && !escaped) {
                    inString = !inString;
                    continue;
                  }

                  if (!inString) {
                    if (char === "{") {
                      braceCount++;
                    } else if (char === "}") {
                      braceCount--;
                      if (braceCount === 0) {
                        closeBracePos = j;
                        break;
                      }
                    }
                  }
                }

                if (closeBracePos !== -1) {
                  const generatedFilesJson = cleanedMatch.substring(
                    openBracePos,
                    closeBracePos + 1,
                  );
                  console.log(
                    "Extracted generatedFiles JSON (first 300 chars):",
                    generatedFilesJson.substring(0, 300),
                  );

                  try {
                    const generatedFiles = JSON.parse(generatedFilesJson);
                    console.log(
                      "Successfully parsed generatedFiles with improved regex",
                    );
                    console.log(
                      "Total files:",
                      Object.keys(generatedFiles).length,
                    );

                    return generatedFiles as Record<string, unknown>;
                  } catch (regexParseError) {
                    console.log(
                      "Failed to parse extracted generatedFiles JSON:",
                      (regexParseError as Error).message,
                    );
                    console.log(
                      "JSON content:",
                      generatedFilesJson.substring(0, 500),
                    );
                  }
                } else {
                  console.log("Could not find matching closing brace");
                }
              } else {
                console.log(
                  "Could not find opening brace after generatedFiles key",
                );
              }
            } else {
              console.log("Could not find generatedFiles key");
            }
          }
        }
      }

      // Fallback: If no ___end___ marker, try to find content after ___start___
      const startIndex = rawContent.indexOf("___start___");
      if (startIndex !== -1) {
        const contentAfterStart = rawContent.substring(startIndex + 11); // 11 is length of "___start___"
        console.log(
          "Content after ___start___ (first 500 chars):",
          contentAfterStart.substring(0, 500) + "...",
        );

        // Clean the content first
        // let cleanedFallbackContent = contentAfterStart
        //   .replace(/^\\n/, "")
        //   .replace(/\\n/g, "\n")
        //   .replace(/\\"/g, '"')
        //   .replace(/\\\\/g, "\\")
        //   .trim();

        // Use the same improved regex approach for fallback
        // const generatedFilesStart =
        //   cleanedFallbackContent.indexOf('"generatedFiles":');
        // if (generatedFilesStart !== -1) {
        //   console.log(
        //     "Found generatedFiles key in fallback at position:",
        //     generatedFilesStart
        //   );

        //   const afterKey = cleanedFallbackContent.substring(
        //     generatedFilesStart + '"generatedFiles":'.length
        //   );
        //   const openBraceMatch = afterKey.match(/^\s*\{/);

        //   if (openBraceMatch) {
        //     const openBracePos =
        //       generatedFilesStart +
        //       '"generatedFiles":'.length +
        //       openBraceMatch.index!;

        //     // Find matching closing brace
        //     let braceCount = 0;
        //     let inString = false;
        //     let escaped = false;
        //     let closeBracePos = -1;

        //     for (let j = openBracePos; j < cleanedFallbackContent.length; j++) {
        //       const char = cleanedFallbackContent[j];

        //       if (escaped) {
        //         escaped = false;
        //         continue;
        //       }

        //       if (char === "\\") {
        //         escaped = true;
        //         continue;
        //       }

        //       if (char === '"' && !escaped) {
        //         inString = !inString;
        //         continue;
        //       }

        //       if (!inString) {
        //         if (char === "{") {
        //           braceCount++;
        //         } else if (char === "}") {
        //           braceCount--;
        //           if (braceCount === 0) {
        //             closeBracePos = j;
        //             break;
        //           }
        //         }
        //       }
        //     }

        //     if (closeBracePos !== -1) {
        //       const generatedFilesJson = cleanedFallbackContent.substring(
        //         openBracePos,
        //         closeBracePos + 1
        //       );

        //       try {
        //         const generatedFiles = JSON.parse(generatedFilesJson);
        //         console.log("\n=== GENERATED FILES FOUND (FALLBACK) ===");
        //         console.log("Total files:", Object.keys(generatedFiles).length);

        //         return generatedFiles as Record<string, unknown>;
        //       } catch (parseError) {
        //         console.log(
        //           "Could not parse generatedFiles JSON in fallback:",
        //           (parseError as Error).message
        //         );
        //       }
        //     }
        //   }
        // }
      }

      console.log("No generated files found in any format");
      return null;
    } catch (error) {
      console.error(
        "Error extracting generated files:",
        (error as Error).message,
      );
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
        }),
      );
      dispatch(EmptySheet());
      dispatch(setReaderMode(false));
      setIsGenerating(true);

      const res = await fetch(`${API}/v3/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: rawString,
      });

      if (!res.ok)
        throw new Error(`API Error: ${res.status} ${await res.text()}`);
      if (!res.body) throw new Error("Response body is null");

      const completecontent = await res.json();

      // Use the complete content for file extraction (the function will handle marker detection internally)
      const files = extractGeneratedFilesObjectString(completecontent.data);

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
          }),
        );
      } else {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          }),
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
        }),
      );
    } finally {
      setIsGenerating(false);
      dispatch(
        setGenerating({
          generating: false,
          isResponseCompleted: true,
          generationSuccess: "success",
        }),
      );
    }
  };

  const mapFileArrayToObject = (input: any[]): Record<string, any> => {
    const map: Record<string, any> = {};
    input.forEach((item: any) => {
      if (!item || typeof item !== "object") return;
      const path = item.path || item.file || item.name;
      const code =
        item.contents ??
        item.content ??
        item.code ??
        (item.file && typeof item.file === "object"
          ? item.file.contents || item.file.content || item.file.code
          : undefined);
      if (!path || typeof path !== "string") return;
      if (typeof code !== "string") return;
      map[path] = normalizeIncomingFileContent(code);
    });
    return map;
  };

  const looksLikePathKey = (value: string): boolean => {
    const trimmed = value.trim().replace(/^\/+/, "");
    if (!trimmed || trimmed.endsWith("/")) return false;
    if (trimmed.includes(".") || trimmed.includes("/")) return true;
    const fileName = trimmed.toLowerCase();
    return (
      fileName === "dockerfile" ||
      fileName === "makefile" ||
      fileName === "license" ||
      fileName === "readme"
    );
  };

  const safelyParse = (data: any): Record<string, any> => {
    if (!data) return {};

    let parsed = data;
    if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.error("Failed to parse project data string:", e);
        return {};
      }
    }

    // If it's an array (like the Code model structure), convert to map
    if (Array.isArray(parsed)) {
      return mapFileArrayToObject(parsed);
    }

    if (typeof parsed !== "object") {
      return {};
    }

    const record = parsed as Record<string, unknown>;

    if (Array.isArray(record.files)) {
      const mappedFiles = mapFileArrayToObject(record.files as any[]);
      if (Object.keys(mappedFiles).length > 0) return mappedFiles;
    }

    if (record.generatedFiles && typeof record.generatedFiles === "object") {
      return safelyParse(record.generatedFiles);
    }

    if (record.initialCode && typeof record.initialCode === "object") {
      const parsedInitialCode = safelyParse(record.initialCode);
      if (Object.keys(parsedInitialCode).length > 0) return parsedInitialCode;
    }

    if (record.data && typeof record.data === "object") {
      const parsedData = safelyParse(record.data);
      if (Object.keys(parsedData).length > 0) return parsedData;
    }

    const mappedFromObject: Record<string, any> = {};
    Object.entries(record).forEach(([path, value]) => {
      if (!looksLikePathKey(path)) return;
      if (typeof value === "string") {
        mappedFromObject[path] = normalizeIncomingFileContent(value);
        return;
      }
      if (
        value &&
        typeof value === "object" &&
        "code" in value &&
        typeof (value as { code?: unknown }).code === "string"
      ) {
        mappedFromObject[path] = normalizeIncomingFileContent(
          (value as { code: string }).code,
        );
      }

      if (
        value &&
        typeof value === "object" &&
        "content" in value &&
        typeof (value as { content?: unknown }).content === "string"
      ) {
        mappedFromObject[path] = normalizeIncomingFileContent(
          (value as { content: string }).content,
        );
      }
    });

    if (Object.keys(mappedFromObject).length > 0) return mappedFromObject;
    return {};
  };

  const fetchProjectFiles = async (data: {
    url: string;
  }): Promise<Record<string, any> | null> => {
    try {
      dispatch(
        setGenerating({
          generating: true,
          generationSuccess: "success",
          isResponseCompleted: true,
        }),
      );
      const response = await fetch(data.url, {
        method: "GET",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const responseData = (await response.json()) as Record<string, any>;

        // Extract files from response data if they are nested
        const rawFiles =
          responseData.initialCode ||
          responseData.data ||
          responseData.generatedFiles ||
          responseData;
        const snapshotWrites = extractFileWritesFromSnapshot(rawFiles);
        const projectFiles =
          snapshotWrites.length > 0
            ? snapshotWrites.reduce<Record<string, string>>((acc, write) => {
                acc[write.path] = write.content;
                return acc;
              }, {})
            : safelyParse(rawFiles);

        const fallbackWrites = Object.entries(projectFiles).map(
          ([path, value]) => ({
            path,
            content:
              typeof value === "string"
                ? normalizeIncomingFileContent(value)
                : value &&
                    typeof value === "object" &&
                    "code" in value &&
                    typeof (value as { code?: unknown }).code === "string"
                  ? normalizeIncomingFileContent(
                      (value as { code: string }).code,
                    )
                  : JSON.stringify(value ?? "", null, 2),
          }),
        );
        const inferredRuntime = inferPreviewRuntimeFromWrites(
          snapshotWrites.length > 0 ? snapshotWrites : fallbackWrites,
        );
        if (inferredRuntime) {
          if (!(previewRuntime === "mobile" && inferredRuntime === "web")) {
            dispatch(setPreviewRuntime(inferredRuntime));
          }
        }

        // Just set the data in Redux - WebContainer writing will be handled elsewhere
        dispatch(setprojectFiles(buildFileTree(projectFiles)));
        dispatch(setprojectData(projectFiles));
        dispatch(setReaderMode(false));
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "success",
            isResponseCompleted: true,
          }),
        );

        // Return the data so it can be used by WebContainer-aware components
        return projectFiles;
      } else {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          }),
        );
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: "Preview is not available at the moment! Please try again.",
          }),
        );
        return null;
      }
    } catch (error) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to fetch project files!",
        }),
      );
      console.error(error);
      return null;
    }
  };

  // Helper function to build file tree for Redux store
  type FileContent = string | { code: string } | unknown;

  const buildFileTree = (
    fileMap: Record<string, FileContent>,
  ): Record<string, unknown> => {
    const tree: Record<string, unknown> = {};

    for (const [rawPath, contents] of Object.entries(fileMap)) {
      // Handle both string content and {code: "..."} format
      const fileContents = (() => {
        if (typeof contents === "string") {
          return normalizeIncomingFileContent(contents);
        }
        if (contents && typeof contents === "object" && contents !== null) {
          if ("code" in contents && typeof contents.code === "string") {
            return normalizeIncomingFileContent(
              (contents as { code: string }).code,
            );
          }
          if ("content" in contents && typeof contents.content === "string") {
            return normalizeIncomingFileContent(
              (contents as { content: string }).content,
            );
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
