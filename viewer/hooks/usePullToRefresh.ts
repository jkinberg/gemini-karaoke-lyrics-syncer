import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  /** Minimum pull distance to trigger refresh (default: 80px) */
  threshold?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
  /** Callback when refresh is triggered (default: page reload) */
  onRefresh?: () => void;
}

interface UsePullToRefreshReturn {
  /** Current pull distance in pixels */
  pullDistance: number;
  /** Whether currently in pulling state */
  isPulling: boolean;
  /** Whether refresh has been triggered */
  isRefreshing: boolean;
  /** Touch event handlers to spread on the container */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function usePullToRefresh({
  threshold = 80,
  enabled = true,
  onRefresh,
}: UsePullToRefreshOptions = {}): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || isRefreshing) return;

      // Only start pull if we're at the top of the page
      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      currentYRef.current = touch.clientY;
      setIsPulling(true);
    },
    [enabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !isPulling || isRefreshing) return;

      const touch = e.touches[0];
      currentYRef.current = touch.clientY;
      const distance = Math.max(0, currentYRef.current - startYRef.current);

      // Apply resistance - pull gets harder as you go further
      const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(resistedDistance);
    },
    [enabled, isPulling, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep indicator visible during refresh

      // Trigger refresh
      if (onRefresh) {
        onRefresh();
      } else {
        // Default: reload the page
        window.location.reload();
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

  // Reset state if disabled
  useEffect(() => {
    if (!enabled) {
      setPullDistance(0);
      setIsPulling(false);
      setIsRefreshing(false);
    }
  }, [enabled]);

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
