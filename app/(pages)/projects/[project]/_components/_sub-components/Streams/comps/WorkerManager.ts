// Enhanced project-specific worker manager with IndexedDB support

// Import ProcessedResult type for type safety
import { ProcessedResult } from "./streamTypes";

// Type-safe interfaces
interface WorkerMessageHandler {
  (data: WorkerResponseData): void;
}

interface WorkerInstance {
  worker: Worker;
  projectId: string;
  lastActivity: number;
  isProcessing: boolean;
  messageHandlers: Map<string, WorkerMessageHandler>;
}

interface WorkerMessageData {
  content?: string;
  [key: string]: unknown;
}

interface WorkerMessage {
  type: "PARSE_STREAM" | "GET_PROCESSED_DATA" | "CLEAR_PROJECT" | "CLEANUP";
  projectId: string;
  messageId: string;
  data?: WorkerMessageData;
}

interface WorkerResponseData {
  processedContent?: ProcessedResult;
  error?: string;
  cleared?: boolean;
  allCleared?: boolean;
  [key: string]: unknown;
}

interface WorkerResponse {
  type: "PARSE_COMPLETE" | "DATA_RETRIEVED" | "ERROR" | "CLEANUP_COMPLETE";
  projectId: string;
  messageId: string;
  data?: WorkerResponseData;
}

class WorkerManager {
  private workers = new Map<string, WorkerInstance>();
  private readonly WORKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  private activeStreamSessions = new Set<string>(); // Track active streaming sessions

  constructor() {
    this.startCleanupInterval();
    // Clear IndexedDB on page load/reload
    this.clearAllIndexedDB();
  }

  private createWorkerCode(): string {
    return `
      // Enhanced project-specific stream processing worker with IndexedDB
      let projectData = new Map();
      let dbInstances = new Map(); // Store separate DB instances per project
      let lastProcessedContent = new Map(); // Track last processed content per project
      let processingTimeouts = new Map(); // Throttling timeouts
      
      // IndexedDB setup - project-specific database
      function initDB(projectId) {
        return new Promise((resolve, reject) => {
          // Check if we already have a DB instance for this project
          if (dbInstances.has(projectId)) {
            resolve(dbInstances.get(projectId));
            return;
          }
          
          const dbName = \`StreamProcessor_\${projectId}\`;
          const request = indexedDB.open(dbName, 1);
          
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const dbInstance = request.result;
            dbInstances.set(projectId, dbInstance);
            resolve(dbInstance);
          };
          
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('processedData')) {
              const store = db.createObjectStore('processedData', { keyPath: 'projectId' });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
          };
        });
      }
      
      // Store processed data in IndexedDB
      async function storeProcessedData(projectId, processedContent) {
        try {
          const db = await initDB(projectId);
          const transaction = db.transaction(['processedData'], 'readwrite');
          const store = transaction.objectStore('processedData');
          
          const dataToStore = {
            projectId,
            processedContent,
            timestamp: Date.now(),
            raw: processedContent.raw || ''
          };
          
          await new Promise((resolve, reject) => {
            const request = store.put(dataToStore);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          return true;
        } catch (error) {
          console.error('Failed to store processed data:', error);
          return false;
        }
      }
      
      // Retrieve processed data from IndexedDB
      async function getProcessedData(projectId) {
        try {
          const db = await initDB(projectId);
          const transaction = db.transaction(['processedData'], 'readonly');
          const store = transaction.objectStore('processedData');
          
          return new Promise((resolve, reject) => {
            const request = store.get(projectId);
            request.onsuccess = () => {
              const result = request.result;
              resolve(result ? result.processedContent : null);
            };
            request.onerror = () => reject(request.error);
          });
        } catch (error) {
          console.error('Failed to retrieve processed data:', error);
          return null;
        }
      }
      
      // Clear project data from IndexedDB - delete entire database
      async function clearProjectData(projectId) {
        try {
          // Close existing connection first for this specific project
          if (dbInstances.has(projectId)) {
            const dbInstance = dbInstances.get(projectId);
            dbInstance.close();
            dbInstances.delete(projectId);
          }
          
          const dbName = \`StreamProcessor_\${projectId}\`;
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          
          return new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => {
              console.log(\`Successfully deleted database for project: \${projectId}\`);
              resolve(true);
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onblocked = () => {
              console.warn(\`Database deletion blocked for \${projectId}\`);
              resolve(true);
            };
          });
        } catch (error) {
          console.error('Failed to clear project data:', error);
          return false;
        }
      }
      
      // No periodic cleanup needed since each project has its own database
      
      // Same parsing functions as streamParsers.ts but in worker context
      function parseStepsFromContent(content) {
        const steps = [];
        if (content.length < 10) return { steps, isComplete: false };

        const arrayStartIndex = content.indexOf("[");
        if (arrayStartIndex === -1) return { steps, isComplete: false };

        const genFilesIndex = content.indexOf('"generatedFiles"');
        const searchEndIndex = genFilesIndex !== -1 ? genFilesIndex : content.length;

        if (searchEndIndex - arrayStartIndex < 5) return { steps, isComplete: false };

        const stepsSection = content.slice(arrayStartIndex, searchEndIndex);
        const isComplete = stepsSection.includes("]");

        const quotedStringRegex = /"((?:[^"\\\\]|\\\\.)*)"/g;
        const seenSteps = new Set();
        const matches = stepsSection.matchAll(quotedStringRegex);

        for (const match of matches) {
          let stepContent = match[1];
          if (!stepContent) continue;

          stepContent = stepContent
            .replace(/useResponse\\.tsx:\\d+\\s*/g, "")
            .replace(/\\s+/g, " ")
            .trim();

          if (
            stepContent.length > 10 &&
            stepContent.length < 200 &&
            !stepContent.includes("{") &&
            !stepContent.includes("}") &&
            !stepContent.includes("[") &&
            !stepContent.includes("]") &&
            !seenSteps.has(stepContent)
          ) {
            seenSteps.add(stepContent);
            steps.push(stepContent);
            if (steps.length >= 50) break;
          }
        }

        return { steps, isComplete };
      }

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

        const completeFileRegex = /"([^"\\\\]+\\.[a-zA-Z0-9]+)"\\s*:\\s*\\{\\s*"code"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"\\s*\\}/g;
        const completeMatches = genFilesContent.matchAll(completeFileRegex);

        for (const match of completeMatches) {
          const filePath = match[1];
          let codeContent = match[2];

          if (filePath && codeContent && !seenPaths.has(filePath)) {
            seenPaths.add(filePath);
            potentialPaths.push({ filePath, id: filePath });

            codeContent = decodeJsonString(codeContent);
            completeBlocks.push({
              filePath,
              codeContent,
              id: filePath,
            });
          }

          if (potentialPaths.length >= 100) break;
        }

        const pathOnlyRegex = /"([^"\\\\]+\\.[a-zA-Z0-9]+)"\\s*:\\s*\\{/g;
        const pathMatches = genFilesContent.matchAll(pathOnlyRegex);

        for (const match of pathMatches) {
          const filePath = match[1];
          if (filePath && !seenPaths.has(filePath)) {
            seenPaths.add(filePath);
            potentialPaths.push({
              filePath,
              id: filePath,
            });
          }

          if (potentialPaths.length >= 100) break;
        }

        return { potentialPaths, completeBlocks };
      }

      function parseFilesListFromContent(content) {
        const fileList = [];
        let filesCount = 0;

        if (content.length < 15) return { fileList, filesCount };

        const filesCountMatch = content.match(/"filesCount"\\s*:\\s*(\\d+)/);
        if (filesCountMatch?.[1]) {
          filesCount = parseInt(filesCountMatch[1], 10);
        }

        const filesArrayMatch = content.match(/"files"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)/);
        if (filesArrayMatch && filesArrayMatch[1]) {
          const filesContent = filesArrayMatch[1];

          const filePathRegex = /"([^"\\\\]*(?:\\\\.[^"\\\\]*)*\\.(?:js|jsx|ts|tsx|py|java|c|cpp|cs|html|css|scss|less|json|yaml|yml|md|sh|toml|txt|xml|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|otf)[^"\\\\]*)"/gi;
          const matches = filesContent.matchAll(filePathRegex);

          for (const match of matches) {
            const filePath = match[1];

            if (
              filePath &&
              filePath.includes(".") &&
              (filePath.includes("/") || filePath.includes("\\\\")) &&
              filePath.length > 3 &&
              filePath.length < 500
            ) {
              fileList.push(filePath);
              if (fileList.length >= 500) break;
            }
          }
        }

        return { fileList, filesCount };
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

      // Enhanced processing with IndexedDB storage and throttling
      async function processStreamContent(projectId, content, modelName = '') {
        const rawString = typeof content === "string" ? content : "";

        // Check if content has changed to avoid redundant processing
        const lastContent = lastProcessedContent.get(projectId);
        if (lastContent === rawString) {
          // Return cached result if content hasn't changed
          const cached = projectData.get(projectId);
          if (cached) return cached;
        }

        if (!rawString.trim()) {
          const result = { status: "empty", raw: rawString };
          lastProcessedContent.set(projectId, rawString);
          await storeProcessedData(projectId, result);
          return result;
        }

        let result;
        
        // Route based on model name
        // Claude-only parsing
        result = parseNonGPTFormat(rawString);

        // Store in both memory and IndexedDB
        lastProcessedContent.set(projectId, rawString);
        projectData.set(projectId, result);
        await storeProcessedData(projectId, result);
        return result;
      }

      // Simple GPT format parser
      function parseGPTFormat(rawString) {
        // Extract the useful JSON from GPT stream
        let cleanedContent = rawString;
        let targetJson = '';
        
        // Handle ___start___ format (Kimi-k2)
        if (cleanedContent.includes('___start___')) {
          const startIndex = cleanedContent.indexOf('___start___') + '___start___'.length;
          let endIndex = cleanedContent.length;
          
          if (cleanedContent.includes('___end___')) {
            endIndex = cleanedContent.indexOf('___end___');
          }
          
          targetJson = cleanedContent.substring(startIndex, endIndex).trim();
        }
        // Handle complex metadata format (GPT-4.1)  
        else {
          // Remove ___end___ marker if present
          if (cleanedContent.includes('___end___')) {
            cleanedContent = cleanedContent.substring(0, cleanedContent.indexOf('___end___'));
          }
          
          // Find the JSON object that contains "Steps" or "generatedFiles"
          const jsonMatches = cleanedContent.match(/\\{[^}]*?"(?:Steps|generatedFiles)"[^}]*?[^{]*\\}/gs);
          
          if (jsonMatches) {
            // Find the largest/most complete JSON object
            for (const match of jsonMatches) {
              if (match.includes('"Steps"') && match.includes('"generatedFiles"')) {
                targetJson = match;
                break;
              }
            }
            // If no complete match, try to build from parts
            if (!targetJson) {
              // Look for the JSON that starts with Steps and extract everything until we find generatedFiles and files
              const stepsStart = cleanedContent.indexOf('{"');
              const stepsMatch = cleanedContent.substring(stepsStart).match(/\\{[\\s\\S]*?"files"\\s*:\\s*\\[[\\s\\S]*?\\]\\s*,\\s*"filesCount"\\s*:\\s*\\d+\\s*\\}/);
              if (stepsMatch) {
                targetJson = stepsMatch[0];
              }
            }
          }
          
          // Fallback: extract manually if regex fails
          if (!targetJson) {
            const stepsIndex = cleanedContent.indexOf('"Steps"');
            if (stepsIndex > -1) {
              // Find the opening brace before "Steps"
              let startIndex = stepsIndex;
              while (startIndex > 0 && cleanedContent[startIndex] !== '{') {
                startIndex--;
              }
              
              // Find the closing brace after "filesCount"
              const filesCountIndex = cleanedContent.indexOf('"filesCount"', stepsIndex);
              if (filesCountIndex > -1) {
                let endIndex = filesCountIndex;
                let braceCount = 0;
                let foundClosing = false;
                
                // Count from start to find matching closing brace
                for (let i = startIndex; i < cleanedContent.length; i++) {
                  if (cleanedContent[i] === '{') braceCount++;
                  if (cleanedContent[i] === '}') braceCount--;
                  if (braceCount === 0 && i > filesCountIndex) {
                    endIndex = i;
                    foundClosing = true;
                    break;
                  }
                }
                
                if (foundClosing) {
                  targetJson = cleanedContent.substring(startIndex, endIndex + 1);
                }
              }
            }
          }
        }
        
        // If no valid JSON found, try one more fallback - extract any JSON-like content
        if (!targetJson || !targetJson.includes('"Steps"')) {
          // Look for any { that contains "Steps" 
          const allJsonMatches = rawString.match(/\\{[\\s\\S]*?"Steps"[\\s\\S]*?\\}/g);
          if (allJsonMatches && allJsonMatches.length > 0) {
            // Take the longest match as it's likely the most complete
            targetJson = allJsonMatches.reduce((longest, current) => 
              current.length > longest.length ? current : longest
            );
          }
        }
        
        // Final check - if still no valid content, create minimal structure to avoid raw display
        if (!targetJson || !targetJson.includes('"Steps"')) {
          // Return a minimal structure to prevent raw data display
          return {
            status: "streaming_json",
            raw: rawString,
            innerContent: '{"Steps":["Processing..."]}',
            stepsArray: ["Processing..."],
            isStepsComplete: false,
            potentialCodeBlockPaths: [],
            identifiedCompleteCodeBlocks: [],
            identifiedFileListItems: [],
            filesCount: 0,
            hasGenFilesKey: false,
            hasFilesKey: false,
            hasJsonPrefix: true,
            hasJsonSuffix: false,
            hasStepsArray: true,
          };
        }
        
        const hasComplete = targetJson.includes('"filesCount"');
        
        // Extract steps
        const stepsArray = [];
        const stepsMatch = targetJson.match(/"Steps"\\s*:\\s*\\[([\\s\\S]*?)\\]/);
        if (stepsMatch) {
          const stepsContent = stepsMatch[1];
          const stepMatches = stepsContent.match(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g);
          if (stepMatches) {
            stepMatches.forEach(match => {
              try {
                stepsArray.push(JSON.parse(match));
              } catch {
                stepsArray.push(match.slice(1, -1));
              }
            });
          }
        }
        
        // Extract files
        const identifiedFileListItems = [];
        const filesMatch = targetJson.match(/"files"\\s*:\\s*\\[([\\s\\S]*?)\\]/);
        if (filesMatch) {
          const filesContent = filesMatch[1];
          const fileMatches = filesContent.match(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g);
          if (fileMatches) {
            fileMatches.forEach(match => {
              try {
                identifiedFileListItems.push(JSON.parse(match));
              } catch {
                identifiedFileListItems.push(match.slice(1, -1));
              }
            });
          }
        }
        
        // Extract generated files
        const identifiedCompleteCodeBlocks = [];
        const potentialCodeBlockPaths = [];
        const genFilesMatch = targetJson.match(/"generatedFiles"\\s*:\\s*\\{([\\s\\S]*)\\}/);
        if (genFilesMatch) {
          const genFilesContent = genFilesMatch[1];
          // Simple extraction for file paths and code
          const codeMatches = genFilesContent.match(/"([^"]+)"\\s*:\\s*\\{\\s*"code"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/g);
          if (codeMatches) {
            codeMatches.forEach((match, index) => {
              const fileMatch = match.match(/"([^"]+)"\\s*:\\s*\\{\\s*"code"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"/);
              if (fileMatch) {
                const filePath = fileMatch[1];
                const codeContent = decodeJsonString(fileMatch[2]);
                const id = \`\${filePath}-\${index}\`;
                
                potentialCodeBlockPaths.push({ filePath, id });
                identifiedCompleteCodeBlocks.push({ filePath, codeContent, id });
              }
            });
          }
        }
        
        return {
          status: hasComplete ? "potentially_complete" : "streaming_json",
          raw: rawString,
          innerContent: targetJson,
          stepsArray,
          isStepsComplete: hasComplete,
          potentialCodeBlockPaths,
          identifiedCompleteCodeBlocks,
          identifiedFileListItems,
          filesCount: identifiedFileListItems.length,
          hasGenFilesKey: targetJson.includes('"generatedFiles"'),
          hasFilesKey: targetJson.includes('"files"'),
          hasJsonPrefix: true,
          hasJsonSuffix: hasComplete,
          hasStepsArray: stepsArray.length > 0,
        };
      }

      // Non-GPT format parser (existing logic renamed)
      function parseNonGPTFormat(rawString) {
        const hasJsonPrefix = rawString.startsWith('["');
        const hasJsonSuffix = rawString.endsWith("___end___");

        if (!hasJsonPrefix) {
          // Instead of raw_unexpected, return minimal structure
          return {
            status: "streaming_json",
            raw: rawString,
            innerContent: '["Processing..."]',
            stepsArray: ["Processing..."],
            isStepsComplete: false,
            potentialCodeBlockPaths: [],
            identifiedCompleteCodeBlocks: [],
            identifiedFileListItems: [],
            filesCount: 0,
            hasGenFilesKey: false,
            hasFilesKey: false,
            hasJsonPrefix: true,
            hasJsonSuffix: false,
            hasStepsArray: true,
          };
        }

        let innerContent = rawString;
        if (hasJsonSuffix) {
          innerContent = rawString.slice(0, -"___end___".length);
        }

        const hasStepsArray = innerContent.startsWith("[");
        const hasGenFilesKey = innerContent.includes('"generatedFiles":');
        const hasFilesKey = innerContent.includes('"files":');

        const shouldParseSteps = hasStepsArray && innerContent.length > 50;
        const shouldParseCodeBlocks = hasGenFilesKey && innerContent.length > 100;
        const shouldParseFilesList = hasFilesKey && innerContent.length > 50;

        const { steps: stepsArray, isComplete: isStepsComplete } = shouldParseSteps
          ? parseStepsFromContent(innerContent)
          : { steps: [], isComplete: false };

        const {
          potentialPaths: potentialCodeBlockPaths,
          completeBlocks: identifiedCompleteCodeBlocks,
        } = shouldParseCodeBlocks
          ? parseCodeBlocksFromContent(innerContent)
          : { potentialPaths: [], completeBlocks: [] };

        const { fileList: identifiedFileListItems, filesCount } = shouldParseFilesList
          ? parseFilesListFromContent(innerContent)
          : { fileList: [], filesCount: 0 };

        return {
          status: hasJsonSuffix ? "potentially_complete" : "streaming_json",
          raw: rawString,
          innerContent,
          stepsArray,
          isStepsComplete,
          potentialCodeBlockPaths,
          identifiedCompleteCodeBlocks,
          identifiedFileListItems,
          filesCount,
          hasGenFilesKey,
          hasFilesKey,
          hasJsonPrefix: true,
          hasJsonSuffix,
          hasStepsArray,
        };
      }

      self.onmessage = async function(e) {
        const { type, projectId, messageId, data } = e.data;

        try {
          switch (type) {
            case 'PARSE_STREAM':
              const processedContent = await processStreamContent(projectId, data?.content, data?.modelName);
              self.postMessage({
                type: 'PARSE_COMPLETE',
                projectId,
                messageId,
                data: { processedContent }
              });
              break;

            case 'GET_PROCESSED_DATA':
              const storedData = await getProcessedData(projectId);
              self.postMessage({
                type: 'DATA_RETRIEVED',
                projectId,
                messageId,
                data: { processedContent: storedData }
              });
              break;

            case 'CLEAR_PROJECT':
              projectData.delete(projectId);
              lastProcessedContent.delete(projectId);
              processingTimeouts.delete(projectId);
              await clearProjectData(projectId);
              self.postMessage({
                type: 'CLEANUP_COMPLETE',
                projectId,
                messageId,
                data: { cleared: true }
              });
              break;

            case 'CLEANUP':
              // Clear all project data and close all database connections
              projectData.clear();
              lastProcessedContent.clear();
              processingTimeouts.clear();
              
              // Close all database connections
              dbInstances.forEach((db, pid) => {
                try {
                  db.close();
                } catch (e) {
                  console.warn(\`Failed to close DB for project \${pid}:\`, e);
                }
              });
              dbInstances.clear();
              
              self.postMessage({
                type: 'CLEANUP_COMPLETE',
                projectId,
                messageId,
                data: { allCleared: true }
              });
              break;

            default:
              throw new Error(\`Unknown message type: \${type}\`);
          }
        } catch (error) {
          self.postMessage({
            type: 'ERROR',
            projectId,
            messageId,
            data: { error: error.message || 'Unknown error' }
          });
        }
      };
    `;
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  getWorker(projectId: string): Promise<WorkerInstance> {
    return new Promise((resolve, reject) => {
      try {
        // Check if worker already exists for this project
        const existing = this.workers.get(projectId);
        if (existing) {
          existing.lastActivity = Date.now();
          // Don't block if worker is processing - each project should have its own worker
          resolve(existing);
          return;
        }

        // Create new worker for this project
        console.log(`Creating new worker for project: ${projectId}`);
        const workerCode = this.createWorkerCode();
        const blob = new Blob([workerCode], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        const workerInstance: WorkerInstance = {
          worker,
          projectId,
          lastActivity: Date.now(),
          isProcessing: false,
          messageHandlers: new Map(),
        };

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const { messageId, data } = e.data;
          const handler = workerInstance.messageHandlers.get(messageId);

          if (handler && data) {
            handler(data);
            workerInstance.messageHandlers.delete(messageId);
          }

          workerInstance.isProcessing = false;
          workerInstance.lastActivity = Date.now();
        };

        worker.onerror = (error: ErrorEvent) => {
          console.error(`Worker error for project ${projectId}:`, error);
          this.cleanupWorker(projectId);
          reject(
            new Error(
              `Worker error: ${error.message || "Unknown worker error"}`
            )
          );
        };

        this.workers.set(projectId, workerInstance);
        URL.revokeObjectURL(workerUrl);
        resolve(workerInstance);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Unknown error in getWorker")
        );
      }
    });
  }

  /**
   * Process stream content using a dedicated worker for the project
   * @param projectId - The project identifier
   * @param content - The content to process
   * @param modelName - The model name to determine parsing strategy
   * @returns Promise that resolves to processed result
   */
  async processStream(
    projectId: string,
    content: string,
    modelName?: string
  ): Promise<ProcessedResult> {
    return new Promise<ProcessedResult>(async (resolve, reject) => {
      try {
        // CLEANUP: Only cleanup if this is truly a NEW streaming session
        const isStreamStart =
          content.includes("___start___") &&
          !this.activeStreamSessions.has(projectId);
        const isStreamRestart =
          content.includes("___start___") &&
          !this.activeStreamSessions.has(projectId);

        if (isStreamStart || isStreamRestart) {
          console.log(
            `NEW streaming session started for project ${projectId}, cleaning up previous data`
          );
          // Don't await cleanup - let it run in background to avoid blocking
          this.cleanupProjectData(projectId).catch((error) => {
            console.warn(`Background cleanup failed for ${projectId}:`, error);
          });
          this.activeStreamSessions.add(projectId);
        }

        // Mark session as ended if we see end markers and cleanup
        if (content.includes("___end___")) {
          console.log(
            `Streaming session ended for project ${projectId}, scheduling cleanup`
          );
          this.activeStreamSessions.delete(projectId);

          // Schedule cleanup after processing is complete
          setTimeout(async () => {
            await this.clearProjectIndexedDB(projectId);
            this.cleanupWorker(projectId);
          }, 1000);
        }

        const workerInstance = await this.getWorker(projectId);
        const messageId = this.generateMessageId();

        workerInstance.isProcessing = true;

        // Set up message handler with proper typing
        workerInstance.messageHandlers.set(
          messageId,
          (data: WorkerResponseData) => {
            if (data?.processedContent) {
              resolve(data.processedContent);
            } else if (data?.error) {
              reject(new Error(data.error));
            } else {
              reject(new Error("Unknown worker response"));
            }
          }
        );

        const message: WorkerMessage = {
          type: "PARSE_STREAM",
          projectId,
          messageId,
          data: { content, modelName },
        };

        workerInstance.worker.postMessage(message);

        // Shorter timeout for better responsiveness
        setTimeout(() => {
          workerInstance.messageHandlers.delete(messageId);
          workerInstance.isProcessing = false;
          console.warn(`Processing timeout for project ${projectId}`);
          // Return empty result instead of rejecting
          resolve({ status: "empty", raw: content });
        }, 15000); // Reduced to 15 seconds
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Unknown error in processStream")
        );
      }
    });
  }

  /**
   * Get processed data from IndexedDB for a specific project
   * @param projectId - The project identifier
   * @returns Promise that resolves to processed data or null if not found
   */
  async getProcessedData(projectId: string): Promise<ProcessedResult | null> {
    return new Promise<ProcessedResult | null>(async (resolve, reject) => {
      try {
        const workerInstance = await this.getWorker(projectId);
        const messageId = this.generateMessageId();

        // Set up message handler with proper typing
        workerInstance.messageHandlers.set(
          messageId,
          (data: WorkerResponseData) => {
            if (data?.processedContent !== undefined) {
              resolve(data.processedContent);
            } else if (data?.error) {
              reject(new Error(data.error));
            } else {
              reject(new Error("Unknown worker response"));
            }
          }
        );

        const message: WorkerMessage = {
          type: "GET_PROCESSED_DATA",
          projectId,
          messageId,
        };

        workerInstance.worker.postMessage(message);

        // Shorter timeout for better responsiveness
        setTimeout(() => {
          workerInstance.messageHandlers.delete(messageId);
          console.warn(
            `Data retrieval timeout for project ${projectId}, returning null`
          );
          resolve(null); // Return null instead of rejecting to prevent errors
        }, 5000); // Reduced to 5 seconds
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Unknown error in getProcessedData")
        );
      }
    });
  }

  cleanupProject(projectId: string): void {
    const workerInstance = this.workers.get(projectId);
    if (workerInstance) {
      const messageId = this.generateMessageId();
      const message: WorkerMessage = {
        type: "CLEAR_PROJECT",
        projectId,
        messageId,
      };
      workerInstance.worker.postMessage(message);
    }
  }

  private async cleanupProjectData(projectId: string): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        const workerInstance = this.workers.get(projectId);
        if (workerInstance) {
          const messageId = this.generateMessageId();

          // Set up cleanup completion handler with shorter timeout
          const cleanupTimeout = setTimeout(() => {
            workerInstance.messageHandlers.delete(messageId);
            console.warn(
              `Cleanup timeout for project ${projectId}, continuing anyway`
            );
            resolve(); // Don't block - continue processing
          }, 2000); // Reduced to 2 seconds

          workerInstance.messageHandlers.set(
            messageId,
            (data: WorkerResponseData) => {
              clearTimeout(cleanupTimeout);
              console.log(
                `Cleaned up previous data for project: ${projectId} and ${data}`
              );
              resolve();
            }
          );

          const message: WorkerMessage = {
            type: "CLEAR_PROJECT",
            projectId,
            messageId,
          };

          workerInstance.worker.postMessage(message);
        } else {
          // No existing worker, just resolve immediately
          resolve();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown cleanup error";
        console.warn(`Cleanup failed for project ${projectId}:`, errorMessage);
        resolve(); // Don't block processing if cleanup fails
      }
    });
  }

  // Public method to force cleanup of project data
  async forceCleanupProject(projectId: string): Promise<void> {
    console.log(`Force cleaning up project: ${projectId}`);
    this.activeStreamSessions.delete(projectId); // End any active session
    await this.cleanupProjectData(projectId);
  }

  // Public method to end a streaming session and cleanup IndexedDB
  async endStreamingSession(projectId: string): Promise<void> {
    console.log(
      `Ending streaming session and cleaning up for project: ${projectId}`
    );
    this.activeStreamSessions.delete(projectId);

    // Clean up the project's IndexedDB
    await this.clearProjectIndexedDB(projectId);

    // Clean up the worker
    this.cleanupWorker(projectId);
  }

  // Check if a project is currently streaming
  isProjectStreaming(projectId: string): boolean {
    return this.activeStreamSessions.has(projectId);
  }

  // Get all active streaming projects
  getActiveStreamingProjects(): string[] {
    return Array.from(this.activeStreamSessions);
  }

  // Get worker count for debugging
  getWorkerCount(): number {
    return this.workers.size;
  }

  // Debug method to check what databases exist
  async debugDatabases(): Promise<void> {
    try {
      if ("databases" in indexedDB) {
        const databases = await indexedDB.databases();
        console.log(
          "Existing IndexedDB databases:",
          databases.map((db) => db.name)
        );
      } else {
        console.log("indexedDB.databases() not supported in this browser");
      }
    } catch (error) {
      console.warn("Failed to list databases:", error);
    }
  }

  // Clean up worker for specific project
  private cleanupWorker(projectId: string): void {
    const workerInstance = this.workers.get(projectId);
    if (workerInstance) {
      console.log(`Terminating worker for project: ${projectId}`);
      workerInstance.worker.terminate();
      this.workers.delete(projectId);
      this.activeStreamSessions.delete(projectId); // Clean up session tracking

      console.log(`Worker cleanup completed for project: ${projectId}`);
    } else {
      console.log(`No worker found to cleanup for project: ${projectId}`);
    }
  }

  // Force IndexedDB cleanup directly (bypass worker) for specific project
  private async forceIndexedDBCleanup(projectId: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Check if stream is active before forcing cleanup
        if (this.isProjectStreaming(projectId)) {
          console.warn(
            `Cannot force cleanup IndexedDB for active stream: ${projectId}`
          );
          resolve();
          return;
        }

        console.log(
          `Force deleting IndexedDB database for project: ${projectId}`
        );
        const dbName = `StreamProcessor_${projectId}`;

        // First try to close any open connections
        try {
          const openRequest = indexedDB.open(dbName);
          openRequest.onsuccess = () => {
            const db = openRequest.result;
            db.close();

            // Now delete the database
            const deleteRequest = indexedDB.deleteDatabase(dbName);

            deleteRequest.onsuccess = () => {
              console.log(
                `IndexedDB force deleted successfully for project: ${projectId}`
              );
              resolve();
            };

            deleteRequest.onerror = () => {
              console.warn(
                `Failed to force delete IndexedDB for project: ${projectId}`
              );
              resolve();
            };

            deleteRequest.onblocked = () => {
              console.warn(
                `IndexedDB force deletion blocked for project: ${projectId}`
              );
              resolve();
            };
          };

          openRequest.onerror = () => {
            // Database doesn't exist, that's fine
            console.log(`Database ${dbName} doesn't exist, cleanup complete`);
            resolve();
          };
        } catch (error) {
          console.warn(`Error during force cleanup for ${projectId}:`, error);
          resolve();
        }

        // Timeout after 3 seconds
        setTimeout(() => {
          console.warn(
            `IndexedDB force deletion timeout for project: ${projectId}`
          );
          resolve();
        }, 3000);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown force cleanup error";
        console.warn("Error in force IndexedDB cleanup:", errorMessage);
        resolve();
      }
    });
  }

  // Public method to clear all project IndexedDB databases
  async clearAllIndexedDB(): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        // Get all active project IDs and clear their databases
        const projectIds = Array.from(this.workers.keys());
        const clearPromises = projectIds.map((projectId) =>
          this.clearProjectIndexedDB(projectId)
        );

        await Promise.all(clearPromises);
        console.log("All project IndexedDB databases cleared successfully");
        resolve();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown IndexedDB clear error";
        console.warn("Error clearing IndexedDB:", errorMessage);
        resolve();
      }
    });
  }

  // Public method to clear IndexedDB for specific project (force cleanup)
  /**
   * Clear IndexedDB data for a specific project
   * @param projectId - The project identifier
   * @returns Promise that resolves when cleanup is complete
   */
  async clearProjectIndexedDB(projectId: string): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        // Check if stream is active before clearing
        if (this.isProjectStreaming(projectId)) {
          console.warn(
            `Cannot clear IndexedDB for active stream: ${projectId}`
          );
          resolve();
          return;
        }

        // First try worker-based cleanup
        const workerInstance = this.workers.get(projectId);
        if (workerInstance) {
          const messageId = this.generateMessageId();

          const cleanupTimeout = setTimeout(() => {
            workerInstance.messageHandlers.delete(messageId);
            console.warn(
              `IndexedDB cleanup timeout for project ${projectId}, forcing cleanup`
            );
            // Force cleanup if worker doesn't respond
            this.forceIndexedDBCleanup(projectId);
            resolve();
          }, 2000); // Shorter timeout

          workerInstance.messageHandlers.set(
            messageId,
            (data: WorkerResponseData) => {
              clearTimeout(cleanupTimeout);
              console.log(
                `IndexedDB cleared for project: ${projectId} and ${data}`
              );
              resolve();
            }
          );

          const message: WorkerMessage = {
            type: "CLEAR_PROJECT",
            projectId,
            messageId,
          };

          workerInstance.worker.postMessage(message);
        } else {
          // No worker, force cleanup directly
          console.log(
            `No worker found for project ${projectId}, forcing IndexedDB cleanup`
          );
          await this.forceIndexedDBCleanup(projectId);
          resolve();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown IndexedDB cleanup error";
        console.warn(
          `Failed to clear IndexedDB for project ${projectId}:`,
          errorMessage
        );
        // Force cleanup on error
        await this.forceIndexedDBCleanup(projectId);
        resolve();
      }
    });
  }

  // Force IndexedDB cleanup directly (bypass worker) for specific project
  //   private async forceIndexedDBCleanup(projectId: string): Promise<void> {
  //     return new Promise((resolve) => {
  //       try {
  //         console.log(
  //           `Force deleting IndexedDB database for project: ${projectId}`
  //         );
  //         const dbName = `StreamProcessor_${projectId}`;
  //         const deleteRequest = indexedDB.deleteDatabase(dbName);

  //         deleteRequest.onsuccess = () => {
  //           console.log(
  //             `IndexedDB force deleted successfully for project: ${projectId}`
  //           );
  //           resolve();
  //         };

  //         deleteRequest.onerror = () => {
  //           console.warn(
  //             `Failed to force delete IndexedDB for project: ${projectId}`
  //           );
  //           resolve();
  //         };

  //         deleteRequest.onblocked = () => {
  //           console.warn(
  //             `IndexedDB force deletion blocked for project: ${projectId}`
  //           );
  //           resolve();
  //         };

  //         // Timeout after 3 seconds
  //         setTimeout(() => {
  //           console.warn(
  //             `IndexedDB force deletion timeout for project: ${projectId}`
  //           );
  //           resolve();
  //         }, 3000);
  //       } catch (error) {
  //         const errorMessage =
  //           error instanceof Error
  //             ? error.message
  //             : "Unknown force cleanup error";
  //         console.warn("Error in force IndexedDB cleanup:", errorMessage);
  //         resolve();
  //       }
  //     });
  //   }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toCleanup: string[] = [];

      this.workers.forEach((instance, projectId) => {
        // Only cleanup if worker has been inactive for the timeout period
        // AND is not currently processing
        if (
          !instance.isProcessing &&
          now - instance.lastActivity > this.WORKER_TIMEOUT &&
          !this.activeStreamSessions.has(projectId) // Don't cleanup active sessions
        ) {
          toCleanup.push(projectId);
        }
      });

      toCleanup.forEach((projectId) => {
        console.log(`Cleaning up inactive worker for project: ${projectId}`);
        this.cleanupWorker(projectId);
      });
    }, 30000); // Check every 30 seconds for better responsiveness
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.workers.forEach((instance) => {
      instance.worker.terminate();
    });

    this.workers.clear();
    this.activeStreamSessions.clear(); // Clean up session tracking
  }
}

// Singleton instance
let workerManagerInstance: WorkerManager | null = null;

/**
 * Get the singleton WorkerManager instance
 * @returns The WorkerManager instance
 */
export const getWorkerManager = (): WorkerManager => {
  if (!workerManagerInstance) {
    workerManagerInstance = new WorkerManager();

    // Cleanup on page unload and reload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        workerManagerInstance?.destroy();
        // Clear IndexedDB on page unload/reload
        workerManagerInstance?.clearAllIndexedDB();
      });

      // Also clear on page visibility change (when user switches tabs/minimizes)
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          workerManagerInstance?.clearAllIndexedDB();
        }
      });
    }
  }
  return workerManagerInstance;
};

export { WorkerManager };
