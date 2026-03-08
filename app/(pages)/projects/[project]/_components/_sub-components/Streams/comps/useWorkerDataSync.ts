import { useEffect, useRef, useCallback } from "react";

interface UseWorkerDataSyncProps {
  refreshData: () => void;
  isProcessing: boolean;
  enabled?: boolean;
  syncInterval?: number;
}

export function useWorkerDataSync({
  refreshData,
  isProcessing,
  enabled = true,
  syncInterval = 2000, // Increased to 2 seconds to reduce load during streaming
}: UseWorkerDataSyncProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef(0);
  const mountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // OPTIMIZED: Non-blocking refresh with proper throttling
  const throttledRefresh = useCallback(() => {
    if (!mountedRef.current || isRefreshingRef.current) return;

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;

    // More aggressive throttling - minimum 1 second between refreshes
    if (timeSinceLastRefresh < 1000) {
      return;
    }

    // Don't refresh if currently processing
    if (isProcessing) {
      return;
    }

    isRefreshingRef.current = true;
    lastRefreshRef.current = now;

    // Use requestIdleCallback for non-blocking refresh
    const performRefresh = () => {
      if (!mountedRef.current) {
        isRefreshingRef.current = false;
        return;
      }

      try {
        refreshData();
      } catch (error) {
        console.warn("Refresh data error:", error);
      } finally {
        isRefreshingRef.current = false;
      }
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(performRefresh, { timeout: 1000 });
    } else {
      setTimeout(performRefresh, 0);
    }
  }, [refreshData, isProcessing]);

  useEffect(() => {
    if (!enabled || !mountedRef.current) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // OPTIMIZED: Less aggressive polling with better timing
    intervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;

      // Use throttled refresh instead of direct refresh
      throttledRefresh();
    }, syncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [throttledRefresh, enabled, syncInterval]);

  // OPTIMIZED: Cleanup with proper cancellation
  useEffect(() => {
    return () => {
      // Clear all timeouts and intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      isRefreshingRef.current = false;
    };
  }, []);

  // Pause sync when tab becomes hidden to save resources
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause sync when tab is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (enabled && !intervalRef.current) {
        // Resume sync when tab becomes visible
        intervalRef.current = setInterval(() => {
          if (!mountedRef.current) return;
          throttledRefresh();
        }, syncInterval);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, syncInterval, throttledRefresh]);
}
