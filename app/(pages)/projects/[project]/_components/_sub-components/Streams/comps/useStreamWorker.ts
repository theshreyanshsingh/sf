import { useEffect, useRef, useCallback, useState } from "react";
import { streamStorage } from "./streamStorage";

interface UseStreamWorkerReturn {
  processChunk: (content: string) => void;
  isProcessing: boolean;
  totalChunks: number;
  error: string | null;
  clearCache: () => void;
}

export function useStreamWorker(
  projectId: string = "default"
): UseStreamWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker and storage
  useEffect(() => {
    const initializeWorker = async () => {
      try {
        // Initialize IndexedDB with projectId
        await streamStorage.init(projectId);

        // Clear any existing duplicates from previous sessions
        try {
          await streamStorage.deduplicateStorage(projectId);
        } catch (error) {
          console.warn("Failed to deduplicate storage on init:", error);
        }

        // Create worker from inline code to avoid file path issues
        const workerCode = `
          // Web Worker code using existing parsing logic
          const chunkCache = new Map();

          // Same parseCodeBlocksFromContent logic as in streamParsers.ts
          function parseCodeBlocksFromContent(content) {
            const potentialPaths = [];
            const completeBlocks = [];

            if (content.length < 20) return { potentialPaths, completeBlocks };

            const genFilesMatch = content.match(/"generatedFiles"\\s*:\\s*\\{/);
            if (!genFilesMatch || !genFilesMatch.index) return { potentialPaths, completeBlocks };

            const genFilesStart = genFilesMatch.index + genFilesMatch[0].length;
            let genFilesContent = content.slice(genFilesStart);

            if (genFilesContent.length < 10) return { potentialPaths, completeBlocks };

            genFilesContent = genFilesContent.replace(/useResponse\\.tsx:\\d+\\s*/g, "");

            const seenPaths = new Set();
            let potentialIndex = 0;

            // Enhanced regex for complete file blocks
            const completeFileRegex = /"([^"\\\\]+\\.[a-zA-Z0-9]+)"\\s*:\\s*\\{\\s*"code"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"\\s*\\}/g;

            const completeMatches = genFilesContent.matchAll(completeFileRegex);

            for (const match of completeMatches) {
              const filePath = match[1];
              let codeContent = match[2];

              if (filePath && codeContent && !seenPaths.has(filePath)) {
                seenPaths.add(filePath);
                const pathId = \`\${filePath}-\${potentialIndex++}\`;

                potentialPaths.push({ filePath, id: pathId });

                codeContent = decodeJsonString(codeContent);
                completeBlocks.push({
                  filePath,
                  codeContent,
                  id: pathId,
                });
              }

              if (potentialPaths.length >= 100) break;
            }

            // Enhanced regex for potential file paths
            const pathOnlyRegex = /"([^"\\\\]+\\.[a-zA-Z0-9]+)"\\s*:\\s*\\{/g;
            const pathMatches = genFilesContent.matchAll(pathOnlyRegex);

            for (const match of pathMatches) {
              const filePath = match[1];
              if (filePath && !seenPaths.has(filePath)) {
                seenPaths.add(filePath);
                potentialPaths.push({
                  filePath,
                  id: \`\${filePath}-\${potentialIndex++}\`,
                });
              }

              if (potentialPaths.length >= 100) break;
            }

            return { potentialPaths, completeBlocks };
          }

          function decodeJsonString(str) {
            if (!str) return "";
            try {
              return str.replace(/\\\\(n|"|t|r|f|b|\\\\)/g, (match, char) => {
                switch (char) {
                  case "n": return "\\n";
                  case '"': return '"';
                  case "t": return "\\t";
                  case "r": return "\\r";
                  case "f": return "\\f";
                  case "b": return "\\b";
                  case "\\\\": return "\\\\";
                  default: return match;
                }
              });
            } catch (e) {
              console.error("Error decoding string:", e);
              return str;
            }
          }

          function processStreamChunk(rawContent) {
            const chunks = [];
            
            try {
              const { potentialPaths, completeBlocks } = parseCodeBlocksFromContent(rawContent);
              
              // Create a map to deduplicate by filePath
              const fileMap = new Map();
              
              // First, add all potential paths
              potentialPaths.forEach(path => {
                if (!fileMap.has(path.filePath)) {
                  fileMap.set(path.filePath, {
                    id: path.filePath, // Use filePath as unique ID
                    filePath: path.filePath,
                    codeContent: undefined,
                    isComplete: false,
                    timestamp: Date.now()
                  });
                }
              });
              
              // Then, update with complete blocks (overwrite if exists)
              completeBlocks.forEach(block => {
                fileMap.set(block.filePath, {
                  id: block.filePath, // Use filePath as unique ID
                  filePath: block.filePath,
                  codeContent: block.codeContent,
                  isComplete: true,
                  timestamp: Date.now()
                });
              });
              
              // Convert map to array and update cache
              fileMap.forEach((chunk, filePath) => {
                chunks.push(chunk);
                chunkCache.set(filePath, chunk); // Use filePath as cache key
              });
              
            } catch (error) {
              console.error('Error processing stream chunk:', error);
            }
            
            return chunks;
          }

          self.onmessage = function(e) {
            const { type, data } = e.data;
            
            try {
              switch (type) {
                case 'PROCESS_CHUNK':
                  const chunks = processStreamChunk(data.content);
                  self.postMessage({
                    type: 'CHUNK_PROCESSED',
                    data: { chunks, totalCached: chunkCache.size }
                  });
                  break;
                  
                case 'CLEAR_CACHE':
                  chunkCache.clear();
                  self.postMessage({ type: 'CHUNK_PROCESSED', data: { cleared: true } });
                  break;
                  
                default:
                  throw new Error(\`Unknown message type: \${type}\`);
              }
            } catch (error) {
              self.postMessage({
                type: 'ERROR',
                error: error.message || 'Unknown error'
              });
            }
          };
        `;

        const blob = new Blob([workerCode], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);

        workerRef.current = new Worker(workerUrl);

        workerRef.current.onmessage = async (e) => {
          const { type, data, error } = e.data;

          switch (type) {
            case "CHUNK_PROCESSED":
              if (data.chunks && data.chunks.length > 0) {
                try {
                  // Ensure database is initialized before storing
                  await streamStorage.init(projectId);
                  await streamStorage.storeChunks(projectId, data.chunks);
                  const total = await streamStorage.getTotalCount(projectId);
                  setTotalChunks(total);
                } catch (storageError) {
                  console.error(
                    `Failed to store chunks for project ${projectId}:`,
                    storageError
                  );
                  // Don't set error state for storage issues, just log them
                }
              }
              setIsProcessing(false);
              break;

            case "ERROR":
              setError(error);
              setIsProcessing(false);
              break;
          }
        };

        workerRef.current.onerror = (error) => {
          setError("Worker error: " + error.message);
          setIsProcessing(false);
        };

        // Clean up blob URL
        URL.revokeObjectURL(workerUrl);
      } catch (err) {
        setError("Failed to initialize worker: " + (err as Error).message);
      }
    };

    initializeWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [projectId]);

  const processChunk = useCallback(
    (content: string) => {
      if (workerRef.current && !isProcessing) {
        setIsProcessing(true);
        setError(null);
        workerRef.current.postMessage({
          type: "PROCESS_CHUNK",
          data: { content },
        });
      }
    },
    [isProcessing]
  );

  const clearCache = useCallback(async () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "CLEAR_CACHE" });
    }
    // Also clear streamStorage for this project
    try {
      await streamStorage.clear(projectId);
      console.log(`Cache and storage cleared for project: ${projectId}`);
    } catch (error) {
      console.warn(`Failed to clear storage for project ${projectId}:`, error);
    }
    setTotalChunks(0);
  }, [projectId]);

  return {
    processChunk,
    isProcessing,
    totalChunks,
    error,
    clearCache,
  };
}
