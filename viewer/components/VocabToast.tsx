import React, { useEffect, useRef } from 'react';
import { playPingSound } from '../utils/pingSoundContext';
import { analytics } from '../utils/analytics';

export interface ToastMessage {
  id: number;
  word: string;
  vocabIndex: number; // Index into vocabulary array
}

interface VocabToastContainerProps {
  trackId: string;
  toasts: ToastMessage[];
  onRemoveToast: (id: number) => void;
  onToastClick: (vocabIndex: number) => void;
}

// Container that renders multiple toasts
export const VocabToastContainer: React.FC<VocabToastContainerProps> = ({
  trackId,
  toasts,
  onRemoveToast,
  onToastClick,
}) => {
  return (
    <div className="fixed left-0 right-0 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none" style={{ bottom: 100 }}>
      {toasts.map((toast) => (
        <SingleToast
          key={toast.id}
          id={toast.id}
          word={toast.word}
          vocabIndex={toast.vocabIndex}
          trackId={trackId}
          onComplete={onRemoveToast}
          onClick={onToastClick}
        />
      ))}
    </div>
  );
};

interface SingleToastProps {
  id: number;
  word: string;
  vocabIndex: number;
  trackId: string;
  onComplete: (id: number) => void;
  onClick: (vocabIndex: number) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({ id, word, vocabIndex, trackId, onComplete, onClick }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasPlayedSound = useRef(false);

  // Play ping sound once on mount
  useEffect(() => {
    if (!hasPlayedSound.current) {
      hasPlayedSound.current = true;
      playPingSound();
    }
  }, []);

  // Handle animation end - remove toast when fade-out completes
  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === 'toastFadeOut') {
      onComplete(id);
    }
  };

  // Handle click - open vocab panel to this word
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Track toast click
    analytics.vocabToastClick(trackId, word);
    onClick(vocabIndex);
    onComplete(id); // Remove toast when clicked
  };

  return (
    <div
      ref={elementRef}
      className="vocab-toast px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-500 backdrop-blur-sm text-white font-semibold text-base shadow-xl shadow-purple-500/40 pointer-events-auto"
      style={{
        textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
      }}
      onAnimationEnd={handleAnimationEnd}
      onClick={handleClick}
    >
      <span className="text-purple-200 font-bold">{word}</span>
      <span className="ml-2 text-white/90">+1 vocab</span>
    </div>
  );
};

export default VocabToastContainer;
