import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setGenerating,
  setPromptCount,
  setReaderMode,
} from "../redux/reducers/projectOptions";
import {
  EmptySheet,
  setEmptyMarkdown,
  setMarkdown,
  setNewProjectData,
  setprojectData,
  setprojectFiles,
} from "../redux/reducers/projectFiles";
import { setNotification } from "../redux/reducers/NotificationModalReducer";
import { useAuthenticated } from "../helpers/useAuthenticated";
import { AppDispatch, RootState } from "../redux/store";
import { saveMoreDatatoProject } from "./projects";

import { clearImages, clearImagesURL } from "../redux/reducers/basicData";
import { useWebContainerContext } from "../redux/useWebContainerContext";
import { API } from "../config/publicEnv";

interface GenerateFileParams {
  email: string;
  projectId: string;
  input: string;
}

interface FetchProjectFilesParams {
  url: string;
}

function decodeJsonString(str: string | null | undefined): string {
  if (!str) return "";
  try {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\f/g, "\f")
      .replace(/\\b/g, "\b")
      .replace(/\\\\/g, "\\");
  } catch (e) {
    console.error("Error decoding string:", e);
    return str;
  }
}

export const maxDuration = 60;

export const useGenerateFile = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { email } = useAuthenticated();
  const {
    projectId,
    framework,
    csslib,
    memory,
    promptCount,
    enh_prompt,
  } = useSelector((state: RootState) => state.projectOptions);
  const { data } = useSelector((state: RootState) => state.projectFiles); //files
  const { images, imageURLs } = useSelector(
    (state: RootState) => state.basicData,
  );
  const { messages } = useSelector(
    (state: RootState) => state.messagesprovider,
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const { webcontainerInstance } = useWebContainerContext();

  /**
   * On first time the container becomes ready, push whatever is already in
   * Redux `projectFiles.data` into its filesystem so the user can compile/run.
   */
  const hasInitialSync = useRef(false);
  useEffect(() => {
    if (!hasInitialSync.current && webcontainerInstance && data) {
      hasInitialSync.current = true;
      (async () => {
        try {
          await writeFilesToWebContainer(data as Record<string, any>);
        } catch (e) {
          console.error("Initial container sync failed", e);
        }
      })();
    }
  }, [webcontainerInstance, data]);

  const handleMessage = async (text: string) => {
    const msg: { role: "user" | "ai"; text: string } = {
      role: "ai",
      text: text,
    };

    // dispatch(sendaMessage(msg));
  };

  function extractGeneratedFilesObjectString(rawMarkdown: string) {
    if (typeof rawMarkdown !== "string" || !rawMarkdown.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawMarkdown);
      if (
        parsed &&
        typeof parsed.generatedFiles === "object" &&
        parsed.generatedFiles !== null
      ) {
        return parsed.generatedFiles;
      }
      return null;
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  // Separate function for Claude and other non-GPT models
  const handleNonGptStreaming = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
  ) => {
    const selectedModel = sessionStorage.getItem("model") || "claude-sonnet-4.5";
    let rawContent = "";
    let displayBuffer = "";
    let isClaudeModel = selectedModel.toLowerCase().includes("claude");
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

          rawContent += content;
          displayBuffer += content;

          if (isClaudeModel) {
            // Claude-specific logic: look for ```json markers
            if (!isCapturing && displayBuffer.includes("```json")) {
              dispatch(setMarkdown("___start___{"));
              isCapturing = true;

              // Remove everything up to and including ```json
              const jsonIndex = displayBuffer.indexOf("```json");
              displayBuffer = displayBuffer.substring(jsonIndex + 7);

              // Skip the opening { if present
              displayBuffer = displayBuffer.replace(/^\s*\{/, "");
            }

            if (isCapturing) {
              // Check for closing ``` to stop capturing
              if (displayBuffer.includes("```")) {
                const endIndex = displayBuffer.indexOf("```");
                let jsonContent = displayBuffer.substring(0, endIndex);

                // Remove the closing } if present
                jsonContent = jsonContent.replace(/\}\s*$/, "");

                dispatch(setMarkdown(jsonContent + "}___end___"));
                isCapturing = false;
                displayBuffer = "";
              } else {
                // Only dispatch JSON content while capturing
                dispatch(setMarkdown(displayBuffer));
                displayBuffer = "";
              }
            }
          } else {
            // Non-Claude models: stream everything normally (they already have ___start___ and ___end___ markers)
            if (displayBuffer.length > 50 || content.includes("\n")) {
              dispatch(setMarkdown(displayBuffer));
              displayBuffer = "";
            }
          }
        }
      }
    }

    // Handle remaining display buffer
    if (displayBuffer && !isClaudeModel) {
      dispatch(setMarkdown(displayBuffer));
    }

    return rawContent;
  };

  // Enhanced extraction function for Claude/marker formats
  const extractFromNonGptFormat = (rawContent: string) => {
    if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
      return null;
    }
    console.log("rawContent", rawContent);

    // Handle marker format with ___start___ markers
    if (rawContent.includes("___start___")) {
      const startIndex = rawContent.indexOf("___start___");
      if (startIndex !== -1) {
        let jsonContent = rawContent.slice(startIndex + 11); // Remove "___start___"

        // Remove ___end___ marker if present
        const endIndex = jsonContent.indexOf("___end___");
        if (endIndex !== -1) {
          jsonContent = jsonContent.slice(0, endIndex);
        }

        try {
          const parsed = JSON.parse(jsonContent);
          if (
            parsed &&
            typeof parsed.generatedFiles === "object" &&
            parsed.generatedFiles !== null
          ) {
            return parsed.generatedFiles;
          }
        } catch (parseError) {
          console.log(
            "Failed to parse JSON from marker format:",
            parseError,
          );
        }
      }
    }

    // Try direct JSON parsing (marker format)
    try {
      const parsed = JSON.parse(rawContent);
      if (
        parsed &&
        typeof parsed.generatedFiles === "object" &&
        parsed.generatedFiles !== null
      ) {
        return parsed.generatedFiles;
      }
    } catch (e) {
      // Try extracting from markdown block (Claude format)
      const jsonBlockRegex = /```json\s*\n?([\s\S]*?)```/;
      const match = rawContent.match(jsonBlockRegex);

      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1].trim());
          if (
            parsed &&
            typeof parsed.generatedFiles === "object" &&
            parsed.generatedFiles !== null
          ) {
            return parsed.generatedFiles;
          }
        } catch (parseError) {
          console.log("Failed to parse JSON from markdown block:", parseError);
        }
      }
    }

    return null;
  };

  // Separate extraction function specifically for Claude models
  const extractFromClaudeFormat = (rawContent: string) => {
    if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
      return null;
    }

    console.log("Extracting from Claude format:", rawContent);

    try {
      // Claude responses often contain multiple JSON objects followed by a ```json block
      // First, try to find the ```json block which contains the actual generated files
      const jsonBlockRegex = /```json\s*\n?([\s\S]*?)```/;
      const match = rawContent.match(jsonBlockRegex);

      if (match && match[1]) {
        let jsonContent = match[1].trim();

        // Sometimes the JSON content might be malformed, try to clean it up
        // Remove any trailing commas or incomplete structures
        jsonContent = jsonContent.replace(/,\s*$/, "");

        try {
          const parsed = JSON.parse(jsonContent);
          if (
            parsed &&
            typeof parsed.generatedFiles === "object" &&
            parsed.generatedFiles !== null
          ) {
            console.log("Successfully extracted from Claude JSON block");
            return parsed.generatedFiles;
          }
        } catch (parseError) {
          console.log(
            "Failed to parse JSON from Claude block, trying to fix:",
            parseError,
          );

          // Try to extract just the generatedFiles part if the JSON is malformed
          const generatedFilesRegex =
            /"generatedFiles"\s*:\s*({[\s\S]*?})\s*(?:,|\}|$)/;
          const filesMatch = jsonContent.match(generatedFilesRegex);

          if (filesMatch && filesMatch[1]) {
            try {
              const generatedFiles = JSON.parse(filesMatch[1]);
              console.log(
                "Successfully extracted generatedFiles from partial Claude JSON",
              );
              return generatedFiles;
            } catch (e) {
              console.log("Failed to parse partial generatedFiles:", e);
            }
          }
        }
      }

      // Fallback: try to parse individual JSON objects in the response
      // Claude sometimes sends multiple JSON objects concatenated
      const jsonObjectRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const jsonObjects = rawContent.match(jsonObjectRegex);

      if (jsonObjects) {
        for (const jsonStr of jsonObjects) {
          try {
            const parsed = JSON.parse(jsonStr);
            if (
              parsed &&
              typeof parsed.generatedFiles === "object" &&
              parsed.generatedFiles !== null
            ) {
              console.log("Successfully extracted from Claude JSON object");
              return parsed.generatedFiles;
            }
          } catch (e) {
            // Continue to next JSON object
            continue;
          }
        }
      }

      // Another fallback: look for the generatedFiles pattern directly in the raw content
      const directFilesRegex = /"generatedFiles"\s*:\s*({[\s\S]*?})/;
      const directMatch = rawContent.match(directFilesRegex);

      if (directMatch && directMatch[1]) {
        try {
          const generatedFiles = JSON.parse(directMatch[1]);
          console.log(
            "Successfully extracted generatedFiles directly from Claude content",
          );
          return generatedFiles;
        } catch (e) {
          console.log("Failed to parse direct generatedFiles:", e);
        }
      }
    } catch (error) {
      console.error("Error extracting from Claude format:", error);
    }

    return null;
  };

  // New streaming handler for non-web-components frameworks
  const handleNewFrameworkStreaming = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
  ) => {
    let rawContent = "";
    let displayBuffer = "";
    let isCapturing = false;
    let jsonContent = "";

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

          rawContent += content;
          displayBuffer += content;

          // Check for ```json to start capturing
          if (!isCapturing && displayBuffer.includes("```json")) {
            isCapturing = true;
            // Remove everything up to and including ```json
            const jsonIndex = displayBuffer.lastIndexOf("```json");
            displayBuffer = displayBuffer.substring(jsonIndex + 7);
            jsonContent = ""; // Reset json content
            // Dispatch start marker
            dispatch(setMarkdown("___start___"));
            continue;
          }

          if (isCapturing) {
            // Check for closing ``` to stop capturing
            if (displayBuffer.includes("```")) {
              const endIndex = displayBuffer.indexOf("```");
              jsonContent += displayBuffer.substring(0, endIndex);

              // Dispatch the remaining content and end marker
              dispatch(
                setMarkdown(displayBuffer.substring(0, endIndex) + "___end___"),
              );

              isCapturing = false;
              displayBuffer = displayBuffer.substring(endIndex + 3);
            } else {
              // Continue capturing JSON content
              jsonContent += displayBuffer;
              dispatch(setMarkdown(displayBuffer));
              displayBuffer = "";
            }
          }
        }
      }
    }

    return rawContent;
  };

  // Enhanced extraction function for new framework format
  const extractFromNewFrameworkFormat = (rawContent: string) => {
    if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
      return null;
    }

    console.log("Extracting from new framework format:", rawContent);

    try {
      // Extract content between ```json and ``` - get all matches
      const jsonBlockRegex = /```json\s*\n?([\s\S]*?)```/g;
      const matches = [...rawContent.matchAll(jsonBlockRegex)];

      // Try each JSON block to find one with generatedFiles
      for (const match of matches) {
        if (match && match[1]) {
          let jsonContent = match[1].trim();

          try {
            const parsed = JSON.parse(jsonContent);
            if (
              parsed &&
              typeof parsed.generatedFiles === "object" &&
              parsed.generatedFiles !== null
            ) {
              console.log(
                "Successfully extracted from new framework JSON block",
              );
              return parsed.generatedFiles;
            }
          } catch (parseError) {
            console.log("Failed to parse JSON block, trying next:", parseError);
            continue; // Try the next JSON block
          }
        }
      }

      // Fallback: try to extract generatedFiles directly from the content
      const directFilesRegex = /"generatedFiles"\s*:\s*({[\s\S]*?})\s*(?:,|\})/;
      const directMatch = rawContent.match(directFilesRegex);

      if (directMatch && directMatch[1]) {
        try {
          const generatedFiles = JSON.parse(directMatch[1]);
          console.log(
            "Successfully extracted generatedFiles directly from content",
          );
          return generatedFiles;
        } catch (e) {
          console.log("Failed to parse direct generatedFiles:", e);
        }
      }
    } catch (error) {
      console.error("Error extracting from new framework format:", error);
    }

    return null;
  };

  const genFile = async ({ email, projectId, input }: GenerateFileParams) => {
    try {
      if (!email) return;

      const selectedModel = sessionStorage.getItem("model") || "claude-sonnet-4.5";

      const rawString = JSON.stringify({
        prompt: input,
        memory: sessionStorage.getItem("memory") || "",
        cssLib: sessionStorage.getItem("css") || "tailwindcss",
        framework: sessionStorage.getItem("framework") || "react",
        projectId: projectId || "",
        owner: email || "",
        images,
        model: selectedModel,
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

      // Choose endpoint based on selected framework - v1 route is for the multiagent and agent_webcomps is for webcomponents agent
      const selectedFramework =
        sessionStorage.getItem("framework") || framework;

      const apiEndpoint =
        selectedFramework === "web-components"
          ? "/v1/agent_webcomps"
          : "/v1/agent";

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let files;

      // Route to appropriate streaming handler based on framework and model
      if (selectedFramework !== "web-components") {
        // New streaming handler for non-web-components frameworks
        const rawContent = await handleNewFrameworkStreaming(reader, decoder);
        files = extractFromNewFrameworkFormat(rawContent);
      } else {
        // Handle Claude models for web-components
        const rawContent = await handleNonGptStreaming(reader, decoder);

        // Use Claude-specific extraction for Claude models, fallback to generic for others
        if (selectedModel.toLowerCase().includes("claude")) {
          files = extractFromClaudeFormat(rawContent);
        } else {
          files = extractFromNonGptFormat(rawContent);
        }
      }

      if (files) {
        // 1. Persist to WebContainer FS so preview/dev-server can pick it up
        await writeFilesToWebContainer(files as Record<string, string>);

        // 2. Build hierarchical tree & expose to explorer
        const fileTree = buildFileTree(files as Record<string, string>);
        dispatch(setprojectFiles(fileTree));

        // 3. Keep raw map in state for future prompts / save-to-backend
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
    } catch (error) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Something went wrong & we are working on it!",
        }),
      );
      dispatch(setEmptyMarkdown(""));
      dispatch(setReaderMode(false));
      console.error(error);
    }
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
      const map: Record<string, any> = {};
      parsed.forEach((item: any) => {
        const path = item.path || item.file || item.name;
        const code = item.contents || item.code || item.contents;
        if (path) {
          map[path] = code;
        }
      });
      return map;
    }

    return typeof parsed === "object" ? parsed : {};
  };

  const fetchProjectFiles = async (data: FetchProjectFilesParams) => {
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
        const projectFiles = safelyParse(rawFiles);

        // Write & visualise the fetched project
        await writeFilesToWebContainer(projectFiles as Record<string, string>);
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
    }
  };

  function extractMessagesObjectString(
    rawMarkdown: string | null | undefined,
  ): object | null {
    if (
      !rawMarkdown ||
      typeof rawMarkdown !== "string" ||
      !rawMarkdown.trim()
    ) {
      return null;
    }

    const jsonBlockRegex = /```json\n([\s\S]*?)```/;
    const match = rawMarkdown.match(jsonBlockRegex);
    if (!match) {
      return null;
    }

    const innerContent = match[1].trim();

    try {
      const parsed = JSON.parse(innerContent);
      if (parsed.generatedFiles && typeof parsed.generatedFiles === "object") {
        return parsed.generatedFiles;
      } else {
        return null;
      }
    } catch (e) {
      console.error(
        "extractGeneratedFilesObjectString: Error parsing JSON:",
        e,
      );
      return null;
    }
  }

  const sendMessagetoAI = async ({
    message,
  }: {
    message: { role: "ai" | "user"; text: string; image?: string[] };
  }) => {
    try {
      dispatch(setEmptyMarkdown(""));
      dispatch(setReaderMode(false));

      // //saving user msg
      // dispatch(
      //   saveMsgToDb({
      //     text: message.text,
      //     email: email.value || "",
      //     projectId: projectId || "",
      //     role: "user",
      //     image: imageURLs,
      //   })
      // );

      dispatch(
        setGenerating({
          generating: true,
          isResponseCompleted: true,
          generationSuccess: "thinking",
        }),
      );

      const finalData = JSON.stringify({
        userPrompt: message,
        framework,
        csslib,
        memory,
        chatHistory: messages,
        data,
        images: imageURLs,
      });

      dispatch(clearImages());
      dispatch(clearImagesURL());

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: finalData,
      });

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${await response.text()}`,
        );
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalMakrdown = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (typeof chunk === "string") {
          finalMakrdown += chunk;
          dispatch(setMarkdown(chunk));
        }
      }

      const files = extractMessagesObjectString(finalMakrdown);

      if (files) {
        // Persist / render incremental AI changes
        await writeFilesToWebContainer(files as Record<string, string>);
        dispatch(
          setprojectFiles(buildFileTree({ ...(data as any), ...files })),
        );

        saveMoreDatatoProject({
          data: JSON.stringify({ ...data, ...files }),
          email: email.value || "",
          projectId: projectId || "",
        });

        dispatch(setNewProjectData({ ...files }));
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "success",
            isResponseCompleted: true,
          }),
        );

        //extracting end message
        const rawString =
          typeof finalMakrdown === "string" ? finalMakrdown : "";
        if (!rawString.trim()) return { status: "empty", raw: rawString };
        const hasJsonPrefix = rawString.startsWith("```json\n");
        const hasJsonSuffix = rawString.endsWith("```");
        if (!hasJsonPrefix) return { status: "raw_unexpected", raw: rawString };

        const innerContent = rawString
          .substring(
            "```json\n".length,
            hasJsonSuffix ? rawString.length - "```".length : rawString.length,
          )
          .trimStart();

        let endMessageContent: string | null = null;
        const hasEndMessageKey = innerContent.includes('"endMessage":');

        if (hasEndMessageKey) {
          const endMessageRegex = /"endMessage":\s*"((?:\\.|[^\\"])*)"/;
          const endMessageMatch = innerContent.match(endMessageRegex);

          if (endMessageMatch && endMessageMatch[1] !== undefined) {
            endMessageContent = decodeJsonString(endMessageMatch[1]);

            handleMessage(endMessageContent);

            // // saving ai's msg
            // dispatch(
            //   saveMsgToDb({
            //     text: endMessageContent,
            //     email: email.value || "",
            //     projectId: projectId || "",
            //     role: "ai",
            //   })
            // );
          } else {
            handleMessage("Done, would you like me to do something else?");
          }
        }
      } else {
        dispatch(
          setGenerating({
            generating: false,
            generationSuccess: "failed",
            isResponseCompleted: true,
          }),
        );
      }

      // dispatch(sendaMessage({ role: "ai", text: chunk }));
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Error Generating responsse!",
        }),
      );
    }
    dispatch(setEmptyMarkdown(""));
    dispatch(setReaderMode(false));
  };

  const fixWithAI = async () => {
    try {
      dispatch(setEmptyMarkdown(""));
      dispatch(setReaderMode(false));
      dispatch(EmptySheet());

      dispatch(
        setGenerating({
          generating: true,
          isResponseCompleted: true,
          generationSuccess: "thinking",
        }),
      );

      if (typeof promptCount === "number" && promptCount > 0) {
        dispatch(setPromptCount(promptCount - 1));
      }

      const finalData = JSON.stringify({
        userPrompt: enh_prompt,
        framework,
        csslib,
        memory,
        chatHistory: messages,
        data,
        images: imageURLs,
      });

      dispatch(clearImages());
      dispatch(clearImagesURL());

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: finalData,
      });

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${await response.text()}`,
        );
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalMakrdown = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (typeof chunk === "string") {
          finalMakrdown += chunk;
          dispatch(setMarkdown(chunk));
        }
      }

      const files = extractMessagesObjectString(finalMakrdown);

      if (files) {
        await writeFilesToWebContainer(files as Record<string, string>);
        dispatch(
          setprojectFiles(buildFileTree({ ...(data as any), ...files })),
        );

        dispatch(setNewProjectData({ ...files }));
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

      // dispatch(sendaMessage({ role: "ai", text: chunk }));
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Error Generating responsse!",
        }),
      );
    }
    dispatch(setEmptyMarkdown(""));
    dispatch(setReaderMode(false));
  };

  /**
   * Normalize the server response so every value is a string of file contents.
   * API sometimes sends `{ code: "..." }` instead of raw string.
   */
  const normalizeFileMap = (
    fileMap: Record<string, any>,
  ): Record<string, string> => {
    const normalized: Record<string, string> = {};

    for (const [path, value] of Object.entries(fileMap)) {
      if (typeof value === "string") {
        normalized[path] = value;
      } else if (value && typeof value === "object" && "code" in value) {
        normalized[path] = value.code as string;
      } else {
        normalized[path] = JSON.stringify(value, null, 2);
      }
    }

    return normalized;
  };

  /**
   * Ensure each path exists in the WebContainer and write the file.
   */
  const writeFilesToWebContainer = async (fileMap: Record<string, any>) => {
    if (!webcontainerInstance) return;

    const normalized = normalizeFileMap(fileMap);

    for (const [rawPath, contentStr] of Object.entries(normalized)) {
      if (typeof contentStr !== "string") continue; // safeguard

      const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

      const dir = path.substring(0, path.lastIndexOf("/"));
      if (dir) {
        try {
          await webcontainerInstance.fs.mkdir(dir, { recursive: true });
        } catch {
          /* already exists */
        }
      }

      try {
        await webcontainerInstance.fs.writeFile(path, contentStr, "utf-8");
      } catch (e) {
        console.error("Failed writing", path, e);
      }
    }
  };

  /**
   * Convert a flat map into explorer tree (uses normalized map internally).
   */
  const buildFileTree = (fileMap: Record<string, any>): Record<string, any> => {
    const normalized = normalizeFileMap(fileMap);
    const tree: Record<string, any> = {};

    for (const [rawPath, contents] of Object.entries(normalized)) {
      const parts = rawPath.replace(/^\/+/, "").split("/");
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

  return {
    genFile,
    fetchProjectFiles,
    extractGeneratedFilesObjectString,
    isGenerating,
    sendMessagetoAI,
    fixWithAI,
  };
};
