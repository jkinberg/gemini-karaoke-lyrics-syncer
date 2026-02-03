import React from 'react';
import type { Track, LoadedTrackData, VocabularyItem } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { useKaraokeSync, getWordVocabState } from '../hooks/useKaraokeSync';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
import { analytics } from '../utils/analytics';

// Icons
const MusicNoteIcon = () => (
  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="6" cy="18" r="3" fill="currentColor"/>
    <circle cx="18" cy="16" r="3" fill="currentColor"/>
  </svg>
);

const FlameIcon = () => (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const FeedbackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const FEEDBACK_URL = 'https://forms.gle/w81hKnbPLuG2v1eQ8';

interface PlayerScreenProps {
  track: Track | null;
  trackData: LoadedTrackData | null;
  currentTimeMs: number;
  unlockedVocabCount: number;
  unlockedVocabIndices: Set<number>;
  isMuted: boolean;
  isMobile: boolean;
  seekToTimeMs: number | null;
  shouldPause?: boolean;
  hasNextTrack: boolean;
  hasPrevTrack: boolean;
  totalTracks: number;
  currentTrackIndex: number;
  onTimeUpdate: (timeMs: number) => void;
  onMutedChange: (muted: boolean) => void;
  onEnded?: () => void;
  onOpenVocab: () => void;
  onOpenStats: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeekTo?: (timeMs: number) => void;
}

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
  track,
  trackData,
  currentTimeMs,
  unlockedVocabCount,
  unlockedVocabIndices,
  isMuted,
  isMobile,
  seekToTimeMs,
  shouldPause,
  hasNextTrack,
  hasPrevTrack,
  totalTracks,
  currentTrackIndex,
  onTimeUpdate,
  onMutedChange,
  onEnded,
  onOpenVocab,
  onOpenStats,
  onNextTrack,
  onPrevTrack,
  onSeekTo,
}) => {
  const totalVocab = trackData?.vocabulary?.length ?? 0;

  // Swipe up on vocab bar to open it
  const vocabBarSwipe = useSwipeGesture({
    onSwipeUp: onOpenVocab,
    minSwipeDistance: 30,
    maxSwipeTime: 500,
  });

  // Pull-to-refresh (mobile only)
  const PULL_THRESHOLD = 80;
  const { pullDistance, isPulling, isRefreshing, handlers: pullHandlers } = usePullToRefresh({
    threshold: PULL_THRESHOLD,
    enabled: isMobile,
  });

  return (
    <div
      className="h-full flex flex-col bg-black overflow-hidden relative"
      {...pullHandlers}
    >
      {/* Pull-to-refresh indicator */}
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        threshold={PULL_THRESHOLD}
        isRefreshing={isRefreshing}
      />
      {/* Top Bar */}
      <div className="flex-shrink-0 px-4 pt-2 pb-2 flex items-center justify-between safe-area-top">
        <div className="text-white">
          <MusicNoteIcon />
        </div>
        {/* Playlist pagination dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalTracks }).map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentTrackIndex
                  ? 'bg-white w-2.5 h-2.5'
                  : 'bg-zinc-600'
              }`}
            />
          ))}
        </div>
        <button
          onClick={onOpenStats}
          className="w-9 h-9 rounded-full flex items-center justify-center text-orange-400 hover:text-orange-300 transition-colors"
        >
          <FlameIcon />
        </button>
      </div>

      {/* Media Player - relative z-10 to keep scrubber above lyrics */}
      <div className="relative z-10 flex-shrink-0">
        {track ? (
          isMobile && track.audioUrl ? (
            <AudioPlayer
              trackId={track.id}
              audioUrl={track.audioUrl}
              expectedDurationMs={track.metadata.durationMs}
              title={track.metadata.title}
              artist={track.metadata.artist}
              album={track.metadata.album}
              thumbnailUrl={track.youtube.thumbnailUrl}
              seekToTimeMs={seekToTimeMs}
              shouldPause={shouldPause}
              hasNextTrack={hasNextTrack}
              hasPrevTrack={hasPrevTrack}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onNextTrack={onNextTrack}
              onPrevTrack={onPrevTrack}
              persistedMuted={isMuted}
              onMutedChange={onMutedChange}
            />
          ) : (
            <VideoPlayer
              trackId={track.id}
              videoId={track.youtube.videoId}
              title={track.metadata.title}
              artist={track.metadata.artist}
              thumbnailUrl={track.youtube.thumbnailUrl}
              seekToTimeMs={seekToTimeMs}
              shouldPause={shouldPause}
              hasNextTrack={hasNextTrack}
              hasPrevTrack={hasPrevTrack}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onNextTrack={onNextTrack}
              onPrevTrack={onPrevTrack}
              persistedMuted={isMuted}
              onMutedChange={onMutedChange}
            />
          )
        ) : (
          <div className="bg-zinc-900 flex items-center justify-center" style={{ height: 200 }}>
            <div className="text-zinc-500">Loading...</div>
          </div>
        )}
      </div>

      {/* Lyrics Display Area */}
      <div className="flex-1 flex flex-col justify-center px-4 py-4 overflow-hidden relative">
        {trackData ? (
          <LyricsDisplay
            trackId={track?.id}
            trackData={trackData}
            currentTimeMs={currentTimeMs}
            unlockedVocabIndices={unlockedVocabIndices}
            isMobile={isMobile}
            onSeekTo={onSeekTo}
          />
        ) : (
          <div className="text-zinc-600 text-center">
            <div className="text-xl mb-2">Loading lyrics...</div>
          </div>
        )}
        {/* Feedback button - positioned at top of lyrics area */}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 py-1.5 px-3 rounded-full border border-zinc-700 hover:border-zinc-600 text-zinc-500 hover:text-zinc-400 text-xs transition-colors"
        >
          <FeedbackIcon />
          <span>Share your feedback</span>
        </a>
      </div>

      {/* Vocab Bar (Collapsed) */}
      <button
        onClick={onOpenVocab}
        {...vocabBarSwipe}
        className="flex-shrink-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 pb-4 safe-area-bottom"
      >
        <div className="relative flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <BookIcon />
            <span className="text-sm font-medium">Vocab</span>
          </div>
          {/* Drag handle - absolutely centered */}
          <div className="absolute left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-zinc-500" />
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold transition-all ${
            unlockedVocabCount >= totalVocab && totalVocab > 0
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'bg-zinc-800 text-zinc-300'
          }`}>
            <span>{unlockedVocabCount}/{totalVocab}</span>
          </div>
        </div>

        {/* Segmented progress bar */}
        <div className="flex gap-1.5">
          {trackData?.vocabulary?.map((vocab, index) => {
            const isUnlocked = unlockedVocabIndices.has(index);
            const isActive = currentTimeMs >= vocab.startTimeMs && currentTimeMs < vocab.endTimeMs;

            return (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  isUnlocked
                    ? 'bg-purple-500'
                    : 'bg-zinc-700'
                }`}
                style={isActive ? {
                  boxShadow: '0 0 8px rgba(192, 132, 252, 0.8), 0 0 16px rgba(192, 132, 252, 0.5)',
                } : {}}
              />
            );
          }) || (
            <div className="h-1.5 flex-1 rounded-full bg-zinc-700" />
          )}
        </div>
      </button>

    </div>
  );
};

// Vocab glow style for text-shadow
const vocabGlowStyle = {
  textShadow: '0 0 20px rgba(192, 132, 252, 0.8), 0 0 40px rgba(192, 132, 252, 0.5)',
};

// Lyrics display component - shows current segment with word highlighting
const LyricsDisplay: React.FC<{
  trackId?: string;
  trackData: LoadedTrackData;
  currentTimeMs: number;
  unlockedVocabIndices: Set<number>;
  isMobile?: boolean;
  onSeekTo?: (timeMs: number) => void;
}> = ({ trackId, trackData, currentTimeMs, unlockedVocabIndices, isMobile = false, onSeekTo }) => {
  const {
    currentSegmentIndex,
    currentWordIndex,
    currentEnglishWordIndex,
    spanishSegment,
    englishSegment,
  } = useKaraokeSync({
    spanishData: trackData.spanish,
    englishData: trackData.english,
    vocabulary: trackData.vocabulary,
    currentTimeMs,
  });

  // Detect skippable intro (first segment is INSTRUMENTAL with duration >= 10 seconds)
  const firstSegment = trackData.spanish.segments[0];
  const hasSkippableIntro =
    firstSegment?.type === 'INSTRUMENTAL' &&
    (firstSegment.endTimeMs - firstSegment.startTimeMs) >= 10000;
  const introEndTimeMs = hasSkippableIntro ? firstSegment.endTimeMs : 0;
  const showSkipIntro = hasSkippableIntro && currentTimeMs < introEndTimeMs;

  // Handle instrumental or no segment found
  if (!spanishSegment || spanishSegment.type === 'INSTRUMENTAL') {
    const cueText = spanishSegment?.cueText || 'Instrumental';
    return (
      <div className="text-center">
        <div className="text-2xl text-zinc-500 italic">{cueText}</div>
        {showSkipIntro && onSeekTo && (
          <button
            onClick={() => {
              if (trackId) {
                analytics.skipIntro(trackId, introEndTimeMs / 1000);
              }
              onSeekTo(introEndTimeMs);
            }}
            className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white font-medium transition-colors"
          >
            Skip Intro →
          </button>
        )}
      </div>
    );
  }

  // Font sizes: slightly smaller on mobile to reduce word wrapping
  const spanishFontSize = isMobile ? 32 : 36;
  const englishFontSize = isMobile ? 20 : 24;

  return (
    <div className="text-center">
      {/* Spanish lyrics */}
      <div className="mb-8" style={{ fontSize: spanishFontSize, lineHeight: 1.2, fontWeight: 700 }}>
        {spanishSegment.words?.map((word, index) => {
          const isHighlighted = index < currentWordIndex ||
            (index === currentWordIndex && currentTimeMs >= word.startTimeMs);

          // Check if this word is a vocab word
          // Use spanishSegment.segmentIndex (the segment's property) not currentSegmentIndex (array index)
          const vocabState = getWordVocabState(
            word.word,
            spanishSegment.segmentIndex,
            trackData.vocabulary,
            currentTimeMs,
            'spanish'
          );

          // Determine text color and glow based on vocab state
          let colorClass = isHighlighted ? 'text-yellow-300' : 'text-zinc-600';
          let glowStyle = {};

          if (vocabState.isVocab) {
            // Use the word's own timing to determine when it lights up
            const wordHasBeenSung = currentTimeMs >= word.startTimeMs;

            if (wordHasBeenSung) {
              // Word has been sung: bright purple with glow
              colorClass = 'text-purple-400';
              glowStyle = vocabGlowStyle;
            } else {
              // Word hasn't been sung yet: dark purple (barely visible)
              colorClass = 'text-purple-900';
            }
          }

          return (
            <span
              key={index}
              className={`inline transition-colors duration-100 ${colorClass}`}
              style={glowStyle}
            >
              {word.word}{' '}
            </span>
          );
        }) || (
          <span className="text-yellow-300">{spanishSegment.text}</span>
        )}
      </div>

      {/* English translation */}
      <div style={{ fontSize: englishFontSize, lineHeight: 1.3 }}>
        {englishSegment?.words?.map((word, index) => {
          const isHighlighted = index < currentEnglishWordIndex ||
            (index === currentEnglishWordIndex && currentTimeMs >= word.startTimeMs);

          // Check if this word is a vocab word (English side)
          // Use spanishSegment.segmentIndex since vocabulary is indexed by Spanish segments
          const vocabState = getWordVocabState(
            word.word,
            spanishSegment.segmentIndex,
            trackData.vocabulary,
            currentTimeMs,
            'english'
          );

          // Determine text color and glow based on vocab state
          let colorClass = isHighlighted ? 'text-zinc-400' : 'text-zinc-700';
          let glowStyle = {};

          if (vocabState.isVocab) {
            // Use the word's own timing to determine when it lights up
            const wordHasBeenSung = currentTimeMs >= word.startTimeMs;

            if (wordHasBeenSung) {
              // Word has been sung: bright purple with glow
              colorClass = 'text-purple-400';
              glowStyle = vocabGlowStyle;
            } else {
              // Word hasn't been sung yet: dark purple (barely visible)
              colorClass = 'text-purple-900';
            }
          }

          return (
            <span
              key={index}
              className={`inline transition-colors duration-100 ${colorClass}`}
              style={glowStyle}
            >
              {word.word}{' '}
            </span>
          );
        }) || (
          <span className="text-zinc-400">{englishSegment?.text || ''}</span>
        )}
      </div>
    </div>
  );
};

export default PlayerScreen;
