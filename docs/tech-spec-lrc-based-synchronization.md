# Technical Spec: LRC-Based Karaoke Synchronization

**Status:** Complete
**Created:** 2026-01-08
**Updated:** 2026-01-09
**Priority:** High
**Branch:** `feature/lrc-based-sync`

---

## Problem Statement

The current approach of sending raw lyrics + audio to Gemini for full-song synchronization has significant accuracy issues:

1. **Cumulative drift** - Timing errors compound across the song
2. **Inconsistent quality** - Same inputs produce varying quality scores
3. **Long processing times** - Full song analysis takes 3-5+ minutes, prone to timeout
4. **No anchor points** - AI must guess structure from scratch each time

---

## Implementation Summary

### What Was Built

1. **LRC Parser** (`services/lrcParser.ts`)
   - `parseLrc(content)` - Parses LRC format into structured data with line-level timestamps
   - `isLrcFormat(text)` - Auto-detects if pasted text is LRC format
   - `extractLyricsText(parsedLrc)` - Extracts plain lyrics for translation
   - `formatTimestamp(ms)` - Formats milliseconds for display
   - Handles metadata tags (`[ti:Title]`, `[ar:Artist]`, etc.)
   - Calculates end times from next line's start (last line gets +3000ms)

2. **New Types** (`types.ts`)
   - `LrcLine` - Single parsed line with startTimeMs, endTimeMs, text, wordCount
   - `LrcMetadata` - Optional title, artist, album, length
   - `ParsedLrc` - Collection of lines and metadata

3. **LRC-Based Generation** (`services/geminiService.ts`)
   - `buildLrcBasedPrompt(parsedLrc, langName)` - Creates prompt with LRC segments as anchors
   - `generateKaraokeFromLrc(audioFile, lrcContent, langName, onStatusUpdate, modelTier)` - Generates word-level timing using LRC anchors
   - `generateBilingualKaraokeFromLrc(audioFile, lrcContent, onStatusUpdate, modelTier)` - Full bilingual workflow: parse LRC → translate → generate Spanish timing → align English

4. **UI Integration** (`App.tsx`)
   - Simplified single-input workflow: Only LRC content input (no English textarea)
   - Upload button: "Upload .LRC" for easy file selection
   - Auto-detection: Shows "LRC detected" badge when valid LRC format is pasted
   - LRC info display: Shows line count and metadata when LRC is detected
   - Translations are always auto-generated (no manual input needed)

5. **Partial Output Refinement** (`services/geminiService.ts`)
   - Refactored auto-correction to return only refined segments instead of full song data
   - `calculateFocusArea()` - Identifies marked segments + context window
   - `mergeRefinedSegments()` - Merges refined segments back with boundary adjustments
   - Prevents JSON truncation issues with long songs (70+ segments)

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LRC Input | Upload button + auto-detect in textarea | Simple UX, supports both paste and file upload |
| Timestamp approach | Hybrid: LRC as primary guide + instrumental detection | Fast (uses LRC timing) while detecting missing sections |
| Timestamp flexibility | ±1000ms adjustment allowed | LRC timestamps may be slightly off |
| Instrumentals | Explicit detection from audio | Detects intros, interludes, outros not in LRC |
| Processing | Single API call | Full song context, simpler implementation |
| Translation | Gemini Flash | Fast, cost-effective for text translation |
| Default model | Gemini 3 Pro | Better accuracy than 2.5, fast enough for production |
| UI | Simplified single-input | Removed English textarea, translations auto-generated |

### Results

- **Accuracy**: Significantly improved word-level timing accuracy
- **Speed**: Fast generation using LRC timestamps as primary guide
- **Gemini 3 Pro**: Produces high-quality results without needing auto-correction
- **Instrumental detection**: Properly adds intro/interlude/outro segments
- **User experience**: Simplified workflow with single LRC input

---

## Proposed Solution

Use LRC (LyRiCs) files as a **foundation and anchor**. LRC files contain **line-level timestamps** that are typically accurate because they're:
- Manually created by fans/communities
- Sourced from music services (Spotify, Apple Music)
- Widely available for popular songs

The AI's task becomes much simpler: **use LRC timing as a strong guide** for segment boundaries rather than figuring out the entire song structure from scratch.

### Important: LRC as Anchor, Not Rigid Constraint

LRC files are not always perfect. Common issues include:
- **Timing drift** - LRC timestamps may be slightly off (±500ms)
- **Lyric variations** - Singer may ad-lib, skip words, or change phrasing
- **Missing/extra content** - LRC may not capture all vocal moments

**Our approach:** Use LRC timestamps as **anchor points** that provide structure, but allow the AI some flexibility to:
1. Adjust segment boundaries slightly (±500ms) if the audio clearly indicates different timing
2. Note discrepancies between LRC text and actual vocals
3. Handle ad-libs or variations within the segment

This gives us the **best of both worlds**: structured guidance from LRC to prevent major drift, while still respecting the audio as ground truth for fine-tuning.

---

## LRC Format Overview

### Standard LRC Format

```
[mm:ss.xx] Lyrics line text here
```

### Example (Tití Me Preguntó - Bad Bunny)

```
[00:10.14] Ey, Tití me preguntó si tengo mucha' novia'
[00:14.69] Mucha' novia'
[00:15.89] Hoy tengo a una, mañana otra, ey
[00:19.13] Pero no hay boda
[00:20.00] Tití me preguntó si tengo mucha' novia'
[00:24.16] Mucha' novia'
[00:25.09] Hoy tengo a una, mañana otra
[00:28.37] Me las vo'a llevar a to'a, pa un VIP, un VIP
...
```

### Key Observations

| Line | Start Time | End Time (next line) | Duration | Word Count |
|------|-----------|---------------------|----------|------------|
| 1 | 10140ms | 14690ms | 4550ms | 8 words |
| 2 | 14690ms | 15890ms | 1200ms | 2 words |
| 3 | 15890ms | 19130ms | 3240ms | 7 words |
| 4 | 19130ms | 20000ms | 870ms | 4 words |

**Insight:** Each line has a well-defined time window. Word timing becomes a bounded distribution problem, not a full audio analysis problem.

---

## Architecture Comparison

### Current Approach

```
┌─────────────────────────────────────────────────────────┐
│ INPUT: Audio (4 min) + Raw Lyrics (60 lines)            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ GEMINI: Analyze entire audio, find all timing           │
│ - Figure out song structure                             │
│ - Identify vocal sections vs instrumentals              │
│ - Match each word to audio                              │
│ - Handle ad-libs, variations, corrections               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ OUTPUT: Full karaoke JSON (often with drift/errors)     │
└─────────────────────────────────────────────────────────┘
```

**Problems:**
- Too much for AI to do in one pass
- No guardrails on timing
- Errors propagate through entire song

### LRC-Based Approach

```
┌─────────────────────────────────────────────────────────┐
│ INPUT: Audio (4 min) + LRC File (line-level timing)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ PARSE LRC: Extract segments with fixed boundaries       │
│ - Line 1: 10140ms - 14690ms, "Ey, Tití me preguntó..."  │
│ - Line 2: 14690ms - 15890ms, "Mucha' novia'"            │
│ - Line 3: 15890ms - 19130ms, "Hoy tengo a una..."       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ GEMINI: Add word timing within each segment             │
│ - Segment boundaries are LOCKED                         │
│ - Only distribute words within each window              │
│ - Much simpler, more constrained task                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ OUTPUT: Full karaoke JSON with accurate word timing     │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- Line boundaries locked (no drift between lines)
- Constrained problem = more accurate results
- Can validate each segment independently
- Easier to identify and fix specific problem segments

---

## Implementation Plan

### Phase 1: LRC Parser

Create a utility to parse LRC files into segment data:

```typescript
interface LrcLine {
  startTimeMs: number;
  endTimeMs: number;    // Derived from next line's start time
  text: string;
  wordCount: number;
}

interface ParsedLrc {
  lines: LrcLine[];
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
  };
}

function parseLrc(lrcContent: string): ParsedLrc {
  // Parse [mm:ss.xx] format
  // Calculate end times from next line's start
  // Handle edge cases (last line, empty lines, metadata tags)
}
```

**LRC Parsing Rules:**
1. Timestamp format: `[mm:ss.xx]` where xx is centiseconds (1/100th second)
2. Convert to milliseconds: `mm * 60000 + ss * 1000 + xx * 10`
3. End time = next line's start time (or +3000ms for last line)
4. Skip empty lines and metadata tags like `[ti:Title]`, `[ar:Artist]`

### Phase 2: New Gemini Prompt

The key change is the prompt strategy. Instead of asking Gemini to analyze the full audio and determine timing, we provide the segment boundaries and ask only for word-level timing within each segment.

**New Prompt Structure:**

```
You are a precise audio-to-lyrics alignment specialist.

You will receive:
1. An audio file
2. A list of lyric segments with APPROXIMATE start and end times from an LRC file

Your task is to:
1. Use the LRC timestamps as ANCHOR POINTS (strong guidance, not rigid)
2. Listen to the audio to verify and fine-tune timing
3. Add word-level timing within each segment

RULES:
1. LRC timestamps are approximate anchors - you may adjust segment boundaries by up to ±500ms if the audio clearly indicates different timing
2. The AUDIO is the ground truth - if the singer starts a line slightly earlier or later than the LRC indicates, adjust accordingly
3. Distribute word timing based on what you HEAR in the audio
4. If the LRC text differs slightly from what's sung (ad-libs, variations), prioritize what's actually sung
5. Words should not overlap within a segment
6. Maintain the overall structure from the LRC (same number of segments, same general order)

INPUT SEGMENTS (from LRC - use as anchors):
[
  {
    "segmentIndex": 1,
    "startTimeMs": 10140,
    "endTimeMs": 14690,
    "text": "Ey, Tití me preguntó si tengo mucha' novia'"
  },
  {
    "segmentIndex": 2,
    "startTimeMs": 14690,
    "endTimeMs": 15890,
    "text": "Mucha' novia'"
  },
  ...
]

OUTPUT FORMAT:
Return the same segments with a "words" array added to each:
[
  {
    "segmentIndex": 1,
    "startTimeMs": 10140,
    "endTimeMs": 14690,
    "text": "Ey, Tití me preguntó si tengo mucha' novia'",
    "words": [
      { "word": "Ey,", "startTimeMs": 10140, "endTimeMs": 10400 },
      { "word": "Tití", "startTimeMs": 10400, "endTimeMs": 10850 },
      ...
    ]
  },
  ...
]
```

### Phase 3: Service Function

```typescript
async function generateKaraokeFromLrc(
  audioFile: File,
  lrcContent: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5'
): Promise<KaraokeData> {

  // 1. Parse LRC to get segments with fixed boundaries
  const parsedLrc = parseLrc(lrcContent);

  // 2. Build prompt with pre-defined segments
  const prompt = buildLrcBasedPrompt(parsedLrc);

  // 3. Call Gemini to add word timing within each segment
  const response = await callGeminiWithAudio(audioFile, prompt, modelTier);

  // 4. Validate that segment boundaries weren't changed
  validateSegmentBoundaries(parsedLrc, response);

  // 5. Return complete karaoke data
  return formatAsKaraokeData(response, parsedLrc.metadata);
}
```

### Phase 4: UI Changes

Update the input form to accept LRC files:

1. **Option A: File Upload**
   - Add file input that accepts `.lrc` files
   - Parse and display preview of detected lines

2. **Option B: Text Area**
   - Allow pasting LRC content directly
   - Auto-detect LRC format (has `[mm:ss.xx]` timestamps)

3. **Workflow Toggle**
   - "Standard Mode" - current raw lyrics approach
   - "LRC Mode" - new LRC-based approach (recommended)

### Phase 5: Translation Alignment

Once Spanish word timing is established from LRC:

1. Translate each line's text (keep segment boundaries)
2. Map English words to same segment timing
3. Distribute English words proportionally within each segment

This is the same translation alignment we do now, but with locked segment boundaries.

---

## Validation Strategy

### Per-Segment Validation

For each segment, verify:
- [ ] First word starts within reasonable range of segment.startTimeMs (±500ms)
- [ ] Last word ends within reasonable range of segment.endTimeMs (±500ms)
- [ ] No word overlaps within segment
- [ ] No zero-duration words
- [ ] Word timing is sequential (each word starts after previous ends)

### Cross-Segment Validation

- [ ] Segment boundaries are close to original LRC (within ±500ms tolerance)
- [ ] No significant gaps or overlaps between segments
- [ ] Total segment count matches LRC (unless AI notes missing/extra content)
- [ ] Overall song structure preserved

### Quality Metrics

| Metric | Target |
|--------|--------|
| Segments with valid word timing | 100% |
| Words within segment bounds | 100% |
| Average word duration | 100-800ms |
| Zero-duration words | 0 |

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/lrc-based-sync
```

### 2. Implementation Order

1. **LRC Parser** (`services/lrcParser.ts`)
   - Parse LRC format
   - Calculate segment end times
   - Handle metadata tags
   - Unit tests with example LRC

2. **New Prompt Builder** (`services/geminiService.ts`)
   - `buildLrcBasedPrompt()` function
   - Test prompt with sample segments

3. **New Generation Function** (`services/geminiService.ts`)
   - `generateKaraokeFromLrc()` function
   - Integrate parser + prompt + API call

4. **UI Updates** (`App.tsx`)
   - LRC file/text input option
   - Mode toggle (Standard vs LRC)
   - Preview parsed segments

5. **Testing**
   - Test with "Tití Me Preguntó" LRC
   - Compare quality vs standard approach
   - Test edge cases (short lines, long lines, ad-libs)

### 3. Testing Checklist

- [ ] LRC parser handles example file correctly
- [ ] All 60+ lines parsed with correct timestamps
- [ ] Word timing stays within segment bounds
- [ ] Spanish karaoke data validates at 90+ score
- [ ] English translation aligns to same segments
- [ ] End-to-end preview works in UI

### 4. PR Criteria

Before merging to main:
- [ ] All tests pass
- [ ] Quality score consistently >= 85 for test song
- [ ] No regressions to existing functionality
- [ ] Documentation updated
- [ ] Code reviewed

---

## Rollback Plan

The LRC-based approach is additive - it doesn't remove the existing raw lyrics approach. If issues arise:

1. Keep both modes available in UI
2. Default to standard mode if LRC parsing fails
3. Can disable LRC mode via feature flag if needed

---

## Example: Expected Output

### Input (LRC line)
```
[00:10.14] Ey, Tití me preguntó si tengo mucha' novia'
[00:14.69] Mucha' novia'
```

### Expected Output (Karaoke segment)
```json
{
  "segmentIndex": 1,
  "type": "LYRIC",
  "startTimeMs": 10140,
  "endTimeMs": 14690,
  "text": "Ey, Tití me preguntó si tengo mucha' novia'",
  "words": [
    { "word": "Ey,", "startTimeMs": 10140, "endTimeMs": 10450 },
    { "word": "Tití", "startTimeMs": 10450, "endTimeMs": 10900 },
    { "word": "me", "startTimeMs": 10900, "endTimeMs": 11100 },
    { "word": "preguntó", "startTimeMs": 11100, "endTimeMs": 11700 },
    { "word": "si", "startTimeMs": 11700, "endTimeMs": 11900 },
    { "word": "tengo", "startTimeMs": 11900, "endTimeMs": 12300 },
    { "word": "mucha'", "startTimeMs": 12300, "endTimeMs": 13100 },
    { "word": "novia'", "startTimeMs": 13100, "endTimeMs": 14690 }
  ]
}
```

**Key guarantees:**
- First word starts at 10140ms (segment start)
- Last word ends at 14690ms (segment end)
- All words within bounds
- No overlaps

---

## Open Questions (Resolved)

1. **Instrumental sections** - LRC files don't mark instrumentals. Should we auto-detect gaps > N seconds as instrumental?
   - **Resolution:** Yes, gaps > 5 seconds are auto-detected as potential instrumentals. The Gemini prompt also instructs the AI to identify instrumental sections.

2. **LRC accuracy** - What if the LRC itself has timing errors? Should we offer a "verify LRC timing" step?
   - **Resolution:** Allow ±500ms flexibility in segment boundaries. The audio is treated as ground truth, and the AI can adjust timing within this tolerance.

3. **Batch processing** - Should we process segments in batches (e.g., 10 at a time) to reduce per-request size?
   - **Resolution:** Single API call for initial generation (full song context is valuable). Batch processing is a future optimization if needed.

4. **LRC sources** - Should we integrate with LRC databases/APIs, or rely on user-provided files only?
   - **Resolution:** User-provided only for now. Users can paste LRC content directly into the lyrics textarea.

---

## Success Criteria

| Criteria | Target |
|----------|--------|
| Word timing accuracy (subjective) | Noticeably better than current |
| Validation score | >= 90 consistently |
| Processing time | Similar or faster |
| Line boundary accuracy | 100% (locked from LRC) |
| User satisfaction | Prefer LRC mode when available |

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `services/lrcParser.ts` | **New** - LRC parsing utility |
| `services/geminiService.ts` | Add `generateKaraokeFromLrc()`, new prompts |
| `App.tsx` | Add LRC input UI, mode toggle |
| `types.ts` | Add `LrcLine`, `ParsedLrc` types |
| `docs/tech-spec-lrc-based-synchronization.md` | This document |

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| LRC Parser | 1-2 hours |
| New Prompts | 2-3 hours |
| Generation Function | 2-3 hours |
| UI Updates | 2-3 hours |
| Testing & Iteration | 3-4 hours |
| **Total** | **10-15 hours** |

---

## References

- [LRC Format Wikipedia](https://en.wikipedia.org/wiki/LRC_(file_format))
- Current karaoke generation: `services/geminiService.ts:generateKaraokeData()`
- Current validation: `services/validationService.ts`
