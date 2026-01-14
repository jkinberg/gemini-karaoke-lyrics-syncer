import { useMemo } from 'react';
import type { KaraokeData, VocabularyItem } from '../types';

export interface VocabState {
  isVocab: boolean;
  isActive: boolean;  // Current time is within this vocab's time range
  isUnlocked: boolean; // Time has passed this vocab's startTimeMs
  vocabItem?: VocabularyItem;
}

export interface SyncState {
  currentSegmentIndex: number;
  currentWordIndex: number;
  spanishSegment: KaraokeData['segments'][0] | null;
  englishSegment: KaraokeData['segments'][0] | null;
  activeVocabItems: VocabularyItem[];
  unlockedVocabIds: Set<number>;
}

interface UseKaraokeSyncOptions {
  spanishData: KaraokeData | null;
  englishData: KaraokeData | null;
  vocabulary: VocabularyItem[] | null;
  currentTimeMs: number;
}

export function useKaraokeSync({
  spanishData,
  englishData,
  vocabulary,
  currentTimeMs,
}: UseKaraokeSyncOptions): SyncState {
  return useMemo(() => {
    if (!spanishData) {
      return {
        currentSegmentIndex: -1,
        currentWordIndex: -1,
        spanishSegment: null,
        englishSegment: null,
        activeVocabItems: [],
        unlockedVocabIds: new Set(),
      };
    }

    // Find current segment
    const currentSegmentIndex = spanishData.segments.findIndex(
      (seg) => currentTimeMs >= seg.startTimeMs && currentTimeMs < seg.endTimeMs
    );

    const spanishSegment = spanishData.segments[currentSegmentIndex] ?? null;
    const englishSegment = englishData?.segments[currentSegmentIndex] ?? null;

    // Find current word index within segment
    let currentWordIndex = -1;
    if (spanishSegment?.words) {
      currentWordIndex = spanishSegment.words.findIndex(
        (word) => currentTimeMs < word.endTimeMs
      );
      // If all words have passed, set to last word + 1
      if (currentWordIndex === -1 && spanishSegment.words.length > 0) {
        currentWordIndex = spanishSegment.words.length;
      }
    }

    // Find active vocab items (currently in their time window)
    const activeVocabItems = vocabulary?.filter(
      (v) => currentTimeMs >= v.startTimeMs && currentTimeMs < v.endTimeMs
    ) ?? [];

    // Find unlocked vocab items (time has passed their start)
    const unlockedVocabIds = new Set<number>();
    vocabulary?.forEach((v, index) => {
      if (currentTimeMs >= v.startTimeMs) {
        unlockedVocabIds.add(index);
      }
    });

    return {
      currentSegmentIndex,
      currentWordIndex,
      spanishSegment,
      englishSegment,
      activeVocabItems,
      unlockedVocabIds,
    };
  }, [spanishData, englishData, vocabulary, currentTimeMs]);
}

/**
 * Check if a word matches a vocab highlight term
 * Handles partial matches and punctuation
 */
export function matchesVocabHighlight(
  word: string,
  highlightTerm: string
): boolean {
  // Normalize both strings: lowercase and remove punctuation
  const normalizedWord = word.toLowerCase().replace(/[.,!?'"¿¡()]/g, '');
  const normalizedTerm = highlightTerm.toLowerCase().replace(/[.,!?'"¿¡()]/g, '');

  // Exact match
  if (normalizedWord === normalizedTerm) return true;

  // Word contains the term (e.g., word "Tití" contains term "tití")
  if (normalizedWord.includes(normalizedTerm)) return true;

  // Term contains the word - only for multi-word terms like "total babe"
  // Require word to be at least 3 chars to avoid false positives like "I" matching "Auntie"
  if (normalizedWord.length >= 3 && normalizedTerm.includes(normalizedWord)) return true;

  return false;
}

/**
 * Get vocab state for a specific word in a segment
 */
export function getWordVocabState(
  word: string,
  segmentIndex: number,
  vocabulary: VocabularyItem[] | null,
  currentTimeMs: number,
  language: 'spanish' | 'english'
): VocabState {
  if (!vocabulary) {
    return { isVocab: false, isActive: false, isUnlocked: false };
  }

  // Find vocab item that matches this word in this segment
  const vocabItem = vocabulary.find((v) => {
    if (v.segmentIndex !== segmentIndex) return false;
    const highlightTerm = language === 'spanish' ? v.highlight.spanish : v.highlight.english;
    return matchesVocabHighlight(word, highlightTerm);
  });

  if (!vocabItem) {
    return { isVocab: false, isActive: false, isUnlocked: false };
  }

  const isActive = currentTimeMs >= vocabItem.startTimeMs && currentTimeMs < vocabItem.endTimeMs;
  const isUnlocked = currentTimeMs >= vocabItem.startTimeMs;

  return {
    isVocab: true,
    isActive,
    isUnlocked,
    vocabItem,
  };
}
