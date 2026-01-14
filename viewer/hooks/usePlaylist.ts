import { useState, useEffect, useCallback } from 'react';
import type { PlaylistData, Track, LoadedTrackData } from '../types';

interface UsePlaylistReturn {
  playlist: PlaylistData | null;
  currentTrack: Track | null;
  currentTrackIndex: number;
  trackData: LoadedTrackData | null;
  loading: boolean;
  error: string | null;
  hasNextTrack: boolean;
  hasPrevTrack: boolean;
  nextTrack: () => void;
  prevTrack: () => void;
  goToTrack: (index: number) => void;
}

export function usePlaylist(): UsePlaylistReturn {
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [trackData, setTrackData] = useState<LoadedTrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load playlist on mount
  useEffect(() => {
    async function loadPlaylist() {
      try {
        const response = await fetch('/playlist.json');
        if (!response.ok) {
          throw new Error('Failed to load playlist');
        }
        const data: PlaylistData = await response.json();
        setPlaylist(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load playlist');
        setLoading(false);
      }
    }
    loadPlaylist();
  }, []);

  // Load track data when track changes
  useEffect(() => {
    if (!playlist || !playlist.tracks[currentTrackIndex]) return;

    const track = playlist.tracks[currentTrackIndex];
    console.log('[usePlaylist] Loading track data for:', track.id, 'index:', currentTrackIndex);

    // Clear data immediately when track changes (before async fetch)
    setTrackData(null);

    let cancelled = false;

    async function loadTrackData() {
      try {
        console.log('[usePlaylist] Fetching files:', track.dataFiles);
        const [spanishRes, englishRes, vocabRes] = await Promise.all([
          fetch(`/${track.dataFiles.spanish}`),
          fetch(`/${track.dataFiles.english}`),
          fetch(`/${track.dataFiles.vocabulary}`),
        ]);

        if (cancelled) {
          console.log('[usePlaylist] Fetch cancelled (track changed)');
          return;
        }

        if (!spanishRes.ok || !englishRes.ok || !vocabRes.ok) {
          console.error('[usePlaylist] Fetch failed:', {
            spanish: spanishRes.status,
            english: englishRes.status,
            vocab: vocabRes.status,
          });
          throw new Error('Failed to load track data');
        }

        const [spanish, english, vocabulary] = await Promise.all([
          spanishRes.json(),
          englishRes.json(),
          vocabRes.json(),
        ]);

        if (cancelled) return;

        console.log('[usePlaylist] Track data loaded successfully:', {
          spanishSegments: spanish?.segments?.length,
          englishSegments: english?.segments?.length,
          vocabItems: vocabulary?.length,
        });

        setTrackData({ spanish, english, vocabulary });
      } catch (err) {
        if (cancelled) return;
        console.error('[usePlaylist] Failed to load track data:', err);
        setTrackData(null);
      }
    }

    loadTrackData();

    return () => {
      cancelled = true;
    };
  }, [playlist, currentTrackIndex]);

  const nextTrack = useCallback(() => {
    if (!playlist) return;
    setCurrentTrackIndex((prev) =>
      prev < playlist.tracks.length - 1 ? prev + 1 : 0
    );
  }, [playlist]);

  const prevTrack = useCallback(() => {
    if (!playlist) return;
    setCurrentTrackIndex((prev) =>
      prev > 0 ? prev - 1 : playlist.tracks.length - 1
    );
  }, [playlist]);

  const goToTrack = useCallback((index: number) => {
    if (!playlist || index < 0 || index >= playlist.tracks.length) return;
    setCurrentTrackIndex(index);
  }, [playlist]);

  const currentTrack = playlist?.tracks[currentTrackIndex] ?? null;
  const hasNextTrack = playlist ? currentTrackIndex < playlist.tracks.length - 1 : false;
  const hasPrevTrack = currentTrackIndex > 0;

  return {
    playlist,
    currentTrack,
    currentTrackIndex,
    trackData,
    loading,
    error,
    hasNextTrack,
    hasPrevTrack,
    nextTrack,
    prevTrack,
    goToTrack,
  };
}
