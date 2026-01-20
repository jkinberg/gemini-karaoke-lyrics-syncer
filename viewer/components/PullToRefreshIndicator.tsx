import React from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  threshold: number;
  isRefreshing: boolean;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  threshold,
  isRefreshing,
}) => {
  if (pullDistance === 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress + 0.3, 1);
  const scale = 0.5 + progress * 0.5;

  return (
    <div
      className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
      style={{
        top: Math.max(pullDistance - 40, 8),
        opacity,
        transition: isRefreshing ? 'none' : 'opacity 0.2s',
      }}
    >
      <div
        className={`w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg ${
          isRefreshing ? 'animate-spin' : ''
        }`}
        style={{
          transform: isRefreshing ? 'scale(1)' : `scale(${scale}) rotate(${rotation}deg)`,
          transition: isRefreshing ? 'none' : 'transform 0.1s',
        }}
      >
        <svg
          className="w-5 h-5 text-purple-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
