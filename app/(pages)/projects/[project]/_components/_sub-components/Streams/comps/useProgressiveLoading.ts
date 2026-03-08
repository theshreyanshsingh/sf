import { useState, useEffect, useCallback } from "react";

interface UseProgressiveLoadingOptions {
  totalItems: number;
  batchSize?: number;
  delay?: number;
  autoStart?: boolean;
}

interface UseProgressiveLoadingReturn {
  visibleCount: number;
  isLoading: boolean;
  isComplete: boolean;
  loadNext: () => void;
  loadAll: () => void;
  reset: () => void;
  progress: number;
}

export function useProgressiveLoading({
  totalItems,
  batchSize = 1,
  delay = 200,
  autoStart = true,
}: UseProgressiveLoadingOptions): UseProgressiveLoadingReturn {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const isComplete = visibleCount >= totalItems;
  const progress = totalItems > 0 ? (visibleCount / totalItems) * 100 : 0;

  const loadNext = useCallback(() => {
    if (visibleCount < totalItems && !isLoading) {
      setIsLoading(true);
      setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + batchSize, totalItems));
        setIsLoading(false);
      }, delay);
    }
  }, [visibleCount, totalItems, isLoading, batchSize, delay]);

  const loadAll = useCallback(() => {
    setVisibleCount(totalItems);
    setIsLoading(false);
  }, [totalItems]);

  const reset = useCallback(() => {
    setVisibleCount(0);
    setIsLoading(false);
  }, []);

  // Auto-start loading when totalItems changes
  useEffect(() => {
    if (autoStart && totalItems > visibleCount && !isLoading) {
      loadNext();
    }
  }, [totalItems, visibleCount, isLoading, autoStart, loadNext]);

  return {
    visibleCount,
    isLoading,
    isComplete,
    loadNext,
    loadAll,
    reset,
    progress,
  };
}
