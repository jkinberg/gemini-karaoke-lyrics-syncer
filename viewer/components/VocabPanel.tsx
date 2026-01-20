import React, { useRef, useEffect, useState } from 'react';
import type { VocabularyItem } from '../types';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { analytics, type VocabPanelTrigger } from '../utils/analytics';

// Icons
const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
  </svg>
);

const ReplayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const NextIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062A1.125 1.125 0 013 16.81V8.688zM12.75 8.688c0-.864.933-1.405 1.683-.977l7.108 4.062a1.125 1.125 0 010 1.953l-7.108 4.062a1.125 1.125 0 01-1.683-.977V8.688z" />
  </svg>
);

interface VocabPanelProps {
  trackId: string;
  vocabulary: VocabularyItem[];
  unlockedCount: number;
  unlockedIndices: Set<number>;
  highlightedIndex?: number | null;
  videoEnded?: boolean;
  hasNextTrack?: boolean;
  openTrigger?: VocabPanelTrigger;
  onClose: () => void;
  onSeekTo: (timeMs: number) => void;
  onPlayAgain?: () => void;
  onPlayNext?: () => void;
}

export const VocabPanel: React.FC<VocabPanelProps> = ({
  trackId,
  vocabulary,
  unlockedCount,
  unlockedIndices,
  highlightedIndex,
  videoEnded = false,
  hasNextTrack = false,
  openTrigger = 'tap',
  onClose,
  onSeekTo,
  onPlayAgain,
  onPlayNext,
}) => {
  const totalCount = vocabulary.length;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Track panel open on mount
  useEffect(() => {
    analytics.vocabPanelOpen(trackId, unlockedCount, totalCount, openTrigger as VocabPanelTrigger);
  }, []); // Only track once on mount

  // Trigger open animation on mount
  useEffect(() => {
    // Small delay to ensure initial render, then animate in
    requestAnimationFrame(() => {
      setIsOpen(true);
    });
  }, []);

  // Scroll to highlighted card when panel opens
  useEffect(() => {
    if (highlightedIndex !== null && highlightedIndex !== undefined) {
      const card = cardRefs.current[highlightedIndex];
      if (card) {
        // Small delay to ensure panel is rendered
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [highlightedIndex]);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  };

  // Handle play button (seek) with animation
  const handleSeekTo = (timeMs: number, vocabTerm: string) => {
    // Track seek to word
    analytics.vocabSeekToWord(trackId, vocabTerm, timeMs / 1000);
    setIsClosing(true);
    setTimeout(() => {
      onSeekTo(timeMs);
    }, 200); // Match animation duration
  };

  // Handle play again with animation
  const handlePlayAgain = () => {
    analytics.playAgain(trackId);
    setIsClosing(true);
    setTimeout(() => {
      onPlayAgain?.();
    }, 200);
  };

  // Handle play next with animation
  const handlePlayNext = () => {
    // Note: playNext tracking is handled in ViewerApp where we have access to both track IDs
    setIsClosing(true);
    setTimeout(() => {
      onPlayNext?.();
    }, 200);
  };

  // Swipe down on header to close
  const headerSwipe = useSwipeGesture({
    onSwipeDown: handleClose,
    minSwipeDistance: 30,
    maxSwipeTime: 500,
  });

  return (
    <div
      className="h-dvh flex flex-col bg-black transition-transform duration-200 ease-out"
      style={{
        transform: isOpen && !isClosing ? 'translateY(0)' : 'translateY(100%)',
      }}
    >
      {/* Header - flex-shrink-0 to stay fixed, content scrolls below */}
      <div
        className="flex-shrink-0 px-4 pt-12 pb-4 border-b border-zinc-800 safe-area-top bg-black"
        {...headerSwipe}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-3">
          <div className="w-32 h-1 rounded-full bg-zinc-500" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
              <BookIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold">Vocabulary</h1>
              <p className="text-sm text-zinc-500">
                {unlockedCount} of {totalCount} unlocked
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {/* Action buttons when video has ended */}
        {videoEnded && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={handlePlayAgain}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors"
            >
              <ReplayIcon />
              <span>Play Again</span>
            </button>
            {hasNextTrack && (
              <button
                onClick={handlePlayNext}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-colors"
              >
                <NextIcon />
                <span>Play Next</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vocab list - scrollable area with safe area padding at bottom */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 safe-area-bottom">
        {vocabulary.map((item, index) => {
          const isUnlocked = unlockedIndices.has(index);
          const isHighlighted = highlightedIndex === index;

          return (
            <VocabCard
              key={index}
              ref={(el) => { cardRefs.current[index] = el; }}
              item={item}
              isUnlocked={isUnlocked}
              isHighlighted={isHighlighted}
              onPlay={() => handleSeekTo(item.startTimeMs, item.term.spanish)}
            />
          );
        })}

        {vocabulary.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            No vocabulary for this song
          </div>
        )}
      </div>
    </div>
  );
};

interface VocabCardProps {
  item: VocabularyItem;
  isUnlocked: boolean;
  isHighlighted?: boolean;
  onPlay: () => void;
}

const VocabCard = React.forwardRef<HTMLDivElement, VocabCardProps>(
  ({ item, isUnlocked, isHighlighted, onPlay }, ref) => {
    if (!isUnlocked) {
      // Locked state
      return (
        <div ref={ref} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 font-semibold">
                {item.term.spanish}
              </span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-600 text-sm">
                {item.term.english}
              </span>
            </div>
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600">
              <LockIcon />
            </div>
          </div>
          <p className="text-zinc-700 text-sm mt-2">
            Keep listening to unlock...
          </p>
        </div>
      );
    }

    // Unlocked state - with optional highlight
    const highlightStyles = isHighlighted
      ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black shadow-lg shadow-purple-500/30'
      : '';

    return (
      <div
        ref={ref}
        className={`bg-zinc-900 rounded-xl p-4 border border-purple-500/30 transition-all duration-300 ${highlightStyles}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-purple-400 font-semibold"
              style={{
                textShadow: '0 0 10px rgba(192, 132, 252, 0.5)',
              }}
            >
              {item.term.spanish}
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400 text-sm">
              {item.term.english}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
              <CheckIcon />
            </div>
            <button
              onClick={onPlay}
              className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 hover:bg-purple-500/30 transition-colors"
            >
              <PlayIcon />
            </button>
          </div>
        </div>

        <p className="text-zinc-400 text-sm mb-3 leading-relaxed">
          {item.definition}
        </p>

        {/* Example quote */}
        <div className="bg-black/50 rounded-lg p-3 border-l-2 border-purple-500/50">
          <p className="text-purple-300 text-sm italic mb-1">
            "{item.example.spanish}"
          </p>
          <p className="text-zinc-500 text-xs">
            {item.example.english}
          </p>
        </div>
      </div>
    );
  }
);

export default VocabPanel;
