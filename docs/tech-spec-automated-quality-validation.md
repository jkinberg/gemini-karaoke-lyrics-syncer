# Technical Spec: Automated Quality Validation for Karaoke Data

**Status:** Partially Implemented
**Created:** 2025-12-26
**Updated:** 2026-01-08
**Priority:** Medium
**Dependencies:** None (can be implemented independently)

### Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Core Validation | ✅ Implemented | `validationService.ts` |
| Phase 2: UI Integration | ✅ Implemented | ValidationBadge, ValidationPanel in App.tsx |
| Phase 3: Auto-Reprocessing | ✅ Implemented | Via Phase 7 Option D |
| Phase 4: Cross-Language | ✅ Implemented | `validateCrossLanguage()` |
| Phase 5: Translation Alignment | 📋 Planned | Options documented |
| Phase 6: Vocabulary Consistency | 📋 Planned | Options documented |
| Phase 7 Option D: Auto-Fix | ✅ Implemented | `autoRefineProblems()` in geminiService.ts |

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

## Phase 4: Cross-Language Consistency Validation

The current system generates Spanish and English karaoke data in separate passes, with no enforcement that they remain structurally aligned. This causes vocabulary timecode drift and translation sync issues.

### New Validation Checks

#### Tier 1: Critical Cross-Language Errors

| Check | Description | Detection Logic |
|-------|-------------|-----------------|
| Segment count mismatch | Spanish and English have different segment counts | `spanish.segments.length !== english.segments.length` |
| Segment timing divergence | Same segment has different timing across languages | `abs(spanish.segments[i].startTimeMs - english.segments[i].startTimeMs) > 10` |
| Segment type mismatch | LYRIC vs INSTRUMENTAL differs between languages | `spanish.segments[i].type !== english.segments[i].type` |
| Segment index mismatch | segmentIndex values don't match | `spanish.segments[i].segmentIndex !== english.segments[i].segmentIndex` |

#### Tier 2: Cross-Language Warnings

| Check | Description | Threshold |
|-------|-------------|-----------|
| Word count ratio extreme | Translated segment has very different word count | Ratio > 2.0 or < 0.5 |
| Syllable density mismatch | Translated words crammed into short duration | < 80ms per syllable estimated |
| Segment end time drift | English segment ends at different time than Spanish | > 50ms difference |

### Extended ComparisonResult

```typescript
interface ComparisonResult {
  isConsistent: boolean;              // No critical cross-language errors
  segmentCountMatch: boolean;
  segmentCount: { spanish: number; english: number };

  timingDriftIssues: TimingDriftIssue[];
  structureMismatches: StructureMismatch[];
  wordCountComparison: WordCountComparison[];

  // New: segment-by-segment alignment report
  segmentAlignment: SegmentAlignmentReport[];
}

interface SegmentAlignmentReport {
  segmentIndex: number;
  spanish: { startTimeMs: number; endTimeMs: number; wordCount: number; text: string };
  english: { startTimeMs: number; endTimeMs: number; wordCount: number; text: string };
  issues: string[];  // e.g., ["timing drift: 15ms", "word ratio: 2.5x"]
}

interface StructureMismatch {
  segmentIndex: number;
  type: 'COUNT' | 'TYPE' | 'INDEX' | 'TIMING';
  spanish: unknown;
  english: unknown;
  message: string;
}
```

### Enforcement Strategy

When `compareKaraokeVersions()` detects critical mismatches:

1. **Reject and re-generate** - If segment counts differ, translation alignment failed
2. **Auto-correct timing** - Copy segment-level timing from Spanish to English
3. **Warn user** - Display specific segments that need review

---

## Phase 5: Translation Alignment Improvements

### Problem: No Audio Ground Truth

The current translation alignment prompt receives:
- Original timed Spanish data
- Translated English text
- **No audio file**

This means Gemini distributes word timing based on guessed syllable counts, not actual vocal delivery.

### Solution A: Audio-Informed Translation Alignment (Recommended)

Modify `generateKaraokeData()` to pass audio to the translation alignment step:

```typescript
// Current (line 373-409 in geminiService.ts):
const translationResult = await retryWithBackoff(async () => {
  return await ai.models.generateContent({
    model: SYNC_MODEL,
    contents: [{ role: 'user', parts: [{ text: translationPrompt }] }],  // No audio!
    // ...
  });
}, 3, 2000);

// Proposed:
const translationResult = await retryWithBackoff(async () => {
  return await ai.models.generateContent({
    model: SYNC_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: audioMimeType, data: audioBase64 } },  // ADD AUDIO
        { text: translationPrompt }
      ]
    }],
    // ...
  });
}, 3, 2000);
```

**Prompt modification:**

```
You are refining the translation alignment. You have:
1. The original Spanish karaoke data with word-level timing
2. The English translation text
3. The original audio file

Your task:
- Listen to the audio to verify syllable timing
- Map English words to the same vocal moments as Spanish
- If English has more/fewer words, distribute timing proportionally BUT verify against audio
- Output must have IDENTICAL segment timing to Spanish input
```

**Trade-offs:**
- ✅ Higher accuracy - AI can verify translation fits vocal delivery
- ❌ Higher cost - Audio processing doubles API cost
- ❌ Higher latency - Additional audio analysis time

### Solution B: Algorithmic Fallback (Lower Cost)

If audio-informed alignment is too expensive, implement deterministic word timing distribution:

```typescript
function distributeWordTiming(
  segmentStart: number,
  segmentEnd: number,
  words: string[],
  originalWords: KaraokeWord[]
): KaraokeWord[] {
  const segmentDuration = segmentEnd - segmentStart;

  // Estimate syllables per word (simple heuristic)
  const syllableCounts = words.map(w => estimateSyllables(w));
  const totalSyllables = syllableCounts.reduce((a, b) => a + b, 0);

  // Distribute proportionally
  let currentTime = segmentStart;
  return words.map((word, i) => {
    const proportion = syllableCounts[i] / totalSyllables;
    const duration = Math.round(segmentDuration * proportion);
    const result = {
      word,
      startTimeMs: currentTime,
      endTimeMs: currentTime + duration,
    };
    currentTime += duration;
    return result;
  });
}

function estimateSyllables(word: string): number {
  // Count vowel groups as syllables
  const vowelGroups = word.toLowerCase().match(/[aeiouy]+/g) || [];
  return Math.max(1, vowelGroups.length);
}
```

**Usage:** Run this AFTER Gemini generates translation, as a correction pass.

### Solution C: Segment Structure Lock (Prompt Engineering)

Add explicit constraints to all prompts that modify karaoke data:

```typescript
const SEGMENT_LOCK_INSTRUCTION = `
**CRITICAL STRUCTURAL CONSTRAINTS:**
1. You MUST output EXACTLY ${segmentCount} segments
2. Each segment MUST have segmentIndex values 1 through ${segmentCount} in order
3. Segment-level startTimeMs and endTimeMs MUST match the input EXACTLY
4. You may ONLY modify word-level timing and text within segments
5. Do NOT merge, split, add, or remove segments

If you cannot comply with these constraints, output an error instead of invalid data.
`;
```

Add this to:
- `buildTranslationAlignmentPrompt()`
- `buildRefinementPrompt()`
- `buildTranslatedRefinementPrompt()`

---

## Phase 6: Vocabulary Timecode Consistency

### Problem Statement

Vocabulary items reference segments by `segmentIndex`, but:
1. Index is 1-based (Gemini output) vs 0-based (JavaScript arrays)
2. Refinement can change segment count, invalidating indices
3. Timecodes are segment-level, not word-level
4. Out-of-bounds indices silently return stale data

### Solution 1: Word-Level Vocabulary Timecodes

Modify vocabulary extraction prompt to find the specific word's timing, not just segment timing:

```typescript
// Current prompt instruction:
"Find the startTimeMs of the *entire segment* where the term appears"

// Proposed:
"Find the WORD-LEVEL timing for the term:
1. Locate the segment containing the term
2. Find the specific word(s) within that segment's words array
3. Return the startTimeMs of the FIRST word of the term
4. Return the endTimeMs of the LAST word of the term

Example:
Segment words: [{"word": "El", ...}, {"word": "amor", "startTimeMs": 5000, "endTimeMs": 5400}, ...]
Term: "amor"
Result: startTimeMs: 5000, endTimeMs: 5400 (word-level, not segment-level)"
```

**Extended VocabularyItem type:**

```typescript
interface VocabularyItem {
  // ... existing fields ...

  // Segment-level (for context)
  segmentIndex: number;
  segmentStartTimeMs: number;
  segmentEndTimeMs: number;

  // Word-level (for precise playback)
  wordStartTimeMs: number;   // NEW
  wordEndTimeMs: number;     // NEW
  wordIndices: number[];     // NEW: indices within segment.words array
}
```

### Solution 2: Vocabulary Re-Extraction After Refinement

Add a flag to track when vocabulary needs regeneration:

```typescript
// In App.tsx state
const [vocabularyStale, setVocabularyStale] = useState(false);

// After any refinement operation
const handleRefineComplete = () => {
  setVocabularyStale(true);
  // Show warning: "Vocabulary timecodes may be outdated. Regenerate vocabulary?"
};

// Auto-regenerate option
const handleRegenerateVocabulary = async () => {
  if (karaokeData) {
    const newVocabulary = await generateVocabularyList(karaokeData.spanish, karaokeData.english);
    setVocabularyList(newVocabulary);
    setVocabularyStale(false);
  }
};
```

### Solution 3: Robust Segment Matching

Instead of relying solely on `segmentIndex`, match vocabulary to segments by text content:

```typescript
function findVocabularySegment(
  vocab: VocabularyItem,
  segments: KaraokeSegment[]
): KaraokeSegment | null {
  // Primary: try by index
  const byIndex = segments[vocab.segmentIndex - 1];
  if (byIndex?.text?.includes(vocab.term.spanish)) {
    return byIndex;
  }

  // Fallback: search by content
  const byContent = segments.find(s => s.text?.includes(vocab.term.spanish));
  if (byContent) {
    console.warn(`Vocabulary "${vocab.term.spanish}" found by content match, not index`);
    return byContent;
  }

  // Not found
  console.error(`Vocabulary "${vocab.term.spanish}" not found in any segment`);
  return null;
}
```

### Solution 4: Validation for Vocabulary Consistency

Add vocabulary-specific validation checks:

```typescript
interface VocabularyValidationResult {
  isValid: boolean;
  issues: VocabularyIssue[];
}

interface VocabularyIssue {
  term: string;
  type: 'INDEX_OUT_OF_BOUNDS' | 'TERM_NOT_IN_SEGMENT' | 'TIMING_MISMATCH' | 'STALE_REFERENCE';
  message: string;
  segmentIndex: number;
}

function validateVocabulary(
  vocabulary: VocabularyItem[],
  karaokeData: { spanish: KaraokeData; english: KaraokeData }
): VocabularyValidationResult {
  const issues: VocabularyIssue[] = [];

  for (const item of vocabulary) {
    const segmentIndex = item.segmentIndex - 1;

    // Check bounds
    if (segmentIndex < 0 || segmentIndex >= karaokeData.spanish.segments.length) {
      issues.push({
        term: item.term.spanish,
        type: 'INDEX_OUT_OF_BOUNDS',
        message: `Segment ${item.segmentIndex} does not exist (max: ${karaokeData.spanish.segments.length})`,
        segmentIndex: item.segmentIndex,
      });
      continue;
    }

    const segment = karaokeData.spanish.segments[segmentIndex];

    // Check term exists in segment
    if (!segment.text?.toLowerCase().includes(item.term.spanish.toLowerCase())) {
      issues.push({
        term: item.term.spanish,
        type: 'TERM_NOT_IN_SEGMENT',
        message: `Term "${item.term.spanish}" not found in segment text: "${segment.text}"`,
        segmentIndex: item.segmentIndex,
      });
    }

    // Check timing matches
    if (item.startTimeMs !== segment.startTimeMs || item.endTimeMs !== segment.endTimeMs) {
      issues.push({
        term: item.term.spanish,
        type: 'TIMING_MISMATCH',
        message: `Vocab timing (${item.startTimeMs}-${item.endTimeMs}) differs from segment (${segment.startTimeMs}-${segment.endTimeMs})`,
        segmentIndex: item.segmentIndex,
      });
    }
  }

  return { isValid: issues.length === 0, issues };
}
```

---

## Implementation Priority

| Phase | Component | Effort | Impact | Priority |
|-------|-----------|--------|--------|----------|
| 5C | Segment structure lock (prompt) | Low | High | **P0 - Do First** |
| 4 | Cross-language validation | Medium | High | **P1** |
| 6.4 | Vocabulary validation | Low | Medium | **P1** |
| 6.3 | Robust segment matching | Low | Medium | **P2** |
| 6.2 | Vocabulary re-extraction flag | Low | Medium | **P2** |
| 5B | Algorithmic timing distribution | Medium | Medium | **P2** |
| 6.1 | Word-level vocabulary timecodes | Medium | Medium | **P3** |
| 5A | Audio-informed translation | High | High | **P3 - Evaluate ROI** |

### Quick Wins (< 1 hour each)

1. **Add segment lock instruction to prompts** - Prevents structural drift
2. **Add segment count validation** - Reject mismatched Spanish/English
3. **Add vocabulary validation function** - Surface stale references

### Medium Effort (2-4 hours each)

4. **Implement cross-language comparison** - Full alignment report
5. **Add robust segment matching** - Fallback to content search
6. **Implement algorithmic timing distribution** - Post-process correction

### Higher Effort (Needs ROI evaluation)

7. **Audio-informed translation alignment** - May double API costs
8. **Word-level vocabulary extraction** - Requires prompt + schema changes

---

## Phase 7: Synchronization Quality Improvements

The core challenge is achieving accurate word-level synchronization between lyrics and vocals. Current issues include:

1. **Long API calls** - Full song analysis takes 3-5+ minutes, prone to timeout
2. **Inconsistent quality** - Same inputs can produce different quality scores each run
3. **Full-song refinement bottleneck** - Re-analyzing everything is slow and often times out
4. **Low first-pass accuracy** - Many segments fail validation on initial generation

### Improvement Approaches

#### Option A: Chunked Audio Processing

Split long songs into smaller chunks (60-90 seconds) for parallel processing.

**Implementation:**
```typescript
async function processInChunks(
  audioFile: File,
  lyrics: string,
  chunkDurationMs: number = 90000
): Promise<KaraokeData> {
  // 1. Get audio duration
  const duration = await getAudioDuration(audioFile);

  // 2. Split lyrics by estimated timing (or section markers)
  const chunks = splitLyricsIntoChunks(lyrics, duration, chunkDurationMs);

  // 3. Extract audio segments using Web Audio API
  const audioChunks = await extractAudioChunks(audioFile, chunks);

  // 4. Process each chunk in parallel (or series to avoid rate limits)
  const chunkResults = await Promise.all(
    audioChunks.map((chunk, i) =>
      generateChunkKaraokeData(chunk.audio, chunk.lyrics, i)
    )
  );

  // 5. Merge results, handling overlaps at boundaries
  return mergeChunkResults(chunkResults);
}
```

**Pros:**
- Faster per-request (30-60s vs 3-5min)
- Less likely to timeout
- Can parallelize for speed
- Smaller context = potentially more accurate

**Cons:**
- Complex boundary handling (songs don't have clean breaks)
- Need audio extraction (Web Audio API complexity)
- More total API calls = higher cost
- Risk of timing drift between chunks

**Effort:** High
**Impact:** High (if boundary handling works well)

---

#### Option B: Two-Stage Timing Generation

Separate segment-level timing from word-level timing.

**Stage 1: Segment Structure (Fast)**
```typescript
const segmentPrompt = `
Analyze this audio and identify all vocal sections and instrumental breaks.
Output ONLY segment-level timing (no word timing yet):
- Segment start/end times
- Type: LYRIC or INSTRUMENTAL
- The text content for each segment

Do NOT output word-level timing in this pass.
`;
```

**Stage 2: Word Timing per Segment (Parallel)**
```typescript
async function addWordTiming(
  audioFile: File,
  segment: KaraokeSegment
): Promise<KaraokeSegment> {
  const prompt = `
    Listen to the audio between ${segment.startTimeMs}ms and ${segment.endTimeMs}ms.
    The lyrics for this section are: "${segment.text}"

    Output word-level timing for each word in this segment.
  `;
  // Process just this segment
}

// Process all segments in parallel
const withWordTiming = await Promise.all(
  segments.map(seg => seg.type === 'LYRIC' ? addWordTiming(audioFile, seg) : seg)
);
```

**Pros:**
- Segment structure locked early (prevents structural drift)
- Word timing focused on small windows
- Parallel processing possible
- Easier to retry individual segments

**Cons:**
- More API calls (1 + N where N = lyric segment count)
- May still timeout on very long segments
- Requires passing audio with time range context

**Effort:** Medium-High
**Impact:** High

---

#### Option C: Model Strategy (Flash Draft, Pro Polish)

Use faster/cheaper model for initial pass, expensive model only for targeted fixes.

**Implementation:**
```typescript
// Stage 1: Fast draft with Flash
const draftData = await generateKaraokeData(
  audioFile, lyrics, languageFlow, onStatus,
  'gemini-flash' // Use Flash for speed
);

// Stage 2: Validate
const validation = validateKaraokeData(draftData);
const problemSegments = extractProblemSegmentIndices(validation);

// Stage 3: Targeted refinement with Pro (only problem areas)
if (problemSegments.length > 0) {
  const refinedData = await refineMarkedSegments(
    audioFile, draftData, problemSegments, langName, onStatus,
    undefined, 'gemini-pro' // Use Pro for accuracy
  );
}
```

**Pros:**
- Faster first results
- Cheaper (Flash is ~10x cheaper than Pro)
- Pro capacity reserved for difficult sections

**Cons:**
- Flash quality may be lower baseline
- Still requires refinement for many segments
- Two models = more complexity

**Effort:** Low (already have model selection)
**Impact:** Medium

---

#### Option D: Automated Validation-Guided Refinement

Automatically identify and refine segments that fail validation checks.

**Implementation:**
```typescript
function extractProblemSegmentIndices(
  validation: ValidationReport
): number[] {
  const problemIndices = new Set<number>();

  // Collect all segments with issues
  for (const issue of [...validation.errors, ...validation.warnings]) {
    if (issue.segmentIndex !== undefined) {
      problemIndices.add(issue.segmentIndex);
    }
  }

  return Array.from(problemIndices).sort((a, b) => a - b);
}

async function autoRefineProblems(
  audioFile: File,
  karaokeData: KaraokeApiResponse,
  validation: ValidationReport,
  maxIterations: number = 3
): Promise<KaraokeApiResponse> {
  let currentData = karaokeData;
  let currentValidation = validation;

  for (let i = 0; i < maxIterations; i++) {
    const problemIndices = extractProblemSegmentIndices(currentValidation);

    if (problemIndices.length === 0) {
      break; // All issues resolved
    }

    // Refine problem segments
    currentData = await refineMarkedSegments(
      audioFile, currentData, problemIndices, ...
    );

    // Re-validate
    currentValidation = validateKaraokeDataPair(
      currentData.spanish, currentData.english
    );

    // Check if score improved
    if (currentValidation.overallScore >= 90) {
      break; // Good enough
    }
  }

  return currentData;
}
```

**UI Addition:**
- "Auto-Fix Issues" button appears when validation score < threshold
- Shows progress: "Fixing 12 problem segments... (iteration 1/3)"
- Displays before/after quality scores

**Pros:**
- Leverages existing validation + refinement code
- No manual segment marking required
- Iterative improvement until quality threshold met
- Can limit iterations to control cost/time

**Cons:**
- Still processes full audio per refinement call
- May timeout if many segments need fixing
- Validation may not catch all sync issues

**Effort:** Low-Medium
**Impact:** Medium-High

---

#### Option E: Audio-First Transcription

Let AI transcribe what it hears first, then align provided lyrics.

**Stage 1: Transcribe with Timestamps**
```typescript
const transcriptionPrompt = `
Listen to this audio file and transcribe ALL sung vocals with precise timestamps.
Do not reference any provided lyrics - transcribe only what you hear.

Output format:
{
  "transcription": [
    { "text": "heard word", "startTimeMs": 1000, "endTimeMs": 1200 },
    ...
  ]
}
`;
```

**Stage 2: Align Provided Lyrics to Transcription**
```typescript
const alignmentPrompt = `
You have:
1. A transcription of what was sung (with timestamps)
2. The official lyrics

Match the official lyrics to the transcription timestamps.
Handle cases where:
- Singer adds ad-libs not in lyrics
- Singer skips or changes words
- Pronunciation differs from spelling
`;
```

**Pros:**
- Timing based on actual audio, not forced text alignment
- Better handling of ad-libs and variations
- Two smaller, focused tasks vs one complex task

**Cons:**
- Transcription may have errors
- Alignment is a second complex task
- May not match provided lyrics exactly
- Higher total API usage

**Effort:** High
**Impact:** Potentially Very High (if alignment works well)

---

#### Option F: Progressive Refinement with Smaller Context

Instead of sending full song context for refinement, send only the problem segment + minimal context.

**Current approach:**
- Sends full song JSON + audio for refinement
- AI must process everything to fix one segment

**Proposed approach:**
```typescript
async function refineSegmentMinimal(
  audioFile: File,
  segment: KaraokeSegment,
  prevSegment: KaraokeSegment | null,
  nextSegment: KaraokeSegment | null
): Promise<KaraokeSegment> {
  // Extract just the relevant audio portion
  const audioSlice = await extractAudioRange(
    audioFile,
    (prevSegment?.startTimeMs ?? segment.startTimeMs) - 2000,
    (nextSegment?.endTimeMs ?? segment.endTimeMs) + 2000
  );

  const prompt = `
    Focus on this segment: "${segment.text}"
    Expected timing: ${segment.startTimeMs} - ${segment.endTimeMs}

    Previous segment ends at: ${prevSegment?.endTimeMs ?? 'N/A'}
    Next segment starts at: ${nextSegment?.startTimeMs ?? 'N/A'}

    Re-analyze word timing for this segment only.
  `;

  // Much smaller request = faster, less likely to timeout
}
```

**Pros:**
- Much faster per-segment (seconds vs minutes)
- Less likely to timeout
- Can parallelize segment refinement
- Focused context = potentially more accurate

**Cons:**
- Requires audio slicing (Web Audio API complexity)
- Many API calls for many problem segments
- Need to maintain segment boundary consistency

**Effort:** Medium-High
**Impact:** High

---

### Impact vs Effort Matrix

```
                    Low Effort    Medium Effort    High Effort
                    ──────────────────────────────────────────
High Impact    │      D              B              A, E
               │   (Auto-fix)    (Two-stage)    (Chunked, Transcribe)
               │
Medium Impact  │      C              F
               │   (Flash/Pro)   (Minimal context)
               │
Low Impact     │
               │
```

### Recommended Implementation Order

| Priority | Option | Status | Rationale |
|----------|--------|--------|-----------|
| **P0** | D: Auto Validation-Guided Refinement | ✅ **Implemented** | Low effort, uses existing code, immediate value |
| **P1** | C: Flash Draft + Pro Polish | 📋 Planned | Low effort, reduces cost and time for first pass |
| **P2** | B: Two-Stage Timing | 📋 Planned | Medium effort, fundamentally better architecture |
| **P3** | F: Minimal Context Refinement | 📋 Planned | Requires audio slicing but significant speed gain |
| **P4** | A: Chunked Processing | 📋 Planned | High effort but solves timeout issues for long songs |
| **P5** | E: Audio-First Transcription | 📋 Planned | Experimental, high effort, but could be breakthrough |

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| First-pass quality score | 60-75 | 80+ |
| Refinement timeout rate | ~30% | <5% |
| Time to usable output | 8-12 min | <5 min |
| Segments needing manual fix | 20-40% | <10% |

---

## Related Documents

- `docs/tech-spec-security-and-deployment.md` - Deployment automation
- `Claude.md` - Project overview
- `types.ts` - Existing type definitions
