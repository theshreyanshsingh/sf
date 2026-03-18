import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getWorkerManager } from "./WorkerManager";
import { ProcessedResult } from "./streamTypes";
import { streamStorage } from "./streamStorage";

interface UseProjectWorkerReturn {
  processedContent: ProcessedResult | null;
  isProcessing: boolean;
  error: string | null;
  refreshData: () => void;
  clearProject: () => void;
}

export function useProjectWorker(): UseProjectWorkerReturn {
  const params = useParams();
  const projectId = (params?.project as string) || "default";

  const [processedContent, setProcessedContent] =
    useState<ProcessedResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // OPTIMIZED: Non-blocking data refresh using requestIdleCallback
  const refreshData = useCallback(async () => {
    // Prevent concurrent refresh operations
    if (processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      // Use requestIdleCallback for non-blocking operation
      const performRefresh = () => {
        return new Promise<ProcessedResult | null>((resolve) => {
          if ("requestIdleCallback" in window) {
            requestIdleCallback(async () => {
              try {
                const result =
                  await getWorkerManager().getProcessedData(projectId);
                resolve(result);
              } catch (error) {
                console.error("Worker data retrieval error:", error);
                resolve(null);
              }
            });
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(async () => {
              try {
                const result =
                  await getWorkerManager().getProcessedData(projectId);
                resolve(result);
              } catch (error) {
                console.error("Worker data retrieval error:", error);
                resolve(null);
              }
            }, 0);
          }
        });
      };

      const result = await performRefresh();

      if (result) {
        setProcessedContent(result);
      } else {
        setProcessedContent({ status: "empty", raw: "" });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Data retrieval failed";
      setError(errorMessage);
      console.error("Worker data retrieval error:", err);
      setProcessedContent({ status: "empty", raw: "" });
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [projectId]);

  // OPTIMIZED: Throttled refresh to prevent excessive calls
  const throttledRefreshData = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshData();
    }, 100); // 100ms throttle
  }, [refreshData]);

  const clearProject = useCallback(async () => {
    // Cancel any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    try {
      // Clear both worker and storage data
      getWorkerManager().cleanupProject(projectId);
      await streamStorage.clear(projectId);
      console.log(`Project ${projectId} data cleared from worker and storage`);
    } catch (error) {
      console.warn(`Failed to clear project ${projectId}:`, error);
    }

    setProcessedContent(null);
    setError(null);
    processingRef.current = false;
  }, [projectId]);

  // Cleanup on unmount or project change
  useEffect(() => {
    return () => {
      clearProject();
    };
  }, [projectId, clearProject]);

  // Initial data load on mount/project change
  useEffect(() => {
    throttledRefreshData();
  }, [projectId, throttledRefreshData]);

  return {
    processedContent,
    isProcessing,
    error,
    refreshData: throttledRefreshData, // Return throttled version
    clearProject,
  };
}
