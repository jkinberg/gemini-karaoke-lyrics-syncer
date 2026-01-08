import { KaraokeData, KaraokeSegment, KaraokeWord } from '../types';

// --- Types ---

export type ValidationIssueSeverity = 'error' | 'warning';

export type ValidationIssueType =
  // Critical errors (Tier 1)
  | 'ZERO_DURATION'
  | 'NEGATIVE_DURATION'
  | 'OVERLAPPING_WORDS'
  | 'OUT_OF_BOUNDS'
  | 'MISSING_WORDS'
  // Cross-language errors
  | 'SEGMENT_COUNT_MISMATCH'
  | 'SEGMENT_TIMING_MISMATCH'
  | 'SEGMENT_TYPE_MISMATCH'
  | 'SEGMENT_INDEX_MISMATCH'
  // Warnings (Tier 2)
  | 'LARGE_GAP'
  | 'SHORT_WORD'
  | 'LONG_WORD'
  | 'TIMING_MISMATCH'
  | 'EMPTY_TEXT'
  | 'WORD_COUNT_RATIO_EXTREME';

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: ValidationIssueSeverity;
  segmentIndex: number;
  wordIndex?: number;
  message: string;
  context: {
    text?: string;
    startTimeMs?: number;
    endTimeMs?: number;
    expected?: number | string;
    actual?: number | string;
  };
}

export interface QualityMetrics {
  averageWordDurationMs: number;
  coverageRatio: number;
  gapRatio: number;
  wordsPerMinute: number;
  totalDurationMs: number;
  totalWords: number;
  totalSegments: number;
  lyricSegments: number;
  instrumentalSegments: number;
}

export interface ValidationResult {
  isValid: boolean;
  qualityScore: number;
  errorCount: number;
  warningCount: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  metrics: QualityMetrics;
}

export interface CrossLanguageResult {
  isConsistent: boolean;
  issues: ValidationIssue[];
  segmentComparison: SegmentComparison[];
}

export interface SegmentComparison {
  index: number;
  spanish: { startTimeMs: number; endTimeMs: number; wordCount: number; type: string };
  english: { startTimeMs: number; endTimeMs: number; wordCount: number; type: string };
  issues: string[];
}

export interface ValidationReport {
  spanish: ValidationResult;
  english: ValidationResult;
  crossLanguage: CrossLanguageResult;
  overallScore: number;
  overallValid: boolean;
}

// --- Configuration ---

const DEFAULT_THRESHOLDS = {
  maxInterWordGapMs: 500,
  minWordDurationMs: 50,
  maxWordDurationMs: 3000,
  timingMismatchThreshold: 0.2,
  segmentTimingToleranceMs: 10,
  wordCountRatioMax: 2.0,
  wordCountRatioMin: 0.5,
};

// --- Single Language Validation ---

export function validateKaraokeData(data: KaraokeData): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Validate each segment
  data.segments.forEach((segment, segmentIndex) => {
    // Check for missing words in LYRIC segments
    if (segment.type === 'LYRIC' && (!segment.words || segment.words.length === 0)) {
      errors.push({
        type: 'MISSING_WORDS',
        severity: 'error',
        segmentIndex,
        message: `LYRIC segment has no words array`,
        context: { text: segment.text },
      });
      return;
    }

    // Check for empty text
    if (segment.type === 'LYRIC' && (!segment.text || !segment.text.trim())) {
      warnings.push({
        type: 'EMPTY_TEXT',
        severity: 'warning',
        segmentIndex,
        message: `LYRIC segment has empty text`,
        context: {},
      });
    }

    // Validate words within segment
    if (segment.words) {
      segment.words.forEach((word, wordIndex) => {
        const duration = word.endTimeMs - word.startTimeMs;

        // Zero duration
        if (duration === 0) {
          errors.push({
            type: 'ZERO_DURATION',
            severity: 'error',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" has zero duration`,
            context: { text: word.word, startTimeMs: word.startTimeMs, endTimeMs: word.endTimeMs },
          });
        }

        // Negative duration
        if (duration < 0) {
          errors.push({
            type: 'NEGATIVE_DURATION',
            severity: 'error',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" has negative duration (${duration}ms)`,
            context: { text: word.word, startTimeMs: word.startTimeMs, endTimeMs: word.endTimeMs },
          });
        }

        // Out of bounds
        if (word.startTimeMs < segment.startTimeMs) {
          errors.push({
            type: 'OUT_OF_BOUNDS',
            severity: 'error',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" starts before segment`,
            context: {
              text: word.word,
              startTimeMs: word.startTimeMs,
              expected: segment.startTimeMs,
              actual: word.startTimeMs,
            },
          });
        }

        if (word.endTimeMs > segment.endTimeMs) {
          errors.push({
            type: 'OUT_OF_BOUNDS',
            severity: 'error',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" ends after segment`,
            context: {
              text: word.word,
              endTimeMs: word.endTimeMs,
              expected: segment.endTimeMs,
              actual: word.endTimeMs,
            },
          });
        }

        // Unusually short word
        if (duration > 0 && duration < DEFAULT_THRESHOLDS.minWordDurationMs) {
          warnings.push({
            type: 'SHORT_WORD',
            severity: 'warning',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" is unusually short (${duration}ms)`,
            context: { text: word.word, startTimeMs: word.startTimeMs, endTimeMs: word.endTimeMs },
          });
        }

        // Unusually long word
        if (duration > DEFAULT_THRESHOLDS.maxWordDurationMs) {
          warnings.push({
            type: 'LONG_WORD',
            severity: 'warning',
            segmentIndex,
            wordIndex,
            message: `Word "${word.word}" is unusually long (${duration}ms)`,
            context: { text: word.word, startTimeMs: word.startTimeMs, endTimeMs: word.endTimeMs },
          });
        }

        // Check for overlapping words
        if (wordIndex > 0) {
          const prevWord = segment.words![wordIndex - 1];
          if (prevWord.endTimeMs > word.startTimeMs) {
            errors.push({
              type: 'OVERLAPPING_WORDS',
              severity: 'error',
              segmentIndex,
              wordIndex,
              message: `Word "${word.word}" overlaps with previous word "${prevWord.word}"`,
              context: {
                text: `${prevWord.word} → ${word.word}`,
                expected: prevWord.endTimeMs,
                actual: word.startTimeMs,
              },
            });
          }

          // Large gap between words
          const gap = word.startTimeMs - prevWord.endTimeMs;
          if (gap > DEFAULT_THRESHOLDS.maxInterWordGapMs) {
            warnings.push({
              type: 'LARGE_GAP',
              severity: 'warning',
              segmentIndex,
              wordIndex,
              message: `Large gap (${gap}ms) between "${prevWord.word}" and "${word.word}"`,
              context: {
                text: `${prevWord.word} → ${word.word}`,
                expected: DEFAULT_THRESHOLDS.maxInterWordGapMs,
                actual: gap,
              },
            });
          }
        }

        // Empty word text
        if (!word.word || !word.word.trim()) {
          warnings.push({
            type: 'EMPTY_TEXT',
            severity: 'warning',
            segmentIndex,
            wordIndex,
            message: `Word at index ${wordIndex} has empty text`,
            context: {},
          });
        }
      });
    }
  });

  // Calculate metrics
  const metrics = calculateMetrics(data);

  // Calculate quality score
  const qualityScore = calculateQualityScore(errors, warnings, metrics);

  return {
    isValid: errors.length === 0,
    qualityScore,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    metrics,
  };
}

// --- Cross-Language Validation ---

export function validateCrossLanguage(
  spanish: KaraokeData,
  english: KaraokeData
): CrossLanguageResult {
  const issues: ValidationIssue[] = [];
  const segmentComparison: SegmentComparison[] = [];

  // Check segment count mismatch
  if (spanish.segments.length !== english.segments.length) {
    issues.push({
      type: 'SEGMENT_COUNT_MISMATCH',
      severity: 'error',
      segmentIndex: -1,
      message: `Segment count mismatch: Spanish has ${spanish.segments.length}, English has ${english.segments.length}`,
      context: {
        expected: spanish.segments.length,
        actual: english.segments.length,
      },
    });
  }

  // Compare segments pairwise
  const minSegments = Math.min(spanish.segments.length, english.segments.length);

  for (let i = 0; i < minSegments; i++) {
    const spSeg = spanish.segments[i];
    const enSeg = english.segments[i];
    const segmentIssues: string[] = [];

    // Type mismatch
    if (spSeg.type !== enSeg.type) {
      issues.push({
        type: 'SEGMENT_TYPE_MISMATCH',
        severity: 'error',
        segmentIndex: i,
        message: `Segment ${i + 1} type mismatch: Spanish is ${spSeg.type}, English is ${enSeg.type}`,
        context: { expected: spSeg.type, actual: enSeg.type },
      });
      segmentIssues.push(`Type: ${spSeg.type} vs ${enSeg.type}`);
    }

    // Index mismatch
    if (spSeg.segmentIndex !== enSeg.segmentIndex) {
      issues.push({
        type: 'SEGMENT_INDEX_MISMATCH',
        severity: 'error',
        segmentIndex: i,
        message: `Segment ${i + 1} index mismatch: Spanish is ${spSeg.segmentIndex}, English is ${enSeg.segmentIndex}`,
        context: { expected: spSeg.segmentIndex, actual: enSeg.segmentIndex },
      });
      segmentIssues.push(`Index: ${spSeg.segmentIndex} vs ${enSeg.segmentIndex}`);
    }

    // Start time mismatch
    const startDiff = Math.abs(spSeg.startTimeMs - enSeg.startTimeMs);
    if (startDiff > DEFAULT_THRESHOLDS.segmentTimingToleranceMs) {
      issues.push({
        type: 'SEGMENT_TIMING_MISMATCH',
        severity: 'error',
        segmentIndex: i,
        message: `Segment ${i + 1} start time differs by ${startDiff}ms`,
        context: {
          expected: spSeg.startTimeMs,
          actual: enSeg.startTimeMs,
        },
      });
      segmentIssues.push(`Start: ${startDiff}ms drift`);
    }

    // End time mismatch
    const endDiff = Math.abs(spSeg.endTimeMs - enSeg.endTimeMs);
    if (endDiff > DEFAULT_THRESHOLDS.segmentTimingToleranceMs) {
      issues.push({
        type: 'SEGMENT_TIMING_MISMATCH',
        severity: 'error',
        segmentIndex: i,
        message: `Segment ${i + 1} end time differs by ${endDiff}ms`,
        context: {
          expected: spSeg.endTimeMs,
          actual: enSeg.endTimeMs,
        },
      });
      segmentIssues.push(`End: ${endDiff}ms drift`);
    }

    // Word count ratio (warning only)
    const spWordCount = spSeg.words?.length || 0;
    const enWordCount = enSeg.words?.length || 0;
    if (spWordCount > 0 && enWordCount > 0) {
      const ratio = enWordCount / spWordCount;
      if (ratio > DEFAULT_THRESHOLDS.wordCountRatioMax || ratio < DEFAULT_THRESHOLDS.wordCountRatioMin) {
        issues.push({
          type: 'WORD_COUNT_RATIO_EXTREME',
          severity: 'warning',
          segmentIndex: i,
          message: `Segment ${i + 1} word count ratio is ${ratio.toFixed(2)}x (Spanish: ${spWordCount}, English: ${enWordCount})`,
          context: {
            expected: `${DEFAULT_THRESHOLDS.wordCountRatioMin}-${DEFAULT_THRESHOLDS.wordCountRatioMax}`,
            actual: ratio.toFixed(2),
          },
        });
        segmentIssues.push(`Words: ${spWordCount} vs ${enWordCount} (${ratio.toFixed(1)}x)`);
      }
    }

    segmentComparison.push({
      index: i,
      spanish: {
        startTimeMs: spSeg.startTimeMs,
        endTimeMs: spSeg.endTimeMs,
        wordCount: spWordCount,
        type: spSeg.type,
      },
      english: {
        startTimeMs: enSeg.startTimeMs,
        endTimeMs: enSeg.endTimeMs,
        wordCount: enWordCount,
        type: enSeg.type,
      },
      issues: segmentIssues,
    });
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;

  return {
    isConsistent: errorCount === 0,
    issues,
    segmentComparison,
  };
}

// --- Combined Validation ---

export function validateKaraokeDataPair(
  spanish: KaraokeData,
  english: KaraokeData
): ValidationReport {
  const spanishResult = validateKaraokeData(spanish);
  const englishResult = validateKaraokeData(english);
  const crossLanguageResult = validateCrossLanguage(spanish, english);

  // Calculate overall score (weighted average)
  const crossLanguageErrorPenalty = crossLanguageResult.issues
    .filter(i => i.severity === 'error').length * 10;
  const crossLanguageWarningPenalty = crossLanguageResult.issues
    .filter(i => i.severity === 'warning').length * 2;

  const overallScore = Math.max(
    0,
    Math.min(
      100,
      (spanishResult.qualityScore + englishResult.qualityScore) / 2 -
        crossLanguageErrorPenalty -
        crossLanguageWarningPenalty
    )
  );

  const overallValid =
    spanishResult.isValid &&
    englishResult.isValid &&
    crossLanguageResult.isConsistent;

  return {
    spanish: spanishResult,
    english: englishResult,
    crossLanguage: crossLanguageResult,
    overallScore: Math.round(overallScore),
    overallValid,
  };
}

// --- Helper Functions ---

function calculateMetrics(data: KaraokeData): QualityMetrics {
  const lyricSegments = data.segments.filter(s => s.type === 'LYRIC');
  const instrumentalSegments = data.segments.filter(s => s.type === 'INSTRUMENTAL');

  let totalWordDuration = 0;
  let totalWords = 0;
  let totalGapTime = 0;
  let totalSegmentTime = 0;

  lyricSegments.forEach(segment => {
    const segmentDuration = segment.endTimeMs - segment.startTimeMs;
    totalSegmentTime += segmentDuration;

    if (segment.words && segment.words.length > 0) {
      segment.words.forEach((word, i) => {
        const duration = word.endTimeMs - word.startTimeMs;
        if (duration > 0) {
          totalWordDuration += duration;
          totalWords++;
        }

        // Calculate gaps
        if (i > 0) {
          const prevWord = segment.words![i - 1];
          const gap = word.startTimeMs - prevWord.endTimeMs;
          if (gap > 0) {
            totalGapTime += gap;
          }
        }
      });

      // Gap at start of segment
      const firstWord = segment.words[0];
      if (firstWord.startTimeMs > segment.startTimeMs) {
        totalGapTime += firstWord.startTimeMs - segment.startTimeMs;
      }

      // Gap at end of segment
      const lastWord = segment.words[segment.words.length - 1];
      if (lastWord.endTimeMs < segment.endTimeMs) {
        totalGapTime += segment.endTimeMs - lastWord.endTimeMs;
      }
    }
  });

  const totalDurationMs = data.metadata.durationMs ||
    (data.segments.length > 0 ? data.segments[data.segments.length - 1].endTimeMs : 0);

  const averageWordDurationMs = totalWords > 0 ? totalWordDuration / totalWords : 0;
  const coverageRatio = totalSegmentTime > 0 ? totalWordDuration / totalSegmentTime : 0;
  const gapRatio = totalSegmentTime > 0 ? totalGapTime / totalSegmentTime : 0;
  const wordsPerMinute = totalDurationMs > 0 ? (totalWords / totalDurationMs) * 60000 : 0;

  return {
    averageWordDurationMs: Math.round(averageWordDurationMs),
    coverageRatio: Math.round(coverageRatio * 100) / 100,
    gapRatio: Math.round(gapRatio * 100) / 100,
    wordsPerMinute: Math.round(wordsPerMinute),
    totalDurationMs,
    totalWords,
    totalSegments: data.segments.length,
    lyricSegments: lyricSegments.length,
    instrumentalSegments: instrumentalSegments.length,
  };
}

function calculateQualityScore(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  metrics: QualityMetrics
): number {
  let score = 100;

  // Critical errors heavily penalized
  score -= errors.length * 15;

  // Warnings moderately penalized
  score -= warnings.length * 3;

  // Poor coverage penalized
  if (metrics.coverageRatio < 0.8) {
    score -= (0.8 - metrics.coverageRatio) * 20;
  }

  // High gap ratio penalized
  if (metrics.gapRatio > 0.3) {
    score -= (metrics.gapRatio - 0.3) * 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- Utility: Get Score Interpretation ---

export function getScoreInterpretation(score: number): {
  label: string;
  color: string;
  recommendation: string;
} {
  if (score >= 90) {
    return {
      label: 'Excellent',
      color: 'text-green-400',
      recommendation: 'Ready for use',
    };
  } else if (score >= 80) {
    return {
      label: 'Good',
      color: 'text-green-300',
      recommendation: 'Minor issues, likely acceptable',
    };
  } else if (score >= 60) {
    return {
      label: 'Fair',
      color: 'text-yellow-400',
      recommendation: 'Review recommended',
    };
  } else {
    return {
      label: 'Poor',
      color: 'text-red-400',
      recommendation: 'Re-processing recommended',
    };
  }
}
