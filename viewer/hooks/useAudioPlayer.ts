import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerOptions {
  audioUrl: string;
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

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Store the muted preference to persist across audio changes
  const mutedPreferenceRef = useRef(initialMuted);

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

    const audio = audioRef.current;
    if (!audio) return;

    // Configure audio element
    audio.src = audioUrl;
    audio.muted = mutedPreferenceRef.current;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous'; // Required for Web Audio API with CORS

    const handleCanPlay = () => {
      setIsReady(true);
      setDuration(audio.duration * 1000);

      // Setup Web Audio API on first interaction
      if (!audioContextRef.current) {
        setupAudioContext();
      }

      // Attempt autoplay
      audio.play().catch((e) => {
        console.log('Autoplay blocked:', e);
        // Autoplay was blocked, user will need to tap to play
      });
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

    const handleError = () => {
      const errorMessages: Record<number, string> = {
        1: 'Audio loading aborted',
        2: 'Network error while loading audio',
        3: 'Audio decoding failed',
        4: 'Audio format not supported',
      };
      const code = audio.error?.code || 0;
      setError(errorMessages[code] || 'Audio unavailable');
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration * 1000);
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
    resumeAudioContext();
    audioRef.current?.play();
  }, [resumeAudioContext]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
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

  const unmute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = false;
      setIsMuted(false);
      mutedPreferenceRef.current = false;
      resumeAudioContext();
      // Try to play if paused (user interaction enables autoplay)
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [resumeAudioContext]);

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
