import { useState, useEffect, useRef, useCallback } from 'react';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

declare namespace YT {
  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    setVolume(volume: number): void;
    getVolume(): number;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
  }

  interface PlayerOptions {
    videoId?: string;
    width?: number | string;
    height?: number | string;
    playerVars?: PlayerVars;
    events?: PlayerEvents;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    disablekb?: 0 | 1;
    enablejsapi?: 0 | 1;
    fs?: 0 | 1;
    iv_load_policy?: 1 | 3;
    modestbranding?: 0 | 1;
    mute?: 0 | 1;
    playsinline?: 0 | 1;
    rel?: 0 | 1;
    start?: number;
    origin?: string;
    widget_referrer?: string;
  }

  interface PlayerEvents {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
    onError?: (event: OnErrorEvent) => void;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }

  interface OnErrorEvent extends PlayerEvent {
    data: number;
  }

  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

interface UseYouTubePlayerOptions {
  videoId: string;
  onTimeUpdate?: (timeMs: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onEnded?: () => void;
  initialMuted?: boolean;
}

interface UseYouTubePlayerReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  currentTimeMs: number;
  duration: number;
  error: string | null;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  seekTo: (timeMs: number) => void;
}

// Track if API is loaded globally
let isAPILoaded = false;
let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (isAPILoaded) {
    return Promise.resolve();
  }

  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise((resolve) => {
    // Check if already loaded
    if (window.YT && window.YT.Player) {
      isAPILoaded = true;
      resolve();
      return;
    }

    // Set up callback
    window.onYouTubeIframeAPIReady = () => {
      isAPILoaded = true;
      resolve();
    };

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export function useYouTubePlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  onEnded,
  initialMuted = true,
}: UseYouTubePlayerOptions): UseYouTubePlayerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Store the muted preference to persist across video changes
  const mutedPreferenceRef = useRef(initialMuted);

  // Initialize player
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    // Reset all state when videoId changes
    setIsReady(false);
    setError(null);
    setCurrentTimeMs(0);
    setDuration(0);
    setIsPlaying(false);

    let mounted = true;

    async function initPlayer() {
      await loadYouTubeAPI();

      if (!mounted || !containerRef.current) return;

      // Destroy existing player if any
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying player:', e);
        }
        playerRef.current = null;
      }

      // Clear the container and create a fresh div for the player
      // This is necessary because YouTube's destroy() doesn't restore the original element
      const containerId = `yt-player-${Date.now()}`;
      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = containerId;
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          mute: mutedPreferenceRef.current ? 1 : 0,
          playsinline: 1,
          rel: 0,
          // Additional params for mobile compatibility
          origin: window.location.origin,
          widget_referrer: window.location.href,
        },
        events: {
          onReady: (event) => {
            if (!mounted) return;
            setIsReady(true);
            setDuration(event.target.getDuration() * 1000);
            setIsMuted(event.target.isMuted());

            // Start playing (autoplay should handle this, but ensure it)
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (!mounted) return;
            const playing = event.data === 1; // YT.PlayerState.PLAYING
            const ended = event.data === 0; // YT.PlayerState.ENDED
            setIsPlaying(playing);
            onStateChange?.(playing);
            if (ended) {
              onEnded?.();
            }
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
            // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed not allowed
            const errorMessages: Record<number, string> = {
              2: 'Invalid video ID',
              5: 'Video cannot be played in HTML5 player',
              100: 'Video not found',
              101: 'Video embedding not allowed',
              150: 'Video embedding not allowed',
            };
            setError(errorMessages[event.data] || 'Video unavailable');
          },
        },
      });
    }

    initPlayer();

    return () => {
      mounted = false;
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying player on cleanup:', e);
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Time update polling
  useEffect(() => {
    if (!isPlaying || !playerRef.current) {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      return;
    }

    // Poll at 50ms for smooth word-by-word sync
    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (playerRef.current) {
        const timeMs = playerRef.current.getCurrentTime() * 1000;
        setCurrentTimeMs(timeMs);
        onTimeUpdate?.(timeMs);
      }
    }, 50);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying, onTimeUpdate]);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const mute = useCallback(() => {
    playerRef.current?.mute();
    setIsMuted(true);
    mutedPreferenceRef.current = true;
  }, []);

  const unmute = useCallback(() => {
    playerRef.current?.unMute();
    setIsMuted(false);
    mutedPreferenceRef.current = false;
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

  const seekTo = useCallback((timeMs: number) => {
    playerRef.current?.seekTo(timeMs / 1000, true);
    setCurrentTimeMs(timeMs);
  }, []);

  return {
    containerRef,
    isReady,
    isPlaying,
    isMuted,
    currentTimeMs,
    duration,
    error,
    play,
    pause,
    togglePlay,
    mute,
    unmute,
    toggleMute,
    seekTo,
  };
}
