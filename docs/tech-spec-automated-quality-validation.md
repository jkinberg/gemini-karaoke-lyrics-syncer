# Technical Spec: Automated Quality Validation for Karaoke Data

**Status:** Draft
**Created:** 2025-12-26
**Priority:** Medium
**Dependencies:** None (can be implemented independently)

---

## Overview

This document outlines an automated quality validation system for generated karaoke timing data. The goal is to detect timing errors and data quality issues before manual review, reducing the time spent listening to tracks and identifying problems.

---

## Problem Statement

Currently, validating karaoke data accuracy requires:
1. Playing the full audio track in preview mode
2. Visually verifying word highlighting matches audio
3. Manually identifying timing issues
4. Re-processing or manually adjusting problematic segments

This is time-consuming and error-prone. Automated validation can catch many issues programmatically.

---

## Proposed Solution

A validation module that analyzes generated `KaraokeData` and returns a structured report of issues, warnings, and quality metrics.

---

## Validation Checks

### Tier 1: Critical Errors (Must Fix)

| Check | Description | Detection Logic |
|-------|-------------|-----------------|
| Zero-duration words | Words with `startTimeMs === endTimeMs` | `word.endTimeMs - word.startTimeMs === 0` |
| Negative duration | End time before start time | `word.endTimeMs < word.startTimeMs` |
| Overlapping words | Word timestamps overlap within segment | `words[i].endTimeMs > words[i+1].startTimeMs` |
| Out-of-bounds timing | Word timing outside segment bounds | `word.startTimeMs < segment.startTimeMs` or `word.endTimeMs > segment.endTimeMs` |
| Missing words array | LYRIC segment without words | `segment.type === 'LYRIC' && !segment.words?.length` |

### Tier 2: Warnings (Should Review)

| Check | Description | Threshold |
|-------|-------------|-----------|
| Large inter-word gaps | Gaps between consecutive words in same segment | > 500ms |
| Unusually short words | Words with very brief duration | < 50ms |
| Unusually long words | Single words with excessive duration | > 3000ms |
| Segment timing mismatch | Sum of word durations vs segment duration | > 20% difference |
| Empty text | Words or segments with empty/whitespace text | `!word.word.trim()` |

### Tier 3: Quality Metrics (Informational)

| Metric | Description |
|--------|-------------|
| Average word duration | Mean duration across all words |
| Duration variance | Standard deviation of word durations |
| Coverage ratio | Total word time / total segment time |
| Gap ratio | Total gap time / total segment time |
| Words per minute | Estimated speech rate |

---

## Data Structures

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;              // No critical errors
  summary: ValidationSummary;
  errors: ValidationIssue[];     // Tier 1: Must fix
  warnings: ValidationIssue[];   // Tier 2: Should review
  metrics: QualityMetrics;       // Tier 3: Informational
}

interface ValidationSummary {
  totalSegments: number;
  lyricSegments: number;
  instrumentalSegments: number;
  totalWords: number;
  errorCount: number;
  warningCount: number;
  qualityScore: number;          // 0-100 composite score
}

interface ValidationIssue {
  type: ValidationIssueType;
  severity: 'error' | 'warning';
  segmentIndex: number;
  wordIndex?: number;
  message: string;
  context: {
    text?: string;
    startTimeMs?: number;
    endTimeMs?: number;
    expected?: number;
    actual?: number;
  };
}

type ValidationIssueType =
  | 'ZERO_DURATION'
  | 'NEGATIVE_DURATION'
  | 'OVERLAPPING_WORDS'
  | 'OUT_OF_BOUNDS'
  | 'MISSING_WORDS'
  | 'LARGE_GAP'
  | 'SHORT_WORD'
  | 'LONG_WORD'
  | 'TIMING_MISMATCH'
  | 'EMPTY_TEXT';

interface QualityMetrics {
  averageWordDurationMs: number;
  durationVarianceMs: number;
  coverageRatio: number;         // 0-1
  gapRatio: number;              // 0-1
  wordsPerMinute: number;
  totalDurationMs: number;
}
```

---

## API Design

### Primary Function

```typescript
function validateKaraokeData(
  data: KaraokeData,
  options?: ValidationOptions
): ValidationResult;

interface ValidationOptions {
  // Threshold overrides
  maxInterWordGapMs?: number;    // Default: 500
  minWordDurationMs?: number;    // Default: 50
  maxWordDurationMs?: number;    // Default: 3000
  timingMismatchThreshold?: number; // Default: 0.2 (20%)

  // Skip certain checks
  skipWarnings?: boolean;
  skipMetrics?: boolean;
}
```

### Comparison Function

```typescript
// Compare Spanish and English versions for consistency
function compareKaraokeVersions(
  spanish: KaraokeData,
  english: KaraokeData
): ComparisonResult;

interface ComparisonResult {
  segmentCountMatch: boolean;
  timingDriftIssues: TimingDriftIssue[];
  wordCountComparison: {
    segmentIndex: number;
    spanishWords: number;
    englishWords: number;
  }[];
}
```

### Batch Validation

```typescript
// Validate both language versions at once
function validateKaraokeDataPair(
  spanish: KaraokeData,
  english: KaraokeData,
  options?: ValidationOptions
): {
  spanish: ValidationResult;
  english: ValidationResult;
  comparison: ComparisonResult;
};
```

---

## Implementation Plan

### Phase 1: Core Validation (MVP)

```
src/
  services/
    validationService.ts    # New file
```

**Functions to implement:**
1. `validateKaraokeData()` - Main entry point
2. `checkCriticalErrors()` - Tier 1 checks
3. `checkWarnings()` - Tier 2 checks
4. `calculateMetrics()` - Tier 3 metrics
5. `calculateQualityScore()` - Composite score (0-100)

**Estimated scope:** ~200-300 lines of TypeScript

### Phase 2: UI Integration

Add validation display to the existing UI:

1. **Auto-run after generation** - Validate immediately when data is generated
2. **Visual indicators** - Show error/warning counts in the UI
3. **Issue list** - Expandable panel showing specific issues
4. **Jump to segment** - Click issue to seek audio to problem area
5. **Quality score badge** - Show overall quality score

**UI mockup:**
```
┌─────────────────────────────────────────────────┐
│ Quality Score: 87/100  ⚠️ 3 warnings            │
├─────────────────────────────────────────────────┤
│ ⚠️ Segment 24: Large gap (1.2s) between words   │
│ ⚠️ Segment 29: Word "mirándote" unusually long  │
│ ⚠️ Segment 45: Timing mismatch (23% drift)      │
└─────────────────────────────────────────────────┘
```

### Phase 3: Auto-Reprocessing

If validation fails with critical errors:

1. **Identify problem segments** - Collect segment indices with errors
2. **Extract segment audio** - Use Web Audio API to isolate audio range
3. **Re-submit to Gemini** - Request re-analysis of specific segments
4. **Merge results** - Replace bad segments with new results
5. **Re-validate** - Confirm fixes resolved issues

**Considerations:**
- May require Gemini API changes to support segment-level processing
- Could be expensive (multiple API calls per track)
- Should have retry limit to prevent infinite loops

---

## Integration with Existing Code

### Current Flow
```
Upload Audio + Lyrics
        ↓
  Gemini API Call
        ↓
  Display Results ← Manual review happens here
        ↓
  Optional: Refine
        ↓
    Export JSON
```

### Proposed Flow
```
Upload Audio + Lyrics
        ↓
  Gemini API Call
        ↓
  AUTO-VALIDATE ← New step
        ↓
  ┌─────────────────┐
  │ Quality < 80?   │──Yes──→ Show warnings, suggest refinement
  └────────┬────────┘
           │ No
           ↓
  Display Results (with quality badge)
        ↓
  Optional: Refine
        ↓
  Re-validate after refinement
        ↓
    Export JSON
```

---

## Quality Score Calculation

Proposed formula:

```typescript
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

  return Math.max(0, Math.min(100, score));
}
```

**Score interpretation:**
- 90-100: Excellent - Ready for use
- 80-89: Good - Minor issues, likely acceptable
- 60-79: Fair - Review recommended
- Below 60: Poor - Re-processing recommended

---

## Testing Strategy

### Unit Tests

```typescript
describe('validateKaraokeData', () => {
  it('should detect zero-duration words', () => {
    const data = createTestData({
      words: [{ word: 'test', startTimeMs: 1000, endTimeMs: 1000 }]
    });
    const result = validateKaraokeData(data);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ type: 'ZERO_DURATION' })
    );
  });

  it('should detect overlapping words', () => { /* ... */ });
  it('should calculate correct quality score', () => { /* ... */ });
});
```

### Integration Tests

Use sample data from `/samples` directory:
- Validate known-good data (should pass)
- Validate data with known issues (should detect them)
- Compare validation results before/after refinement

---

## File Locations

```
src/
  services/
    validationService.ts      # Core validation logic
    validationService.test.ts # Unit tests
  types.ts                    # Add ValidationResult types
  App.tsx                     # UI integration
```

---

## Open Questions

1. **Threshold tuning** - What are the right thresholds for warnings? May need adjustment based on real-world data.

2. **Language-specific rules** - Should Spanish and English have different validation rules? (e.g., Spanish words may be longer on average)

3. **Segment-level reprocessing** - Is the Gemini API capable of re-analyzing individual segments, or must it process the full track?

4. **User preferences** - Should users be able to configure validation strictness?

---

## Success Criteria

1. Catches 90%+ of issues that would be found during manual review
2. Quality score correlates with user satisfaction
3. Reduces time spent on manual verification by 50%+
4. False positive rate < 10% (warnings that aren't real issues)

---

## Related Documents

- `docs/tech-spec-security-and-deployment.md` - Deployment automation
- `Claude.md` - Project overview
- `types.ts` - Existing type definitions
