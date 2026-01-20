import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ScreenType } from './types';
import { usePlaylist } from './hooks/usePlaylist';
import { useProgress, getVocabId } from './hooks/useProgress';
import { PlayerScreen } from './components/PlayerScreen';
import { VocabPanel } from './components/VocabPanel';
import { VocabToastContainer, type ToastMessage } from './components/VocabToast';
import { StatsPanel } from './components/StatsPanel';
import { isMobileDevice } from './utils/deviceDetection';
import { analytics, type VocabPanelTrigger } from './utils/analytics';

let toastIdCounter = 0;

export default function ViewerApp() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('player');
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isMobile, setIsMobile] = useState(false); // Detect mobile for audio player
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [seekToTimeMs, setSeekToTimeMs] = useState<number | null>(null);
  const [highlightedVocabIndex, setHighlightedVocabIndex] = useState<number | null>(null);
  const [shouldPause, setShouldPause] = useState(false);
  const [unlockedVocabIndices, setUnlockedVocabIndices] = useState<Set<number>>(new Set());
  const [videoEnded, setVideoEnded] = useState(false);
  const [vocabOpenTrigger, setVocabOpenTrigger] = useState<VocabPanelTrigger>('tap');

  // Detect mobile device on mount and track session start
  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    // Track session start with device and player type
    analytics.sessionStart(
      mobile ? 'mobile' : 'desktop',
      mobile ? 'audio' : 'video'
    );
  }, []);

  // Track screen views for analytics
  useEffect(() => {
    analytics.screenView(activeScreen === 'vocab' ? 'vocab_panel' : activeScreen === 'stats' ? 'stats_panel' : 'player');
  }, [activeScreen]);

  // Track which vocab items have been shown as toasts (by index)
  const shownToastsRef = useRef<Set<number>>(new Set());

  // Track if we've fired trackComplete for the current track (fires once at 80%)
  const hasTrackedCompleteRef = useRef<string | null>(null);

  // Session-level storage for unlocked vocab per track (persists across track changes within session)
  const sessionVocabByTrackRef = useRef<Map<string, Set<number>>>(new Map());
  const sessionToastsByTrackRef = useRef<Map<string, Set<number>>>(new Map());
  const previousTrackIdRef = useRef<string | null>(null);

  // Keep a ref to current unlocked indices for saving (avoids stale closure in effect)
  const currentUnlockedRef = useRef<Set<number>>(new Set());

  const {
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
  } = usePlaylist();

  const {
    progress,
    markActive,
    recordSongProgress,
    unlockVocab,
    addListeningTime,
  } = useProgress();

  // Track listening time
  const lastTimeRef = useRef<number>(0);
  const accumulatedSecondsRef = useRef<number>(0);

  // Keep a ref to current time for use in callbacks (avoids stale closure issues)
  const currentTimeMsRef = useRef<number>(0);
  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  // Track listening time when playing (not muted)
  useEffect(() => {
    // Only count time when user is actively listening (unmuted)
    if (isMuted || currentTimeMs === 0) {
      lastTimeRef.current = currentTimeMs;
      return;
    }

    const lastTime = lastTimeRef.current;
    const deltaMs = currentTimeMs - lastTime;

    // Only count forward progress, and ignore large jumps (seeks)
    // Normal playback should have deltas of ~100-500ms
    if (deltaMs > 0 && deltaMs < 2000) {
      accumulatedSecondsRef.current += deltaMs / 1000;

      // When we've accumulated a full minute, record it
      if (accumulatedSecondsRef.current >= 60) {
        const fullMinutes = Math.floor(accumulatedSecondsRef.current / 60);
        addListeningTime(fullMinutes);
        accumulatedSecondsRef.current = accumulatedSecondsRef.current % 60;
      }
    }

    lastTimeRef.current = currentTimeMs;
  }, [currentTimeMs, isMuted, addListeningTime]);

  // Keep ref in sync with state for use in effects
  useEffect(() => {
    currentUnlockedRef.current = unlockedVocabIndices;
  }, [unlockedVocabIndices]);

  // Save and restore vocab state when track changes (session persistence)
  useEffect(() => {
    const newTrackId = currentTrack?.id ?? null;
    const prevTrackId = previousTrackIdRef.current;

    // Save current track's unlocked vocab before switching (use ref to get current value)
    if (prevTrackId && prevTrackId !== newTrackId) {
      sessionVocabByTrackRef.current.set(prevTrackId, new Set(currentUnlockedRef.current));
      sessionToastsByTrackRef.current.set(prevTrackId, new Set(shownToastsRef.current));
    }

    // Restore or reset vocab state for new track
    if (newTrackId) {
      const savedVocab = sessionVocabByTrackRef.current.get(newTrackId);
      const savedToasts = sessionToastsByTrackRef.current.get(newTrackId);

      if (savedVocab) {
        // Restore previously unlocked vocab for this track
        setUnlockedVocabIndices(new Set(savedVocab));
        shownToastsRef.current = new Set(savedToasts || savedVocab);
        currentUnlockedRef.current = new Set(savedVocab);
      } else {
        // First time on this track, start fresh
        setUnlockedVocabIndices(new Set());
        shownToastsRef.current.clear();
        currentUnlockedRef.current = new Set();
      }
    } else {
      setUnlockedVocabIndices(new Set());
      shownToastsRef.current.clear();
      currentUnlockedRef.current = new Set();
    }

    // Reset other state
    setCurrentTimeMs(0);
    setSeekToTimeMs(null);
    setShouldPause(false);
    setVideoEnded(false);

    // Update previous track reference
    previousTrackIdRef.current = newTrackId;
  }, [currentTrack?.id]);

  // Track ID that matches the current trackData (to prevent stale data issues)
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);

  // Update loadedTrackId when trackData loads
  useEffect(() => {
    if (trackData && currentTrack?.id) {
      setLoadedTrackId(currentTrack.id);
    } else if (trackData === null) {
      setLoadedTrackId(null);
    }
  }, [trackData, currentTrack?.id]);

  // Unlocked vocab count from the persistent set
  const unlockedVocabCount = unlockedVocabIndices.size;

  // Check for newly unlocked vocab and show toast
  useEffect(() => {
    // Only unlock vocab when trackData matches the current track
    // This prevents stale time updates from the previous video from unlocking vocab
    if (!trackData?.vocabulary || !currentTrack || loadedTrackId !== currentTrack.id) return;

    trackData.vocabulary.forEach((vocab, index) => {
      if (
        currentTimeMs >= vocab.startTimeMs &&
        !shownToastsRef.current.has(index)
      ) {
        shownToastsRef.current.add(index);

        // Add to persistent unlocked set
        setUnlockedVocabIndices(prev => new Set([...prev, index]));

        // Track vocab unlock for analytics
        analytics.vocabUnlock(
          currentTrack.id,
          vocab.term.spanish,
          index,
          currentTimeMs / 1000
        );

        // Only show toast within 1 second of unlock time
        if (currentTimeMs < vocab.startTimeMs + 1000) {
          const newToast: ToastMessage = {
            id: ++toastIdCounter,
            word: vocab.term.spanish,
            vocabIndex: index,
          };
          setToasts(prev => [...prev, newToast]);

          // Track toast shown for analytics
          analytics.vocabToastShown(currentTrack.id, vocab.term.spanish);
        }

        // Record vocab unlock in progress
        const vocabId = getVocabId(currentTrack.id, vocab.term.spanish);
        unlockVocab(vocabId);
      }
    });
  }, [currentTimeMs, trackData?.vocabulary, currentTrack, loadedTrackId, unlockVocab]);

  // Remove toast by ID
  const handleRemoveToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Track song progress periodically
  useEffect(() => {
    if (!currentTrack || currentTimeMs === 0) return;

    // Record progress every 10 seconds
    if (currentTimeMs % 10000 < 100) {
      recordSongProgress(
        currentTrack.id,
        currentTimeMs,
        currentTrack.metadata.durationMs
      );
    }
  }, [currentTimeMs, currentTrack, recordSongProgress]);

  // Track when user reaches 80% of the track (fires once per track)
  useEffect(() => {
    if (!currentTrack || currentTimeMs === 0) return;

    const durationMs = currentTrack.metadata.durationMs;
    const completionPercent = (currentTimeMs / durationMs) * 100;

    // Fire trackComplete once when reaching 80%
    if (completionPercent >= 80 && hasTrackedCompleteRef.current !== currentTrack.id) {
      hasTrackedCompleteRef.current = currentTrack.id;
      analytics.trackComplete(
        currentTrack.id,
        currentTrack.metadata.title,
        currentTrack.metadata.artist,
        currentTimeMs / 1000
      );
    }
  }, [currentTimeMs, currentTrack]);

  // Mark user as active when they interact (unmute/play)
  useEffect(() => {
    if (!isMuted) {
      markActive();
    }
  }, [isMuted, markActive]);

  // Handle time updates from YouTube player
  const handleTimeUpdate = useCallback((timeMs: number) => {
    setCurrentTimeMs(timeMs);
  }, []);

  // Handle mute state changes - persist across track changes
  const handleMutedChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  // Handle seek request from VocabPanel
  const handleSeekTo = useCallback((timeMs: number) => {
    setSeekToTimeMs(timeMs);
    setActiveScreen('player');
    setShouldPause(false); // Resume playing when seeking
    setHighlightedVocabIndex(null);
    // Clear after a short delay to allow the seek to happen
    setTimeout(() => setSeekToTimeMs(null), 100);
  }, []);

  // Handle opening vocab panel (pauses video)
  const handleOpenVocab = useCallback((vocabIndex?: number, trigger: VocabPanelTrigger = 'tap') => {
    setActiveScreen('vocab');
    setShouldPause(true);
    setVocabOpenTrigger(trigger);
    if (vocabIndex !== undefined) {
      setHighlightedVocabIndex(vocabIndex);
    }
  }, []);

  // Handle closing vocab panel (resumes video)
  const handleCloseVocab = useCallback(() => {
    setActiveScreen('player');
    setShouldPause(false);
    setHighlightedVocabIndex(null);
    setVideoEnded(false);
  }, []);

  // Handle video ended - open vocab panel with action buttons
  const handleVideoEnded = useCallback(() => {
    // Track the end event (use ref to avoid recreating callback on every time update)
    if (currentTrack) {
      const completionPercent = (currentTimeMsRef.current / currentTrack.metadata.durationMs) * 100;
      analytics.trackEnded(currentTrack.id, completionPercent);
    }

    setVideoEnded(true);
    setActiveScreen('vocab');
    setShouldPause(true);
    setVocabOpenTrigger('end_screen');
  }, [currentTrack]);

  // Handle play again - seek to start and resume
  const handlePlayAgain = useCallback(() => {
    setSeekToTimeMs(0);
    setActiveScreen('player');
    setShouldPause(false);
    setVideoEnded(false);
    setTimeout(() => setSeekToTimeMs(null), 100);
  }, []);

  // Handle play next - go to next track
  const handlePlayNext = useCallback(() => {
    setActiveScreen('player');
    setShouldPause(false);
    setVideoEnded(false);
    nextTrack();
  }, [nextTrack]);

  // Handle toast click - opens vocab panel to specific word
  const handleToastClick = useCallback((vocabIndex: number) => {
    handleOpenVocab(vocabIndex, 'toast');
  }, [handleOpenVocab]);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-zinc-400 mb-2">Loading...</div>
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex items-center justify-center bg-black px-4">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading playlist</div>
          <div className="text-zinc-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-black">
      {/* Always render PlayerScreen to preserve video state, hide when not active */}
      <div className={activeScreen === 'player' ? 'h-full' : 'hidden'}>
        <PlayerScreen
          track={currentTrack}
          trackData={trackData}
          currentTimeMs={currentTimeMs}
          unlockedVocabCount={unlockedVocabCount}
          unlockedVocabIndices={unlockedVocabIndices}
          isMuted={isMuted}
          isMobile={isMobile}
          seekToTimeMs={seekToTimeMs}
          shouldPause={shouldPause}
          hasNextTrack={hasNextTrack}
          hasPrevTrack={hasPrevTrack}
          totalTracks={playlist?.tracks?.length ?? 0}
          currentTrackIndex={currentTrackIndex}
          onTimeUpdate={handleTimeUpdate}
          onMutedChange={handleMutedChange}
          onEnded={handleVideoEnded}
          onOpenVocab={() => handleOpenVocab()}
          onOpenStats={() => setActiveScreen('stats')}
          onNextTrack={nextTrack}
          onPrevTrack={prevTrack}
        />
      </div>
      {activeScreen === 'vocab' && trackData && currentTrack && (
        <VocabPanel
          trackId={currentTrack.id}
          vocabulary={trackData.vocabulary || []}
          unlockedCount={unlockedVocabCount}
          unlockedIndices={unlockedVocabIndices}
          highlightedIndex={highlightedVocabIndex}
          videoEnded={videoEnded}
          hasNextTrack={hasNextTrack}
          openTrigger={vocabOpenTrigger}
          onClose={handleCloseVocab}
          onSeekTo={handleSeekTo}
          onPlayAgain={handlePlayAgain}
          onPlayNext={handlePlayNext}
        />
      )}
      {activeScreen === 'stats' && (
        <StatsPanel
          progress={progress}
          onClose={() => setActiveScreen('player')}
        />
      )}

      {/* Vocab Toasts */}
      <VocabToastContainer
        trackId={currentTrack?.id ?? ''}
        toasts={toasts}
        onRemoveToast={handleRemoveToast}
        onToastClick={handleToastClick}
      />
    </div>
  );
}
