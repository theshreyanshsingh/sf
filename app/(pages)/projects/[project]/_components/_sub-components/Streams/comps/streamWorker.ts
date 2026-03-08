// Web Worker for processing large stream data off the main thread
interface StreamChunk {
  id: string;
  filePath: string;
  codeContent?: string;
  isComplete: boolean;
  timestamp: number;
}

interface WorkerMessage {
  type: "PROCESS_CHUNK" | "PARSE_COMPLETE_BLOCKS" | "CLEAR_CACHE";
  data?: {
    content?: string;
    [key: string]: unknown;
  };
}

interface WorkerResponse {
  type: "CHUNK_PROCESSED" | "BLOCKS_PARSED" | "ERROR";
  data?: {
    chunks?: StreamChunk[];
    totalCached?: number;
    blocks?: StreamChunk[];
    cleared?: boolean;
    [key: string]: unknown;
  };
  error?: string;
}

// Cache for processed chunks
const chunkCache = new Map<string, StreamChunk>();

// Process individual stream chunks
function processStreamChunk(rawContent: string): StreamChunk[] {
  const chunks: StreamChunk[] = [];

  try {
    // Enhanced regex for complete file blocks with better performance
    const completeFileRegex =
      /"([^"\\]+\.[a-zA-Z0-9]+)"\s*:\s*\{\s*"code"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"\s*\}/g;

    let match;
    let index = 0;

    while (
      (match = completeFileRegex.exec(rawContent)) !== null &&
      index < 100
    ) {
      const filePath = match[1];
      let codeContent = match[2];

      if (filePath && codeContent) {
        // Decode JSON string escapes
        codeContent = decodeJsonString(codeContent);

        const chunk: StreamChunk = {
          id: `${filePath}-${index}`,
          filePath,
          codeContent,
          isComplete: true,
          timestamp: Date.now(),
        };

        chunks.push(chunk);
        chunkCache.set(chunk.id, chunk);
        index++;
      }
    }

    // Also find potential file paths (incomplete blocks)
    const pathOnlyRegex = /"([^"\\]+\.[a-zA-Z0-9]+)"\s*:\s*\{/g;

    while ((match = pathOnlyRegex.exec(rawContent)) !== null && index < 200) {
      const filePath = match[1];
      const chunkId = `${filePath}-${index}`;

      if (filePath && !chunkCache.has(chunkId)) {
        const chunk: StreamChunk = {
          id: chunkId,
          filePath,
          isComplete: false,
          timestamp: Date.now(),
        };

        chunks.push(chunk);
        chunkCache.set(chunk.id, chunk);
        index++;
      }
    }
  } catch (error) {
    console.error("Error processing stream chunk:", error);
  }

  return chunks;
}

// Decode JSON string escapes (same as helper but in worker context)
function decodeJsonString(str: string): string {
  if (!str) return "";
  try {
    return str.replace(/\\(n|"|t|r|f|b|\\)/g, (match, char) => {
      switch (char) {
        case "n":
          return "\n";
        case '"':
          return '"';
        case "t":
          return "\t";
        case "r":
          return "\r";
        case "f":
          return "\f";
        case "b":
          return "\b";
        case "\\":
          return "\\";
        default:
          return match;
      }
    });
  } catch (e) {
    console.error("Error decoding string:", e);
    return str;
  }
}

// Handle messages from main thread
self.onmessage = function (e: MessageEvent<WorkerMessage>) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case "PROCESS_CHUNK":
        const chunks = processStreamChunk(data?.content || "");
        const response: WorkerResponse = {
          type: "CHUNK_PROCESSED",
          data: { chunks, totalCached: chunkCache.size },
        };
        self.postMessage(response);
        break;

      case "PARSE_COMPLETE_BLOCKS":
        const completeBlocks = Array.from(chunkCache.values())
          .filter((chunk) => chunk.isComplete)
          .slice(0, 50); // Limit for performance

        const parseResponse: WorkerResponse = {
          type: "BLOCKS_PARSED",
          data: { blocks: completeBlocks },
        };
        self.postMessage(parseResponse);
        break;

      case "CLEAR_CACHE":
        chunkCache.clear();
        self.postMessage({ type: "CHUNK_PROCESSED", data: { cleared: true } });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorResponse: WorkerResponse = {
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    self.postMessage(errorResponse);
  }
};

export {};
