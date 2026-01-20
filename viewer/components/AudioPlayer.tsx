import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { AudioVisualizer } from './AudioVisualizer';
import { initPingSoundContext } from '../utils/pingSoundContext';
import { analytics } from '../utils/analytics';

// Icons
const PlayIcon = () => (
  <svg className="w-12 h-12 ml-1" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
  </svg>
);

const VolumeOffIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

interface AudioPlayerProps {
  trackId: string;
  audioUrl: string;
  expectedDurationMs?: number;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl: string;
  seekToTimeMs?: number | null;
  shouldPause?: boolean;
  hasNextTrack?: boolean;
  hasPrevTrack?: boolean;
  onTimeUpdate?: (timeMs: number) => void;
  onEnded?: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  persistedMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  trackId,
  audioUrl,
  expectedDurationMs,
  title,
  artist,
  album,
  thumbnailUrl,
  seekToTimeMs,
  shouldPause,
  hasNextTrack = true,
  hasPrevTrack = true,
  onTimeUpdate,
  onEnded,
  onNextTrack,
  onPrevTrack,
  persistedMuted = true,
  onMutedChange,
}) => {
  const [showControls, setShowControls] = useState(false);

  // Track if we've sent track_start for this track (only send once per track)
  const hasTrackedStartRef = useRef(false);
  // Track previous time for seek detection
  const previousTimeRef = useRef(0);

  // Reset tracking when track changes
  useEffect(() => {
    hasTrackedStartRef.current = false;
    previousTimeRef.current = 0;
  }, [trackId]);

  const {
    audioRef,
    analyserNode,
    isReady,
    isPlaying,
    isMuted,
    currentTimeMs,
    duration,
    error,
    play,
    pause,
    togglePlay,
    unmute,
    seekTo,
  } = useAudioPlayer({
    audioUrl,
    expectedDurationMs,
    onTimeUpdate,
    onEnded,
    initialMuted: persistedMuted,
  });

  // Scrubber state
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTimeMs / duration) * 100 : 0;
  const displayProgress = isDragging ? dragProgress : progress;

  // Handle scrubber interaction
  const handleScrubberInteraction = useCallback((clientX: number) => {
    if (!scrubberRef.current || duration <= 0) return;

    const rect = scrubberRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setDragProgress(percentage);

    return percentage;
  }, [duration]);

  const handleScrubberSeek = useCallback((percentage: number) => {
    const fromTimeMs = currentTimeMs;
    const timeMs = (percentage / 100) * duration;
    seekTo(timeMs);
    // Track seek event
    analytics.trackSeek(trackId, fromTimeMs / 1000, timeMs / 1000);
  }, [duration, seekTo, currentTimeMs, trackId]);

  // Mouse events for scrubber
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const percentage = handleScrubberInteraction(e.clientX);
    if (percentage !== undefined) {
      handleScrubberSeek(percentage);
    }
  }, [handleScrubberInteraction, handleScrubberSeek]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleScrubberInteraction(e.clientX);
  }, [isDragging, handleScrubberInteraction]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const percentage = handleScrubberInteraction(e.clientX);
    if (percentage !== undefined) {
      handleScrubberSeek(percentage);
    }
  }, [isDragging, handleScrubberInteraction, handleScrubberSeek]);

  // Touch events for scrubber
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    const touch = e.touches[0];
    const percentage = handleScrubberInteraction(touch.clientX);
    if (percentage !== undefined) {
      handleScrubberSeek(percentage);
    }
  }, [handleScrubberInteraction, handleScrubberSeek]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleScrubberInteraction(touch.clientX);
  }, [isDragging, handleScrubberInteraction]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const touch = e.changedTouches[0];
    const percentage = handleScrubberInteraction(touch.clientX);
    if (percentage !== undefined) {
      handleScrubberSeek(percentage);
    }
  }, [isDragging, handleScrubberInteraction, handleScrubberSeek]);

  // Add global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Handle external seek requests
  useEffect(() => {
    if (seekToTimeMs !== null && seekToTimeMs !== undefined && isReady) {
      seekTo(seekToTimeMs);
    }
  }, [seekToTimeMs, isReady, seekTo]);

  // Track previous shouldPause value to detect changes
  const prevShouldPauseRef = useRef(shouldPause);

  // Handle external pause/play requests - only respond to shouldPause changes
  useEffect(() => {
    if (!isReady) return;

    // Only act when shouldPause actually changes
    if (shouldPause !== prevShouldPauseRef.current) {
      prevShouldPauseRef.current = shouldPause;

      if (shouldPause) {
        pause();
      } else if (!isMuted) {
        // Resume playing when shouldPause becomes false (and user has interacted)
        play();
      }
    }
  }, [shouldPause, isReady, isMuted, pause, play]);

  // Notify parent of mute state changes
  useEffect(() => {
    onMutedChange?.(isMuted);
  }, [isMuted, onMutedChange]);

  // Swipe gesture for track navigation
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: onNextTrack,
    onSwipeRight: onPrevTrack,
    minSwipeDistance: 50,
    maxSwipeTime: 300,
  });

  // Handle tap on player
  const handlePlayerTap = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isMuted) {
      // First tap unmutes - also init ping sound context (requires user gesture)
      initPingSoundContext();
      unmute();

      // Track first unmute as track_start
      if (!hasTrackedStartRef.current) {
        hasTrackedStartRef.current = true;
        analytics.trackStart(trackId, title, artist, 'mobile');
      }
    } else {
      // Subsequent taps toggle play/pause
      togglePlay();

      // Track play/pause
      if (isPlaying) {
        analytics.trackPause(trackId, currentTimeMs / 1000, duration / 1000);
      } else {
        analytics.trackPlay(trackId, currentTimeMs / 1000);
      }

      // Only show controls briefly when playing (pause icon fades out)
      // When paused, the play icon is shown persistently
      if (!isPlaying) {
        // We're about to play, show pause icon briefly then fade
        setShowControls(true);
        setTimeout(() => setShowControls(false), 1200);
      }
    }
  };

  const playerElement = (
    <div
      className="relative bg-black cursor-pointer overflow-hidden"
      style={{ height: 200 }}
      onClick={handlePlayerTap}
      {...swipeHandlers}
    >
      {/* Hidden audio element - src and crossOrigin managed by useAudioPlayer hook */}
      <audio
        ref={audioRef}
        playsInline
        style={{ display: 'none' }}
      />

      {/* Thumbnail image with dark overlay */}
      <img
        src={thumbnailUrl}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Audio Visualizer overlay */}
      {isReady && !isMuted && analyserNode && (
        <AudioVisualizer
          analyserNode={analyserNode}
          isPlaying={isPlaying}
        />
      )}

      {/* Tap to Unmute overlay */}
      {isReady && isMuted && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-white animate-pulse">
              <VolumeOffIcon />
            </div>
            <div className="text-white font-semibold text-lg">Tap to Unmute</div>
          </div>
        </div>
      )}

      {/* Play button - shown persistently when paused */}
      {!isPlaying && !isMuted && isReady && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
            <PlayIcon />
          </div>
        </div>
      )}

      {/* Pause indicator - shown briefly when playing, with slow fade out */}
      {isPlaying && !isMuted && (
        <div
          className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-opacity duration-700 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
            <PauseIcon />
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
          <div className="text-center px-4">
            <div className="text-zinc-400 text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Song metadata overlay - top left, always visible */}
      <div className="absolute top-3 left-4 z-20">
        <div className="font-bold text-base leading-tight text-white drop-shadow-lg">{title}</div>
        <div className="text-zinc-300 text-sm drop-shadow-lg">{artist}</div>
        {album && <div className="text-zinc-400 text-xs drop-shadow-lg mt-0.5">{album}</div>}
      </div>

      {/* Navigation buttons - only show if there's a prev/next track */}
      {hasPrevTrack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevTrack();
          }}
          className="absolute top-1/2 left-2 -translate-y-1/2 z-20 text-white/70 hover:text-white transition-colors p-2 drop-shadow-lg"
        >
          <ChevronLeftIcon />
        </button>
      )}
      {hasNextTrack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNextTrack();
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 z-20 text-white/70 hover:text-white transition-colors p-2 drop-shadow-lg"
        >
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );

  // Format time in mm:ss
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate times for display
  const displayTimeMs = isDragging ? (dragProgress / 100) * duration : currentTimeMs;
  const remainingMs = duration - displayTimeMs;

  // Scrubber bar component - rendered separately to be placed outside player
  const scrubberBar = isReady ? (
    <div className="flex items-center px-4 py-1 bg-black">
      {/* Elapsed time */}
      <span className="text-xs text-zinc-400 font-mono w-10 text-right">
        {formatTime(displayTimeMs)}
      </span>

      {/* Scrubber track - with horizontal margin for spacing from time */}
      <div
        ref={scrubberRef}
        className="flex-1 h-8 flex items-center cursor-pointer mx-4"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track background */}
        <div className="w-full h-1 bg-zinc-700 rounded-full relative">
          {/* Progress fill */}
          <div
            className="h-full bg-purple-500 rounded-full"
            style={{ width: `${displayProgress}%` }}
          />
          {/* Scrubber handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg transition-transform ${
              isDragging ? 'scale-125' : ''
            }`}
            style={{ left: `calc(${displayProgress}% - 8px)` }}
          />
        </div>
      </div>

      {/* Remaining time */}
      <span className="text-xs text-zinc-500 font-mono w-10">
        -{formatTime(remainingMs)}
      </span>
    </div>
  ) : null;

  return (
    <>
      {playerElement}
      {scrubberBar}
    </>
  );
};

export default AudioPlayer;
