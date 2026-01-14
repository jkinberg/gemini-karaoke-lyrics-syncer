import React from 'react';
import type { Track, LoadedTrackData, VocabularyItem } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { useKaraokeSync, getWordVocabState } from '../hooks/useKaraokeSync';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

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
}) => {
  const totalVocab = trackData?.vocabulary?.length ?? 0;

  // Swipe up on vocab bar to open it
  const vocabBarSwipe = useSwipeGesture({
    onSwipeUp: onOpenVocab,
    minSwipeDistance: 30,
    maxSwipeTime: 500,
  });

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
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
              audioUrl={track.audioUrl}
              expectedDurationMs={track.metadata.durationMs}
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
          ) : (
            <VideoPlayer
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
      <div className="flex-1 flex flex-col justify-center px-4 py-4 overflow-hidden">
        {trackData ? (
          <LyricsDisplay
            trackData={trackData}
            currentTimeMs={currentTimeMs}
            unlockedVocabIndices={unlockedVocabIndices}
          />
        ) : (
          <div className="text-zinc-600 text-center">
            <div className="text-xl mb-2">Loading lyrics...</div>
          </div>
        )}
      </div>

      {/* Vocab Bar (Collapsed) */}
      <button
        onClick={onOpenVocab}
        {...vocabBarSwipe}
        className="flex-shrink-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-4 py-3 pb-16 safe-area-bottom"
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
  trackData: LoadedTrackData;
  currentTimeMs: number;
  unlockedVocabIndices: Set<number>;
}> = ({ trackData, currentTimeMs, unlockedVocabIndices }) => {
  const {
    currentSegmentIndex,
    currentWordIndex,
    spanishSegment,
    englishSegment,
  } = useKaraokeSync({
    spanishData: trackData.spanish,
    englishData: trackData.english,
    vocabulary: trackData.vocabulary,
    currentTimeMs,
  });

  // Handle instrumental or no segment found
  if (!spanishSegment || spanishSegment.type === 'INSTRUMENTAL') {
    const cueText = spanishSegment?.cueText || 'Instrumental';
    return (
      <div className="text-center">
        <div className="text-2xl text-zinc-500 italic">{cueText}</div>
      </div>
    );
  }

  return (
    <div className="text-center">
      {/* Spanish lyrics */}
      <div className="mb-8" style={{ fontSize: 36, lineHeight: 1.2, fontWeight: 700 }}>
        {spanishSegment.words?.map((word, index) => {
          const isHighlighted = index < currentWordIndex ||
            (index === currentWordIndex && currentTimeMs >= word.startTimeMs);

          // Check if this word is a vocab word
          const vocabState = getWordVocabState(
            word.word,
            currentSegmentIndex,
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
      <div style={{ fontSize: 24, lineHeight: 1.3 }}>
        {englishSegment?.words?.map((word, index) => {
          const isHighlighted = index < currentWordIndex ||
            (index === currentWordIndex && currentTimeMs >= word.startTimeMs);

          // Check if this word is a vocab word (English side)
          const vocabState = getWordVocabState(
            word.word,
            currentSegmentIndex,
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
