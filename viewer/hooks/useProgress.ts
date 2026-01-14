import { useState, useCallback } from 'react';

// Session-only progress tracking (resets on page refresh)
// For persistent storage, change to use localStorage

export interface VocabProgress {
  unlocked: boolean;
  encounters: number;
  firstUnlockedAt?: string;
}

export interface SongProgress {
  playCount: number;
  completed: boolean; // listened to >80%
  lastPlayed: string;
  maxTimeReachedMs: number;
}

export interface ProgressData {
  streak: {
    current: number;
    longest: number;
    lastActiveDate: string;
  };
  songs: Record<string, SongProgress>;
  vocabulary: Record<string, VocabProgress>;
  stats: {
    totalSongsCompleted: number;
    totalVocabUnlocked: number;
    totalMinutesListened: number;
  };
}

const DEFAULT_PROGRESS: ProgressData = {
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: '',
  },
  songs: {},
  vocabulary: {},
  stats: {
    totalSongsCompleted: 0,
    totalVocabUnlocked: 0,
    totalMinutesListened: 0,
  },
};

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === yesterday.toISOString().split('T')[0];
}

export function useProgress() {
  // Session-only state - starts fresh on each page load
  const [progress, setProgress] = useState<ProgressData>(DEFAULT_PROGRESS);

  // Mark user as active today (call when user interacts)
  const markActive = useCallback(() => {
    const today = getTodayDate();

    setProgress((prev) => {
      if (prev.streak.lastActiveDate === today) {
        return prev; // Already marked active today
      }

      let newStreak = 1;
      if (isYesterday(prev.streak.lastActiveDate)) {
        newStreak = prev.streak.current + 1;
      }

      return {
        ...prev,
        streak: {
          current: newStreak,
          longest: Math.max(newStreak, prev.streak.longest),
          lastActiveDate: today,
        },
      };
    });
  }, []);

  // Record song progress
  const recordSongProgress = useCallback((
    songId: string,
    currentTimeMs: number,
    durationMs: number
  ) => {
    setProgress((prev) => {
      const existing = prev.songs[songId] || {
        playCount: 0,
        completed: false,
        lastPlayed: '',
        maxTimeReachedMs: 0,
      };

      const maxTimeReachedMs = Math.max(existing.maxTimeReachedMs, currentTimeMs);
      const isCompleted = maxTimeReachedMs >= durationMs * 0.8;
      const wasCompleted = existing.completed;

      return {
        ...prev,
        songs: {
          ...prev.songs,
          [songId]: {
            ...existing,
            lastPlayed: new Date().toISOString(),
            maxTimeReachedMs,
            completed: isCompleted,
          },
        },
        stats: {
          ...prev.stats,
          totalSongsCompleted: prev.stats.totalSongsCompleted + (isCompleted && !wasCompleted ? 1 : 0),
        },
      };
    });
  }, []);

  // Unlock a vocabulary word
  const unlockVocab = useCallback((vocabId: string): boolean => {
    let isNewUnlock = false;

    setProgress((prev) => {
      const existing = prev.vocabulary[vocabId];

      if (existing?.unlocked) {
        // Already unlocked, just increment encounters
        return {
          ...prev,
          vocabulary: {
            ...prev.vocabulary,
            [vocabId]: {
              ...existing,
              encounters: existing.encounters + 1,
            },
          },
        };
      }

      // New unlock!
      isNewUnlock = true;
      return {
        ...prev,
        vocabulary: {
          ...prev.vocabulary,
          [vocabId]: {
            unlocked: true,
            encounters: 1,
            firstUnlockedAt: new Date().toISOString(),
          },
        },
        stats: {
          ...prev.stats,
          totalVocabUnlocked: prev.stats.totalVocabUnlocked + 1,
        },
      };
    });

    return isNewUnlock;
  }, []);

  // Check if vocab is unlocked
  const isVocabUnlocked = useCallback((vocabId: string): boolean => {
    return progress.vocabulary[vocabId]?.unlocked ?? false;
  }, [progress.vocabulary]);

  // Add listening time
  const addListeningTime = useCallback((minutes: number) => {
    setProgress((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        totalMinutesListened: prev.stats.totalMinutesListened + minutes,
      },
    }));
  }, []);

  // Get song progress
  const getSongProgress = useCallback((songId: string): SongProgress | undefined => {
    return progress.songs[songId];
  }, [progress.songs]);

  return {
    progress,
    markActive,
    recordSongProgress,
    unlockVocab,
    isVocabUnlocked,
    addListeningTime,
    getSongProgress,
  };
}

/**
 * Generate a unique vocab ID from song and term
 */
export function getVocabId(songId: string, term: string): string {
  return `${songId}-${term.toLowerCase().replace(/\s+/g, '-')}`;
}
