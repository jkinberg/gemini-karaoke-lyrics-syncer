import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerOptions {
  audioUrl: string;
  expectedDurationMs?: number; // Use playlist duration instead of audio metadata
  onTimeUpdate?: (timeMs: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onEnded?: () => void;
  initialMuted?: boolean;
}

interface UseAudioPlayerReturn {
  audioRef: React.RefObject<HTMLAudioElement>;
  analyserNode: AnalyserNode | null;
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

export function useAudioPlayer({
  audioUrl,
  expectedDurationMs,
  onTimeUpdate,
  onStateChange,
  onEnded,
  initialMuted = true,
}: UseAudioPlayerOptions): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hasTriggeredLogicalEnd = useRef(false);
  const expectedDurationMsRef = useRef(expectedDurationMs);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Store the muted preference to persist across audio changes
  const mutedPreferenceRef = useRef(initialMuted);

  // Keep expectedDurationMs ref in sync with prop
  useEffect(() => {
    expectedDurationMsRef.current = expectedDurationMs;
  }, [expectedDurationMs]);

  // Setup Web Audio API for visualizer
  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioContext.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      source.connect(analyser);
      analyser.connect(audioContext.destination);

      setAnalyserNode(analyser);
    } catch (e) {
      console.warn('Failed to setup Web Audio API:', e);
    }
  }, []);

  // Resume audio context on user interaction (required for autoplay policy)
  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (!audioUrl) return;

    // Reset state when audioUrl changes
    setIsReady(false);
    setError(null);
    setCurrentTimeMs(0);
    setDuration(0);
    setIsPlaying(false);
    hasTriggeredLogicalEnd.current = false;

    const audio = audioRef.current;
    if (!audio) return;

    // Configure audio element
    // Note: crossOrigin='anonymous' is needed for Web Audio API visualizer,
    // but requires CORS headers from server. We'll try with it first,
    // and fall back to no crossOrigin if it fails.
    audio.crossOrigin = 'anonymous';
    audio.src = audioUrl;
    audio.muted = mutedPreferenceRef.current;
    audio.preload = 'auto';

    const handleCanPlay = () => {
      setIsReady(true);
      // Use expected duration from playlist if provided (audio metadata can be wrong)
      const durationMs = expectedDurationMs || (audio.duration * 1000);
      setDuration(durationMs);

      // Setup Web Audio API on first interaction (only works with CORS)
      if (!audioContextRef.current) {
        setupAudioContext();
      }

      // Attempt autoplay
      audio.play().catch((e) => {
        console.log('Autoplay blocked:', e);
        // Autoplay was blocked, user will need to tap to play
      });
    };

    // If CORS fails, retry without crossOrigin (visualizer won't work)
    let corsRetried = false;
    const handleError = () => {
      const code = audio.error?.code || 0;

      // If we haven't retried and it might be a CORS issue, try without crossOrigin
      if (!corsRetried && (code === 4 || code === 2)) {
        corsRetried = true;
        console.log('Audio load failed, retrying without CORS (visualizer disabled)');
        audio.crossOrigin = null as unknown as string;
        audio.src = audioUrl;
        audio.load();
        return;
      }

      const errorMessages: Record<number, string> = {
        1: 'Audio loading aborted',
        2: 'Network error while loading audio',
        3: 'Audio decoding failed',
        4: 'Audio format not supported',
      };
      setError(errorMessages[code] || 'Audio unavailable');
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onStateChange?.(true);
      resumeAudioContext();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onStateChange?.(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onStateChange?.(false);
      onEnded?.();
    };

    const handleLoadedMetadata = () => {
      // Use expected duration from playlist if provided (audio metadata can be wrong)
      const durationMs = expectedDurationMs || (audio.duration * 1000);
      setDuration(durationMs);
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Load the audio
    audio.load();

    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioUrl, onStateChange, onEnded, setupAudioContext, resumeAudioContext]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Wake lock to prevent screen sleep during playback
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isPlaying) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (e) {
          // Wake lock request failed (e.g., low battery, tab not visible)
          console.debug('Wake lock request failed:', e);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (e) {
          console.debug('Wake lock release failed:', e);
        }
      }
    };

    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying]);

  // Store callbacks in refs to avoid stale closures in interval
  const onEndedRef = useRef(onEnded);
  const onStateChangeRef = useRef(onStateChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onStateChangeRef.current = onStateChange;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onEnded, onStateChange, onTimeUpdate]);

  // Time update polling (50ms for smooth word-by-word sync)
  useEffect(() => {
    if (!isPlaying || !audioRef.current) {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      return;
    }

    timeUpdateIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        const timeMs = audioRef.current.currentTime * 1000;
        const expectedDuration = expectedDurationMsRef.current;

        // Check if we've passed the expected duration (lyrics end)
        // This handles the case where actual audio is longer than lyrics
        if (
          expectedDuration &&
          timeMs >= expectedDuration &&
          !hasTriggeredLogicalEnd.current
        ) {
          hasTriggeredLogicalEnd.current = true;
          // Pause the audio and trigger ended callback
          audioRef.current.pause();
          setIsPlaying(false);
          onStateChangeRef.current?.(false);
          onEndedRef.current?.();
          return;
        }

        // Cap the time at expectedDuration to prevent negative remaining time
        const cappedTimeMs = expectedDuration ? Math.min(timeMs, expectedDuration) : timeMs;
        setCurrentTimeMs(cappedTimeMs);
        onTimeUpdateRef.current?.(cappedTimeMs);
      }
    }, 50);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  const play = useCallback(async () => {
    // Resume AudioContext first and wait for it
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    audioRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    // Suspend AudioContext to stop any audio pipeline processing
    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.suspend();
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const mute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = true;
      setIsMuted(true);
      mutedPreferenceRef.current = true;
    }
  }, []);

  const unmute = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.muted = false;
      setIsMuted(false);
      mutedPreferenceRef.current = false;
      // Resume AudioContext first
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      // Try to play if paused (user interaction enables autoplay)
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

  const seekTo = useCallback((timeMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
      // Reset logical end flag if seeking to before the end
      const expectedDuration = expectedDurationMsRef.current;
      if (expectedDuration && timeMs < expectedDuration) {
        hasTriggeredLogicalEnd.current = false;
      }
    }
  }, []);

  return {
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
    mute,
    unmute,
    toggleMute,
    seekTo,
  };
}
