import { Type } from "@google/genai";
import { KaraokeApiResponse, KaraokeData, VocabularyItem, ParsedLrc } from '../types';
import {
  validateKaraokeDataPair,
  extractProblemSegmentIndices,
  ValidationReport,
} from './validationService';
import { parseLrc, extractLyricsText } from './lrcParser';

// Model tier type - exported for use in App.tsx
export type GeminiModelTier = 'gemini-2.5' | 'gemini-3-preview';

// Get model names based on selected tier
const getModelNames = (tier: GeminiModelTier) => {
  if (tier === 'gemini-3-preview') {
    return {
      pro: 'gemini-3-pro-preview',
      flash: 'gemini-3-flash-preview',
    };
  }
  // Default to stable 2.5 models (no preview suffix for stable versions)
  return {
    pro: 'gemini-2.5-pro',
    flash: 'gemini-2.5-flash',
  };
};

// Response type from our proxy endpoint
interface GeminiProxyResponse {
  text: string;
  candidates?: unknown[];
  error?: string;
}

// Helper to call the Gemini API via our server proxy
const callGeminiProxy = async (
  model: string,
  contents: unknown,
  config?: unknown
): Promise<GeminiProxyResponse> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, contents, config }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `Proxy request failed with status ${response.status}`);
  }

  return data;
};

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        resolve((reader.result as string).split(',')[1]);
      } else {
        reject(new Error("File reading failed"));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 1000,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> => {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on our custom, non-recoverable errors.
      if (error instanceof Error && (
          error.message.includes("timed out") || 
          error.message.includes("JSON format") ||
          error.message.includes("empty response") ||
          error.message.includes("API key") || // Don't retry on auth errors
          error.message.includes("safety filter") // Don't retry on content blocks
      )) {
        throw error;
      }

      if (attempt < retries) {
        if (onRetry) {
          onRetry(attempt, error as Error);
        }
        // Exponential backoff with jitter
        const delay = initialDelay * 2 ** (attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

// FIX: Export 'singleLanguageSchema' for use in other modules.
export const singleLanguageSchema = {
    type: Type.OBJECT,
    properties: {
        metadata: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                artist: { type: Type.STRING },
                durationMs: { type: Type.INTEGER },
                language: { type: Type.STRING },
                version: { type: Type.STRING }
            },
            required: ["title", "artist", "durationMs", "language", "version"]
        },
        segments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING },
                    startTimeMs: { type: Type.INTEGER },
                    endTimeMs: { type: Type.INTEGER },
                    cueText: { type: Type.STRING },
                    text: { type: Type.STRING },
                    segmentIndex: { type: Type.INTEGER },
                    words: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                word: { type: Type.STRING },
                                startTimeMs: { type: Type.INTEGER },
                                endTimeMs: { type: Type.INTEGER }
                            },
                            required: ["word", "startTimeMs", "endTimeMs"]
                        }
                    }
                },
                required: ["type", "startTimeMs", "endTimeMs", "segmentIndex"]
            }
        }
    },
    required: ["metadata", "segments"]
};

// Schema for partial refinement output (only refined segments)
const partialRefinementSchema = {
    type: Type.OBJECT,
    properties: {
        refinedSegments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    originalIndex: { type: Type.INTEGER },
                    type: { type: Type.STRING },
                    startTimeMs: { type: Type.INTEGER },
                    endTimeMs: { type: Type.INTEGER },
                    cueText: { type: Type.STRING },
                    text: { type: Type.STRING },
                    segmentIndex: { type: Type.INTEGER },
                    words: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                word: { type: Type.STRING },
                                startTimeMs: { type: Type.INTEGER },
                                endTimeMs: { type: Type.INTEGER }
                            },
                            required: ["word", "startTimeMs", "endTimeMs"]
                        }
                    }
                },
                required: ["originalIndex", "type", "startTimeMs", "endTimeMs", "segmentIndex"]
            }
        }
    },
    required: ["refinedSegments"]
};

// Schema for LRC timestamp correction output
const lrcCorrectionSchema = {
    type: Type.OBJECT,
    properties: {
        correctedLines: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    lineIndex: { type: Type.INTEGER },
                    originalStartMs: { type: Type.INTEGER },
                    correctedStartMs: { type: Type.INTEGER },
                    text: { type: Type.STRING },
                },
                required: ["lineIndex", "originalStartMs", "correctedStartMs", "text"]
            }
        },
        detectedSections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING },  // "intro", "interlude", "skit", "outro"
                    startTimeMs: { type: Type.INTEGER },
                    endTimeMs: { type: Type.INTEGER },
                    description: { type: Type.STRING },
                    insertAfterLineIndex: { type: Type.INTEGER },  // -1 for intro
                },
                required: ["type", "startTimeMs", "endTimeMs", "insertAfterLineIndex"]
            }
        }
    },
    required: ["correctedLines"]
};

// Type for LRC correction response
interface LrcCorrectionResponse {
    correctedLines: Array<{
        lineIndex: number;
        originalStartMs: number;
        correctedStartMs: number;
        text: string;
    }>;
    detectedSections?: Array<{
        type: 'intro' | 'interlude' | 'skit' | 'outro';
        startTimeMs: number;
        endTimeMs: number;
        description?: string;
        insertAfterLineIndex: number;
    }>;
}

// Type for refined segment with originalIndex
interface RefinedSegment {
    originalIndex: number;
    type: 'LYRIC' | 'INSTRUMENTAL';
    startTimeMs: number;
    endTimeMs: number;
    segmentIndex: number;
    text?: string;
    cueText?: string;
    words?: Array<{ word: string; startTimeMs: number; endTimeMs: number }>;
}

// Merge refined segments back into the original karaoke data
const mergeRefinedSegments = (
    originalData: KaraokeData,
    refinedSegments: RefinedSegment[],
    markedIndices: number[]
): KaraokeData => {
    // Create a copy of the segments array
    const mergedSegments = [...originalData.segments];
    const { focusIndices } = calculateFocusArea(markedIndices, mergedSegments.length);

    // Replace segments in the focus area with refined versions
    for (const refined of refinedSegments) {
        const idx = refined.originalIndex;
        if (idx >= 0 && idx < mergedSegments.length) {
            // Remove originalIndex before storing (it's not part of KaraokeSegment)
            const { originalIndex, ...segmentData } = refined;
            mergedSegments[idx] = segmentData as typeof mergedSegments[0];
        }
    }

    // Adjust boundaries with adjacent segments outside focus area
    const minFocusIdx = Math.min(...focusIndices);
    const maxFocusIdx = Math.max(...focusIndices);

    // Adjust segment before focus area if needed
    if (minFocusIdx > 0) {
        const prevSegment = mergedSegments[minFocusIdx - 1];
        const firstFocusSegment = mergedSegments[minFocusIdx];
        // If previous segment overlaps with first focus segment, adjust its end
        if (prevSegment.endTimeMs > firstFocusSegment.startTimeMs) {
            mergedSegments[minFocusIdx - 1] = {
                ...prevSegment,
                endTimeMs: firstFocusSegment.startTimeMs,
            };
        }
    }

    // Adjust segment after focus area if needed
    if (maxFocusIdx < mergedSegments.length - 1) {
        const nextSegment = mergedSegments[maxFocusIdx + 1];
        const lastFocusSegment = mergedSegments[maxFocusIdx];
        // If last focus segment overlaps with next segment, adjust next's start
        if (lastFocusSegment.endTimeMs > nextSegment.startTimeMs) {
            mergedSegments[maxFocusIdx + 1] = {
                ...nextSegment,
                startTimeMs: lastFocusSegment.endTimeMs,
            };
        }
    }

    return {
        ...originalData,
        segments: mergedSegments,
    };
};


const buildSingleLanguagePrompt = (lyrics: string, langName: string): string => {
  return `
You are a professional Audio Alignment Engine. Your task is to generate a single, highly accurate, synchronized karaoke lyric data file based on an audio file and provided lyrics.

**Input Data:**
- Audio File: [Provided in the request]
- Raw ${langName} Lyrics:
  ---
  ${lyrics}
  ---

**Critical Task Instructions:**

1.  **Analyze Audio:** Deeply analyze the provided audio to identify vocal melodies, rhythms, and pauses.
2.  **Precise Alignment:** Align the provided ${langName} lyrics to the vocal track with millisecond precision. Every word must have an accurate \`startTimeMs\` and \`endTimeMs\`.
3.  **Lyric Alignment and Correction:**
    -   **Audio is the Ground Truth:** The provided audio file is the definitive source of truth for the lyrics. The text lyrics provided are a very close guide but may not be a perfect 100% transcript.
    -   **Prioritize Sung Vocals:** Your primary task is to accurately transcribe and time the words that are *actually sung* in the audio.
    -   **Correct Discrepancies:** If you hear a difference between the audio and the provided text (e.g., an ad-lib, a repeated word, a slightly different phrasing), your final JSON output **MUST** reflect what is sung in the audio. This is the most critical instruction. For example, if the lyrics say "love you" but the singer sings "love you, you", your output for that segment must include the repeated "you" with its correct timing.
    -   **Maintain Structure:** While making corrections, preserve the overall line and segment structure of the provided lyrics as much as possible.
4.  **Segment the Song:** Segment the entire song into a \`segments\` array.
    - Identify every portion as either "LYRIC" or "INSTRUMENTAL".
    - For "LYRIC" segments: Include word-level timing for every single word.
    - For "INSTRUMENTAL" segments: Create instrumental breaks (e.g., intro, solo) and provide a descriptive \`cueText\` in ${langName}.
5.  **Extract Metadata:** Determine the song's title and artist from the audio if possible, and calculate the total duration in milliseconds.

**Critical Precision Guidelines:**

-   **Fast Vocals:** Pay extreme attention to fast-paced vocal sections. Word timings in these areas must be very short and precise.
-   **Sustained Notes:** If a singer holds a note on a word for a long duration, the \`endTimeMs\` must reflect the entire duration of that sustained sound.
-   **Vocal Decay:** The \`endTimeMs\` for a word should be the point where the sound of that word is no longer audible, not when the next word begins. Account for natural vocal decay.

**Example of a Perfect Segment:**

For a lyric line "Y pienso en ti, solo en ti" that is sung between 45000ms and 49000ms, the output for that segment should look like this:
\`\`\`json
{
  "type": "LYRIC",
  "startTimeMs": 45000,
  "endTimeMs": 49000,
  "text": "Y pienso en ti, solo en ti",
  "segmentIndex": 4,
  "words": [
    { "word": "Y", "startTimeMs": 45150, "endTimeMs": 45300 },
    { "word": "pienso", "startTimeMs": 45310, "endTimeMs": 45800 },
    { "word": "en", "startTimeMs": 45810, "endTimeMs": 46000 },
    { "word": "ti,", "startTimeMs": 46010, "endTimeMs": 46500 },
    { "word": "solo", "startTimeMs": 46800, "endTimeMs": 47300 },
    { "word": "en", "startTimeMs": 47310, "endTimeMs": 47500 },
    { "word": "ti", "startTimeMs": 47510, "endTimeMs": 48200 }
  ]
}
\`\`\`

**Output Format:**
You MUST return a single, minified JSON object that strictly follows the provided schema. Do not include any other text, explanations, or markdown formatting.
`;
};

// FIX: Export 'buildTranslationAlignmentPrompt' for use in other modules.
export const buildTranslationAlignmentPrompt = (timedOriginalData: KaraokeData, translatedLyrics: string, originalLangName: string, translatedLangName: string): string => {
  const segmentCount = timedOriginalData.segments.length;

  return `
You are a precise text-transformation engine. Your task is to create a translated karaoke data file by mapping translated lyrics onto an existing, perfectly timed data structure.

**CRITICAL STRUCTURAL CONSTRAINTS (MUST FOLLOW):**
1. You MUST output EXACTLY ${segmentCount} segments - no more, no less
2. Each segment MUST have segmentIndex values 1 through ${segmentCount} in order
3. Segment-level startTimeMs and endTimeMs MUST match the input EXACTLY (copy them verbatim)
4. Segment type (LYRIC/INSTRUMENTAL) MUST match the input EXACTLY
5. You may ONLY modify: text, cueText, words array, and metadata.language
6. Do NOT merge, split, add, or remove segments under any circumstances

**Input Data:**

1.  **Original Timed Data (${originalLangName} JSON):**
    \`\`\`json
    ${JSON.stringify(timedOriginalData)}
    \`\`\`

2.  **Raw Translated Lyrics (${translatedLangName} Text):**
    ---
    ${translatedLyrics}
    ---

**Task Instructions:**

1.  **Map Translation:** Go through the "Original Timed Data" segment by segment.
2.  **Substitute Text:** For each segment, replace the ${originalLangName} text fields (\`text\` and \`cueText\`) with their corresponding ${translatedLangName} translations from the "Raw Translated Lyrics".
3.  **Preserve Segment Timings:** Keep all segment-level \`startTimeMs\`, \`endTimeMs\`, \`segmentIndex\`, and \`type\` fields identical to the original data.
4.  **Recalculate Word Timings (Critical):** The number of words will likely differ between languages. For each "LYRIC" segment, you must generate a new \`words\` array for the translated text. The new word timings MUST fit within the segment's original \`startTimeMs\` and \`endTimeMs\`. Distribute the timing logically based on the syllables and natural cadence of the translated words. For example, if "Contigo" (startTime: 1000, endTime: 1500) becomes "With you", the new words could be \`[{"word": "With", "startTimeMs": 1000, "endTimeMs": 1250}, {"word": "you", "startTimeMs": 1251, "endTimeMs": 1500}]\`. This is the most important step.
5.  **Update Metadata:** Change the \`metadata.language\` field to reflect the new language code ('en-US' or 'es-ES').

**Output Format:**
You MUST return a single, minified JSON object for the ${translatedLangName} version, strictly following the same schema as the input JSON. Do not include any other text, explanations, or markdown.
`;
};

// --- LRC-Based Synchronization ---

/**
 * Build a prompt for LRC-guided karaoke generation.
 * Hybrid approach: Uses LRC timestamps as primary timing guide (fast) while detecting
 * instrumental sections that aren't in the LRC (intros, interludes, outros).
 */
const buildLrcBasedPrompt = (parsedLrc: ParsedLrc, langName: string): string => {
  // Convert LRC lines to segment input format
  const segments = parsedLrc.lines.map((line, index) => ({
    segmentIndex: index + 1,
    startTimeMs: line.startTimeMs,
    endTimeMs: line.endTimeMs,
    text: line.text,
    wordCount: line.wordCount,
  }));

  // Calculate if there's likely an intro (first lyric starts > 5 seconds in)
  const firstLyricStart = segments[0]?.startTimeMs || 0;
  const likelyHasIntro = firstLyricStart > 5000;

  return `
You are a precise Audio-to-Lyrics Alignment Specialist. Your task is to add WORD-LEVEL timing to lyrics using LRC timestamps as your PRIMARY timing guide.

**KEY CONCEPT: LRC-Guided with Instrumental Detection**
The LRC provides reliable line-level timestamps. Your job is to:
1. Use LRC timestamps as the base timing for each lyric line
2. Distribute words within each line's time window based on what you hear
3. Detect and ADD instrumental sections (intros, interludes, outros) that aren't in the LRC

**Input Data:**
- Audio File: [Provided in the request]
- ${langName} Lyrics with LRC timestamps:
  \`\`\`json
  ${JSON.stringify(segments, null, 2)}
  \`\`\`
${likelyHasIntro ? `
**NOTE:** The first lyric starts at ${firstLyricStart}ms (${(firstLyricStart/1000).toFixed(1)}s). Listen to confirm if there's an instrumental intro before vocals begin.
` : ''}
**RULES:**

1. **Use LRC Timing as Base:**
   - Each lyric segment's startTimeMs and endTimeMs come from the LRC - use these as your timing foundation
   - You may adjust by ±1000ms if the audio clearly indicates the line starts/ends at a different time
   - For word-level timing WITHIN each segment, listen to the audio to distribute words accurately

2. **Detect Instrumental Sections:**
   - If there's music BEFORE the first lyric (intro), add an INSTRUMENTAL segment from 0 to the first lyric's start
   - If there's a gap > 5 seconds between lyric segments, consider adding an INSTRUMENTAL segment
   - If there's music AFTER the last lyric (outro), add an INSTRUMENTAL segment
   - Use descriptive cueText in ${langName}: "Intro musical", "Interludio", "Outro", etc.

3. **Word-Level Timing:**
   - Distribute words within each segment's time window based on what you HEAR
   - First word starts at/near segment.startTimeMs
   - Last word ends at/near segment.endTimeMs
   - Words should NOT overlap and no zero-duration words
   - Pay attention to fast sections - word timings must be precise

4. **Structure:**
   - Include all ${segments.length} lyric lines from the LRC
   - ADD instrumental segments where detected
   - Use sequential segmentIndex starting from 1

**Output Format:**
Return a KaraokeData JSON object with:
- metadata: { title, artist, durationMs, language: "${langName === 'Spanish' ? 'es-ES' : 'en-US'}", version: "1.0" }
- segments: Array with LYRIC and INSTRUMENTAL segments

LYRIC segment:
{ "type": "LYRIC", "startTimeMs": <from LRC>, "endTimeMs": <from LRC>, "text": "...", "segmentIndex": N, "words": [{ "word": "...", "startTimeMs": ..., "endTimeMs": ... }, ...] }

INSTRUMENTAL segment:
{ "type": "INSTRUMENTAL", "startTimeMs": ..., "endTimeMs": ..., "cueText": "...", "segmentIndex": N }

Return a single, minified JSON object with no other text.
`;
};

/**
 * Build a prompt for LRC timestamp correction.
 * Verifies and corrects line-level timestamps against audio, and detects non-lyric sections.
 */
const buildLrcCorrectionPrompt = (parsedLrc: ParsedLrc, langName: string): string => {
  const lines = parsedLrc.lines.map((line, index) => ({
    lineIndex: index,
    originalStartMs: line.startTimeMs,
    text: line.text,
  }));

  const firstLineStart = lines[0]?.originalStartMs || 0;
  const likelyHasIntro = firstLineStart > 3000;

  return `
You are a precise LRC Timestamp Verification Specialist. Your task is to verify and correct the line-level timestamps in an LRC file against the actual audio.

**IMPORTANT CONTEXT:**
- The audio is from a YouTube music video, which may contain content not in the lyrics
- YouTube videos often have: intro graphics, instrumental breaks, spoken interludes, DJ tags, and outros
- The lyrics TEXT is correct, but the TIMESTAMPS may be off
- LRC files often have cumulative drift - if one line is off, subsequent lines are likely off by a similar amount

**Input LRC Lines (${langName}):**
\`\`\`json
${JSON.stringify(lines, null, 2)}
\`\`\`
${likelyHasIntro ? `
**NOTE:** First lyric starts at ${firstLineStart}ms (${(firstLineStart/1000).toFixed(1)}s). There may be an intro before this.
` : ''}
**YOUR TASKS:**

1. **Verify Each Line's Start Time:**
   - Listen to when each lyric line ACTUALLY starts in the audio
   - If the timestamp is accurate (within ±500ms), keep it as-is
   - If the timestamp is wrong, provide the corrected startTimeMs
   - Pay special attention to cumulative drift - if line 5 is 2 seconds late, lines 6+ are probably also late

2. **Detect Non-Lyric Sections:**
   Look for these types of sections that may NOT be in the LRC:
   - **intro**: Music, video intro, or other content BEFORE the first lyric
   - **interlude**: Instrumental breaks, beat drops, or musical sections BETWEEN lyrics (gaps > 5 seconds)
   - **skit**: Spoken dialogue, DJ tags, or non-singing audio that interrupts the song
   - **outro**: Music or content AFTER the last lyric

**OUTPUT FORMAT:**

Return a JSON object with:
1. \`correctedLines\`: Array with corrected timestamps for ALL lines
2. \`detectedSections\`: Array of any non-lyric sections found (can be empty)

Example:
\`\`\`json
{
  "correctedLines": [
    { "lineIndex": 0, "originalStartMs": 15000, "correctedStartMs": 17500, "text": "First line..." },
    { "lineIndex": 1, "originalStartMs": 18000, "correctedStartMs": 20500, "text": "Second line..." }
  ],
  "detectedSections": [
    { "type": "intro", "startTimeMs": 0, "endTimeMs": 17000, "description": "Instrumental intro", "insertAfterLineIndex": -1 },
    { "type": "interlude", "startTimeMs": 45000, "endTimeMs": 60000, "description": "Guitar solo", "insertAfterLineIndex": 5 }
  ]
}
\`\`\`

**RULES:**
- Return ALL ${lines.length} lines in correctedLines, even if timestamps are unchanged
- For unchanged timestamps, set correctedStartMs = originalStartMs
- insertAfterLineIndex: -1 for intro (before all lyrics), or the 0-based line index after which to insert
- Only include detectedSections if you actually detect non-lyric sections
- Return minified JSON only, no explanations
`;
};


const buildRefinementPrompt = (draftKaraokeData: KaraokeData, langName: string): string => {
  const segmentCount = draftKaraokeData.segments.length;

  return `
You are a meticulous Quality Assurance specialist for AI-generated audio-to-text synchronization. Your task is to review a "draft" synchronized karaoke file against its source audio, identify any timing or text inaccuracies, and return a complete, corrected version.

**CRITICAL STRUCTURAL CONSTRAINTS (MUST FOLLOW):**
1. You MUST output EXACTLY ${segmentCount} segments - no more, no less
2. Each segment MUST have segmentIndex values 1 through ${segmentCount} in order
3. Segment type (LYRIC/INSTRUMENTAL) MUST remain unchanged from the input
4. Do NOT merge, split, add, or remove segments under any circumstances
5. You MAY adjust segment-level startTimeMs/endTimeMs if audio analysis reveals timing errors
6. You MAY adjust word-level timing and correct text to match actual audio

**Input Data:**
- Audio File: [Provided in the request]
- Draft ${langName} Karaoke JSON:
  \`\`\`json
  ${JSON.stringify(draftKaraokeData)}
  \`\`\`

**Critical Task: Review and Correct**

Your goal is to produce a final JSON file with the highest possible accuracy. Listen to the audio and compare it to the draft JSON, paying extremely close attention to the following potential errors:

1.  **Incorrect Segment Timings:**
    -   Verify that the \`startTimeMs\` of each LYRIC segment perfectly matches the beginning of the sung phrase.
    -   Verify that the \`endTimeMs\` accurately captures the end of the phrase, including vocal decay.
2.  **Inaccurate Word Timings:**
    -   For each word in the \`words\` array, listen intently. Does the \`startTimeMs\` match the exact moment the word's sound begins?
    -   Does the \`endTimeMs\` match the moment the word's sound ends? This is especially critical for sustained notes or fast-paced sections.
3.  **Synchronization Drift:**
    -   Check if the synchronization is accurate at the beginning but becomes progressively worse over time. If you detect drift, you must recalculate all subsequent timings to correct it.
4.  **Text Discrepancies (Highest Priority):**
    -   **The audio is the absolute ground truth.** Your primary directive is to ensure the final text is a perfect transcript of all audible singing.
    -   **Listen for Additions:** Pay special attention to ad-libs, background vocals, and repeated phrases that might be missing from the draft. If a word or phrase is sung in the audio (by any vocalist), it **MUST** be added to the text and timed correctly. This is a common source of error in initial drafts.
    -   **Listen for Omissions:** If the draft JSON contains a word that isn't actually sung in the audio, remove it.

**Output Mandate:**

-   Your final output MUST be a single, minified, and complete JSON object representing the *entire corrected song data*.
-   This corrected object must strictly follow the original JSON schema.
-   Do not provide text explanations, summaries of your changes, or any text outside of the JSON object. Simply return the perfected JSON.
`;
};

const buildTranslatedRefinementPrompt = (
  draftTranslatedData: KaraokeData,
  refinedOriginalData: KaraokeData,
  translatedLangName: string,
  originalLangName: string
): string => {
  const segmentCount = refinedOriginalData.segments.length;

  return `
You are a precise Temporal Alignment Specialist for multilingual karaoke. Your task is to adjust the timing of a translated lyric file to match a perfectly timed original version, using the audio as a reference for rhythm and cadence.

**CRITICAL STRUCTURAL CONSTRAINTS (MUST FOLLOW):**
1. You MUST output EXACTLY ${segmentCount} segments - no more, no less
2. Each segment MUST have segmentIndex values 1 through ${segmentCount} in order
3. Segment-level startTimeMs and endTimeMs MUST match the ${originalLangName} ground truth EXACTLY
4. Segment type (LYRIC/INSTRUMENTAL) MUST match the ${originalLangName} ground truth EXACTLY
5. Do NOT merge, split, add, or remove segments under any circumstances
6. Do NOT change any text content - only adjust word-level timing within segments

**CRITICAL CONSTRAINT: DO NOT CHANGE THE TRANSLATED LYRICS.** The text in the "Draft ${translatedLangName} Data" is the correct and final translation. Your ONLY task is to correct its \`startTimeMs\` and \`endTimeMs\` values for both segments and words.

**Input Data:**

1.  **Audio File:** [Provided in the request]
2.  **Ground Truth Timed Data (${originalLangName}):** This version has been meticulously timed against the audio. Use its segment structure and timings as your primary guide.
    \`\`\`json
    ${JSON.stringify(refinedOriginalData)}
    \`\`\`
3.  **Draft Translated Data (${translatedLangName}):** This is the file you must correct.
    \`\`\`json
    ${JSON.stringify(draftTranslatedData)}
    \`\`\`

**Task Instructions:**

1.  **Analyze Cadence:** Listen to the audio to understand the vocal rhythm, flow, and pauses.
2.  **Reference Original Timings:** Look at the \`startTimeMs\` and \`endTimeMs\` in the "${originalLangName}" data. This is your timing blueprint.
3.  **Correct Translated Timings:** Go through the "Draft ${translatedLangName} Data" word by word and segment by segment. Adjust every \`startTimeMs\` and \`endTimeMs\` value so that the English words align perfectly with the sung syllables in the audio, using the ${originalLangName} data as a structural reference.
4.  **Handle Phrasing Differences:** Languages have different syllable counts. For example, "I love you" (3 syllables) might be translated from "Te amo" (2 syllables). You must intelligently distribute the total segment duration from the original data across the translated words. Ensure the timing feels natural and matches the singer's delivery.
5.  **Preserve Text Integrity:** Re-iterate: You MUST NOT add, remove, or alter any words in the \`text\` or \`words.word\` fields of the draft ${translatedLangName} data. The translation is final. Any deviation from this rule will result in failure.

**Output Mandate:**

-   Return a single, minified, and complete JSON object representing the *entire corrected ${translatedLangName} song data*.
-   This corrected object must strictly follow the original JSON schema.
-   Do not provide text explanations, summaries of your changes, or any text outside of the JSON object.
`;
};

/**
 * Build a text-only alignment prompt for aligning translated lyrics to refined original timing.
 * NO AUDIO NEEDED - this is a pure text transformation based on timing data.
 */
const buildTextOnlyAlignmentPrompt = (
  refinedOriginalData: KaraokeData,
  draftTranslatedData: KaraokeData,
  originalLangName: string,
  translatedLangName: string
): string => {
  const segmentCount = refinedOriginalData.segments.length;

  return `
You are a precise Text-to-Timing Alignment Engine. Your task is to align translated lyrics to match the timing structure of an already-refined original version.

**THIS IS A TEXT-ONLY TASK - NO AUDIO ANALYSIS REQUIRED.**
The ${originalLangName} version has already been perfectly timed against the audio. You simply need to redistribute the ${translatedLangName} words within the same segment boundaries.

**CRITICAL STRUCTURAL CONSTRAINTS:**
1. Output EXACTLY ${segmentCount} segments - no more, no less
2. Each segment's startTimeMs and endTimeMs MUST be IDENTICAL to the ${originalLangName} version
3. Segment type (LYRIC/INSTRUMENTAL) MUST match exactly
4. Do NOT modify any text content - only adjust word-level timing
5. segmentIndex values must match the original (1 through ${segmentCount})

**Input Data:**

1. **Ground Truth (${originalLangName}) - USE THESE TIMINGS:**
\`\`\`json
${JSON.stringify(refinedOriginalData)}
\`\`\`

2. **Draft ${translatedLangName} Data - ALIGN THIS:**
\`\`\`json
${JSON.stringify(draftTranslatedData)}
\`\`\`

**Task:**

For each LYRIC segment:
1. Copy segment-level startTimeMs and endTimeMs EXACTLY from ${originalLangName}
2. Take the ${translatedLangName} words from the draft
3. Distribute word timings within the segment boundaries:
   - First word starts at segment.startTimeMs
   - Last word ends at segment.endTimeMs
   - Distribute intermediate words proportionally based on syllable count
   - No overlapping words, no gaps

For INSTRUMENTAL segments:
- Copy all timing fields exactly from ${originalLangName}
- Keep cueText from ${translatedLangName} draft

**Example:**
If ${originalLangName} segment is: startTimeMs: 5000, endTimeMs: 8000
And ${translatedLangName} has 4 words: "I love you too"
Then distribute: ~750ms per word across the 3000ms window

**Output:**
Return a single, minified JSON object matching the KaraokeData schema.
No explanations, no markdown - just the JSON.
`;
};

const parseGoogleGenerativeAIError = (error: any): string => {
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = error.message as string;
        
        // Check for common, user-actionable errors
        if (message.includes('API key not valid')) {
            return 'API Key Invalid. Please ensure your API key is correct and has the necessary permissions.';
        }
        if (message.includes('permission denied')) {
            return 'Permission Denied. The provided API key may not have access to the required models. Please check your Google AI project settings.';
        }
        if (message.includes('429') && message.toLowerCase().includes('quota')) {
            return 'Quota Exceeded. You have made too many requests in a short period. Please wait and try again, or check your quota limits in your Google AI project.';
        }
         if (message.includes('503') && message.toLowerCase().includes('service unavailable')) {
            return 'Service Unavailable. The AI model is temporarily overloaded. Please try again in a few moments.';
        }
        if (message.includes('504') && message.toLowerCase().includes('deadline exceeded')) {
             return 'Request Timed Out. The model took too long to respond, which can happen with very long or complex audio files. Please try a shorter file.';
        }

        // Check for content safety issues
        if (message.includes('[SAFETY]')) {
            return 'Request blocked by the content safety filter. The provided lyrics may contain sensitive material.';
        }
    }
    // Fallback for other generic API errors
    return "An unknown API error occurred. Please check the developer console for more details and try again later.";
};


export const generateKaraokeData = async (
  audioFile: File,
  originalLyrics: string,
  translatedLyrics: string,
  languageFlow: 'es-en' | 'en-es',
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeApiResponse> => {
  const isEsToEn = languageFlow === 'es-en';
  const originalLangName = isEsToEn ? 'Spanish' : 'English';
  const translatedLangName = isEsToEn ? 'English' : 'Spanish';
  const models = getModelNames(modelTier);

  try {
    // --- STEP 1: Generate accurately timed data for the original language ---
    onStatusUpdate(`Step 1/2: Preparing audio and ${originalLangName} lyrics for analysis...`);
    const audioPart = await fileToGenerativePart(audioFile);
    const primaryPrompt = buildSingleLanguagePrompt(originalLyrics, originalLangName);
    const primaryTextPart = { text: primaryPrompt };

    const primaryModel = models.pro;

    onStatusUpdate(`Step 1/2: Analyzing audio waveform and aligning ${originalLangName} lyrics. This is the longest step and may take up to 5 minutes...`);

    const primaryApiCall = () => callGeminiProxy(
      primaryModel,
      [{ parts: [primaryTextPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 32768,
      }
    );

    const primaryApiCallPromise = retryWithBackoff(
      primaryApiCall, 3, 2000,
      (attempt) => {
        console.warn(`Primary API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Step 1/2: Request failed, attempting to reconnect... (Attempt ${attempt + 1}/3)`);
      }
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The request timed out after 5 minutes. This is common for longer songs. Please check your inputs or try again.")), 300000)
    );

    const primaryResponse = await Promise.race([primaryApiCallPromise, timeoutPromise]);
    
    onStatusUpdate('Step 1/2: Received response, parsing synchronized data...');
    const primaryText = primaryResponse.text.trim();
    if (!primaryText) {
        throw new Error("The AI model returned an empty response for the primary alignment. This could be due to a content safety filter or an issue with the provided audio/lyrics.");
    }

    let originalTimedData: KaraokeData;
    try {
        originalTimedData = JSON.parse(primaryText);
    } catch (parseError) {
        console.error("Failed to parse JSON response from primary alignment:", primaryText);
        throw new Error("The AI model's response for the original lyrics was not in the expected JSON format.");
    }

    // --- STEP 2: Use the result from Step 1 to align the translated lyrics ---
    onStatusUpdate(`Step 2/2: Mapping ${translatedLangName} translation onto synchronized timeline...`);

    const translationPrompt = buildTranslationAlignmentPrompt(originalTimedData, translatedLyrics, originalLangName, translatedLangName);
    const translationModel = models.pro;

    const translationApiCall = () => callGeminiProxy(
      translationModel,
      translationPrompt,
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 32768,
      }
    );

    const translationResponse = await retryWithBackoff(
      translationApiCall, 3, 1000,
      (attempt) => {
        console.warn(`Translation alignment API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Step 2/2: Request failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    onStatusUpdate('Step 2/2: Received response, parsing translated data...');
    const translationText = translationResponse.text.trim();
    if (!translationText) {
        throw new Error("The AI model returned an empty response for the translation alignment.");
    }

    let translatedTimedData: KaraokeData;
    try {
        translatedTimedData = JSON.parse(translationText);
    } catch (parseError) {
        console.error("Failed to parse JSON response from translation alignment:", translationText);
        throw new Error("The AI model's response for the translated lyrics was not in the expected JSON format.");
    }
    
    onStatusUpdate('Success! Finalizing results...');
    
    // Combine results into the final expected format
    return {
        spanish: isEsToEn ? originalTimedData : translatedTimedData,
        english: isEsToEn ? translatedTimedData : originalTimedData,
    };

  } catch (error) {
    console.error("Error during karaoke generation process:", error);
    if (error instanceof Error && (error.message.includes("JSON format") || error.message.includes("empty response") || error.message.includes("timed out"))) {
        throw error; // Re-throw our custom, user-friendly errors
    }
    // For all other errors, try to parse them into a more specific message.
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};


export const refineKaraokeData = async (
  audioFile: File,
  karaokeDataToRefine: KaraokeData,
  languageName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  const models = getModelNames(modelTier);
  try {
    onStatusUpdate('Preparing audio for analysis...');
    const audioPart = await fileToGenerativePart(audioFile);

    onStatusUpdate('Constructing AI review prompt...');
    const refinementPrompt = buildRefinementPrompt(karaokeDataToRefine, languageName);
    const textPart = { text: refinementPrompt };

    const model = models.pro;
    onStatusUpdate(`Sending data to AI for quality review. This can take several minutes...`);

    const apiCall = () => callGeminiProxy(
      model,
      [{ parts: [textPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 65536, // Increased to handle longer songs
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`Refinement API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Refinement failed, attempting to reconnect... (Attempt ${attempt + 1}/3)`);
      }
    );

    // 8 minute timeout for longer songs with audio analysis
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The refinement request timed out after 8 minutes.")), 480000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    onStatusUpdate('Received refined data, parsing final result...');
    const text = response.text.trim();
     if (!text) {
        throw new Error("The AI model returned an empty response during the refinement pass.");
    }

    try {
        const refinedData = JSON.parse(text);
        return refinedData as KaraokeData;
    } catch (parseError) {
        console.error("Failed to parse JSON response from refinement pass:", text);
        throw new Error("The AI model's response during refinement was not in the expected JSON format.");
    }

  } catch (error) {
     console.error("Error during karaoke refinement process:", error);
    if (error instanceof Error && (error.message.includes("JSON format") || error.message.includes("empty response") || error.message.includes("timed out"))) {
        throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

export const refineTranslatedKaraokeData = async (
  audioFile: File,
  translatedDataToRefine: KaraokeData,
  originalRefinedData: KaraokeData,
  translatedLangName: string,
  originalLangName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  const models = getModelNames(modelTier);
  try {
    onStatusUpdate('Preparing audio for alignment...');
    const audioPart = await fileToGenerativePart(audioFile);

    onStatusUpdate('Constructing AI alignment prompt...');
    const refinementPrompt = buildTranslatedRefinementPrompt(
      translatedDataToRefine,
      originalRefinedData,
      translatedLangName,
      originalLangName
    );
    const textPart = { text: refinementPrompt };

    const model = models.pro;
    onStatusUpdate(`Sending data to AI for timing alignment. This can take several minutes...`);

    const apiCall = () => callGeminiProxy(
      model,
      [{ parts: [textPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 32768,
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`Alignment API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Alignment failed, attempting to reconnect... (Attempt ${attempt + 1}/3)`);
      }
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The alignment request timed out after 5 minutes.")), 300000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    
    onStatusUpdate('Received aligned data, parsing final result...');
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI model returned an empty response during the alignment pass.");
    }
    
    try {
        const alignedData = JSON.parse(text);
        return alignedData as KaraokeData;
    } catch (parseError) {
        console.error("Failed to parse JSON response from alignment pass:", text);
        throw new Error("The AI model's response during alignment was not in the expected JSON format.");
    }

  } catch (error) {
    console.error("Error during karaoke alignment process:", error);
    if (error instanceof Error && (error.message.includes("JSON format") || error.message.includes("empty response") || error.message.includes("timed out"))) {
        throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

/**
 * Align translated karaoke data to refined original timing - NO AUDIO NEEDED.
 * Uses Gemini Flash for fast, text-only alignment.
 * This is much faster and more reliable than the audio-based refineTranslatedKaraokeData.
 */
export const alignTranslatedToRefinedOriginal = async (
  refinedOriginalData: KaraokeData,
  draftTranslatedData: KaraokeData,
  originalLangName: string,
  translatedLangName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  const models = getModelNames(modelTier);

  try {
    onStatusUpdate(`Aligning ${translatedLangName} timing to refined ${originalLangName} structure...`);

    const alignmentPrompt = buildTextOnlyAlignmentPrompt(
      refinedOriginalData,
      draftTranslatedData,
      originalLangName,
      translatedLangName
    );

    // Use Flash model - no audio analysis needed, just text transformation
    const model = models.flash;
    onStatusUpdate(`Using ${model} for fast text-only alignment...`);

    const apiCall = () => callGeminiProxy(
      model,
      alignmentPrompt,
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 65536,
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 1000,
      (attempt) => {
        console.warn(`Text alignment API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Alignment failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    // Shorter timeout since no audio processing
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The text alignment request timed out after 2 minutes.")), 120000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    onStatusUpdate('Received aligned data, parsing result...');
    const text = response.text.trim();
    if (!text) {
      throw new Error("The AI model returned an empty response during text alignment.");
    }

    try {
      const alignedData = JSON.parse(text);
      onStatusUpdate(`${translatedLangName} alignment complete!`);
      return alignedData as KaraokeData;
    } catch (parseError) {
      console.error("Failed to parse JSON response from text alignment:", text);
      throw new Error("The AI model's response during text alignment was not in the expected JSON format.");
    }

  } catch (error) {
    console.error("Error during text-only alignment process:", error);
    if (error instanceof Error && (error.message.includes("JSON format") || error.message.includes("empty response") || error.message.includes("timed out"))) {
      throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

export const translateLyrics = async (
  sourceText: string,
  sourceLang: 'es' | 'en',
  targetLang: 'es' | 'en',
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<string> => {
  const models = getModelNames(modelTier);
  const model = models.flash;

  const sourceLangName = sourceLang === 'es' ? 'Spanish' : 'English';
  const targetLangName = targetLang === 'en' ? 'English' : 'Spanish';

  const prompt = `
Translate the following song lyrics from ${sourceLangName} to ${targetLangName}.
Preserve the line breaks and stanza structure (e.g., [Verse 1], [Chorus]) exactly.
Maintain the meaning and poetic feel of the lyrics.
Do not add any extra text, explanations, or titles. Only return the translated text.

Source Lyrics:
---
${sourceText}
---

Translated Lyrics:
`;

  try {
    const apiCall = () => callGeminiProxy(model, prompt);

    const response = await retryWithBackoff(apiCall, 3, 1000, (attempt) => {
      console.warn(`Translation API call failed on attempt ${attempt}. Retrying...`);
    });

    const translatedText = response.text.trim();
    if (!translatedText) {
      throw new Error("Translation failed: the model returned an empty response.");
    }
    return translatedText;
  } catch (error) {
    console.error("Error calling Gemini API for translation:", error);
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};


export const generateVocabularyList = async (
  spanishKaraokeData: KaraokeData,
  englishKaraokeData: KaraokeData,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<VocabularyItem[]> => {
  const models = getModelNames(modelTier);
  const model = models.flash;

  const prompt = `
You are an expert cultural linguist, specializing in teaching the nuances of modern Spanish slang and idioms to English speakers through popular music.
Your task is to analyze a song's lyrics and extract the most culturally significant vocabulary, prioritizing slang and phrases that a typical textbook would miss.

**Input Data:**
- Spanish Timed Lyrics Data:
  ---
  ${JSON.stringify(spanishKaraokeData)}
  ---
- English Timed Lyrics Data (for contextual understanding):
  ---
  ${JSON.stringify(englishKaraokeData)}
  ---

**Core Mission: Uncover the "Street Smarts"**

Your goal is to identify **5-8 of the MOST culturally significant** Spanish terms or phrases from the lyrics. Focus on quality over quantity - only include terms that are truly valuable for language learners.

Prioritize these types (in order of importance):
1.  **Popular Slang & Colloquialisms:** Words or phrases used in informal, everyday conversation that a textbook would never teach.
2.  **Idiomatic Expressions:** Phrases where the meaning isn't deducible from the individual words (e.g., "tomar el pelo").
3.  **Culturally-Specific Context:** Words that have a deeper meaning or connotation within the culture that might be lost in a direct translation.

**Crucially, AVOID:**
- Simple, common vocabulary found in beginner textbooks (e.g., 'y', 'el', 'casa', 'ser', 'estar')
- Standard verbs and nouns unless used in a very unique idiomatic way
- Terms that are easily understood from direct translation

**Task Instructions:**

For each identified term/phrase, provide the following structured information:

-   \`term\`: An object containing the Spanish term/phrase (\`spanish\`) and its closest English equivalent (\`english\`), which might be a literal translation or a slang equivalent.
-   \`definition\`: This is the most important part. Provide a clear English explanation of the term's literal meaning AND its contextual, slang, or idiomatic usage in the song. Explain *why* it's interesting, what cultural subtext it carries, or how a native speaker would interpret it in this context.
-   \`difficulty\`: An integer from 1 to 10. This score should not represent how common the word is, but rather how *non-obvious* its meaning is to a non-native speaker. A 1 would be slightly nuanced, while a 10 would be a very specific or obscure slang term that is almost impossible to guess.
-   \`example\`: An object containing the full, original line from the Spanish lyrics where the word appears (\`spanish\`) and its corresponding English translation (\`english\`).
-   \`highlight\`: An object containing the exact Spanish word/phrase as it appears in the example sentence (\`spanish\`), and its corresponding English translated word/phrase (\`english\`). This is crucial for accurate highlighting.
-   \`startTimeMs\`: **CRITICAL:** Find the \`startTimeMs\` of the *entire segment* (the full lyric line) where the term appears. This value should come directly from the \`startTimeMs\` of the corresponding segment object in the Spanish Timed Lyrics Data.
-   \`endTimeMs\`: **CRITICAL:** Find the \`endTimeMs\` of the *entire segment* (the full lyric line) where the term appears. This value should come directly from the \`endTimeMs\` of the corresponding segment object in the Spanish Timed Lyrics Data. For example, if the example is "Así que vamos a romper" and that line corresponds to a segment with \`startTimeMs: 16000\` and \`endTimeMs: 17800\`, you must return these exact values.
-   \`segmentIndex\`: **CRITICAL:** Find the \`segmentIndex\` of the segment where the term appears. This value should come directly from the corresponding segment object in the Spanish Timed Lyrics Data.

**Output Format:**
You MUST return a single, minified JSON object that strictly follows the provided schema. The output should be an array of vocabulary item objects.
Do not include any other text, explanations, or markdown formatting.
`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        term: {
          type: Type.OBJECT,
          description: 'An object containing the base Spanish word and its direct English translation.',
          properties: {
            spanish: { type: Type.STRING, description: 'The Spanish word in its base form.' },
            english: { type: Type.STRING, description: 'The direct English translation of the term.' }
          },
          required: ['spanish', 'english']
        },
        definition: {
          type: Type.STRING,
          description: 'A concise and accurate English definition.',
        },
        difficulty: {
          type: Type.INTEGER,
          description: "An integer score from 1 (very common, beginner) to 10 (rare, advanced) representing the word's difficulty.",
        },
        example: {
          type: Type.OBJECT,
          description: 'An object containing the original Spanish line and its English translation.',
          properties: {
            spanish: {
              type: Type.STRING,
              description: 'The full, original line from the Spanish lyrics where the word appears.'
            },
            english: {
              type: Type.STRING,
              description: 'The English translation of the example line.'
            }
          },
          required: ['spanish', 'english']
        },
        highlight: {
          type: Type.OBJECT,
          description: 'An object containing the exact words from the examples for highlighting.',
          properties: {
            spanish: {
              type: Type.STRING,
              description: 'The exact Spanish word as it appears in the example sentence.'
            },
            english: {
              type: Type.STRING,
              description: 'The corresponding English word from the translated example.'
            }
          },
          required: ['spanish', 'english']
        },
        startTimeMs: {
            type: Type.INTEGER,
            description: "The start time in milliseconds of the entire lyric line (segment) where the term appears."
        },
        endTimeMs: {
            type: Type.INTEGER,
            description: "The end time in milliseconds of the entire lyric line (segment) where the term appears."
        },
        segmentIndex: {
            type: Type.INTEGER,
            description: "The index of the segment from the original data where the example line is found."
        }
      },
      required: ['term', 'definition', 'difficulty', 'example', 'highlight', 'startTimeMs', 'endTimeMs', 'segmentIndex'],
    },
  };

  try {
    const apiCall = () => callGeminiProxy(
      model,
      prompt,
      {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    );

    const response = await retryWithBackoff(apiCall, 3, 1000, (attempt) => {
      console.warn(`Vocabulary API call failed on attempt ${attempt}. Retrying...`);
    });

    const text = response.text.trim();
    if (!text) {
        throw new Error("The vocabulary model returned an empty response.");
    }
    const parsedJson = JSON.parse(text);
    return parsedJson as VocabularyItem[];

  } catch (error) {
    console.error("Error calling Gemini API for vocabulary generation:", error);
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

// Build a focused refinement prompt for specific segments
// Helper to calculate focus area indices (marked segments + context window)
const calculateFocusArea = (
  markedSegmentIndices: number[],
  totalSegments: number,
  contextWindow: number = 2
): { focusIndices: number[]; markedSet: Set<number> } => {
  const segmentsToRefine = new Set<number>();

  markedSegmentIndices.forEach(idx => {
    segmentsToRefine.add(idx);
    for (let i = 1; i <= contextWindow; i++) {
      if (idx - i >= 0) segmentsToRefine.add(idx - i);
      if (idx + i < totalSegments) segmentsToRefine.add(idx + i);
    }
  });

  return {
    focusIndices: Array.from(segmentsToRefine).sort((a, b) => a - b),
    markedSet: new Set(markedSegmentIndices),
  };
};

const buildSegmentFocusedRefinementPrompt = (
  draftKaraokeData: KaraokeData,
  markedSegmentIndices: number[],
  langName: string,
  referenceData?: KaraokeData
): string => {
  const segmentCount = draftKaraokeData.segments.length;
  const { focusIndices, markedSet } = calculateFocusArea(markedSegmentIndices, segmentCount);

  // Extract only the segments in the focus area for input
  const focusSegments = focusIndices.map(idx => {
    const segment = draftKaraokeData.segments[idx];
    return {
      originalIndex: idx,
      isMarkedForRefinement: markedSet.has(idx),
      ...segment,
    };
  });

  const hasReference = referenceData !== undefined;
  const referenceInfo = hasReference ? `
**Reference Timing Data (already refined):**
Use these segment timings as the ground truth for structural alignment:
\`\`\`json
${JSON.stringify(focusIndices.map(idx => ({ originalIndex: idx, ...referenceData.segments[idx] })))}
\`\`\`` : '';

  return `
You are a precision Audio-Lyric Synchronization Specialist. The user has identified specific segments in their karaoke file that appear to be MISALIGNED with the audio. Your task is to carefully re-analyze these segments against the audio and provide corrected timing data.

**IMPORTANT: PARTIAL OUTPUT MODE**
You will ONLY return the refined segments from the focus area, NOT the entire song.
This keeps the response compact and efficient.

**User-Marked Problem Segments (indices in original song):**
${markedSegmentIndices.map(idx => `- Segment ${idx + 1}: "${draftKaraokeData.segments[idx].text || draftKaraokeData.segments[idx].cueText}"`).join('\n')}

**Focus Area Segments (to be refined and returned):**
These are the segments you need to analyze and return. Each has an \`originalIndex\` field indicating its position in the full song:
\`\`\`json
${JSON.stringify(focusSegments, null, 2)}
\`\`\`
${referenceInfo}

**Audio File:** [Provided in the request]

**Task Instructions:**

1. **Listen to the Audio Carefully:** Focus on the time ranges where these segments occur.

2. **Re-analyze Marked Segments:** For segments with "isMarkedForRefinement: true":
   - Listen to when the vocals ACTUALLY start and end
   - Adjust \`startTimeMs\` and \`endTimeMs\` to match the REAL audio
   - Re-time every word in the \`words\` array to match actual pronunciation

3. **Adjust Context Segments:** For other segments in the focus area:
   - Adjust timing to flow smoothly with the refined marked segments
   - Ensure no overlaps between adjacent segments
   - Maintain natural timing flow

4. **Handle Boundaries:** The first and last segments in your output may need to align with segments outside the focus area:
   - First segment (originalIndex: ${focusIndices[0]}): Previous segment ends at ${focusIndices[0] > 0 ? draftKaraokeData.segments[focusIndices[0] - 1].endTimeMs : 0}ms
   - Last segment (originalIndex: ${focusIndices[focusIndices.length - 1]}): Next segment starts at ${focusIndices[focusIndices.length - 1] < segmentCount - 1 ? draftKaraokeData.segments[focusIndices[focusIndices.length - 1] + 1].startTimeMs : 'end of song'}

**Output Format:**
Return a JSON object with this structure:
\`\`\`json
{
  "refinedSegments": [
    {
      "originalIndex": <number>,
      "type": "LYRIC" | "INSTRUMENTAL",
      "startTimeMs": <number>,
      "endTimeMs": <number>,
      "segmentIndex": <number>,
      "text": "<string>",
      "words": [{ "word": "...", "startTimeMs": ..., "endTimeMs": ... }, ...]
    },
    ...
  ]
}
\`\`\`

CRITICAL:
- Return ONLY the ${focusIndices.length} segments from the focus area
- Each segment MUST include its \`originalIndex\` so we can merge it back
- Keep \`segmentIndex\` values unchanged from the input
- Return minified JSON only, no explanations
`;
};

export const refineMarkedSegments = async (
  audioFile: File,
  karaokeDataToRefine: KaraokeData,
  markedSegmentIndices: number[],
  languageName: string,
  onStatusUpdate: (message: string) => void,
  referenceData?: KaraokeData,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  if (markedSegmentIndices.length === 0) {
    return karaokeDataToRefine; // Nothing to refine
  }

  const models = getModelNames(modelTier);
  const { focusIndices } = calculateFocusArea(markedSegmentIndices, karaokeDataToRefine.segments.length);

  try {
    onStatusUpdate('Preparing audio for focused analysis...');
    const audioPart = await fileToGenerativePart(audioFile);

    onStatusUpdate(`Constructing focused refinement prompt for ${markedSegmentIndices.length} segment(s) (${focusIndices.length} with context)...`);
    const refinementPrompt = buildSegmentFocusedRefinementPrompt(
      karaokeDataToRefine,
      markedSegmentIndices,
      languageName,
      referenceData
    );
    const textPart = { text: refinementPrompt };

    const model = models.pro;
    onStatusUpdate(`Analyzing ${focusIndices.length} segments. This may take a few minutes...`);

    // Use partial refinement schema - only returns refined segments, not the whole song
    const apiCall = () => callGeminiProxy(
      model,
      [{ parts: [textPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: partialRefinementSchema,
        maxOutputTokens: 32768, // Reduced since we only return focus segments now
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`Segment refinement API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Refinement failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The segment refinement request timed out after 5 minutes.")), 300000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    onStatusUpdate('Received refined segments, merging into original data...');
    const text = response.text.trim();
    if (!text) {
      throw new Error("The AI model returned an empty response during segment refinement.");
    }

    try {
      const parsedResponse = JSON.parse(text);

      // Validate we got refinedSegments array
      if (!parsedResponse.refinedSegments || !Array.isArray(parsedResponse.refinedSegments)) {
        console.error("Response missing refinedSegments array:", text);
        throw new Error("The AI model did not return the expected refinedSegments format.");
      }

      const refinedSegments: RefinedSegment[] = parsedResponse.refinedSegments;

      // Validate segment count matches focus area
      if (refinedSegments.length !== focusIndices.length) {
        console.warn(`Refined segment count mismatch: expected ${focusIndices.length}, got ${refinedSegments.length}`);
        // Continue anyway - we'll merge what we got
      }

      // Merge refined segments back into the original data
      onStatusUpdate('Merging refined segments and adjusting boundaries...');
      const mergedData = mergeRefinedSegments(karaokeDataToRefine, refinedSegments, markedSegmentIndices);

      onStatusUpdate('Segment refinement complete!');
      return mergedData;

    } catch (parseError) {
      console.error("Failed to parse JSON response from segment refinement:", text.substring(0, 500) + '...');
      throw new Error("The AI model's response during segment refinement was not in the expected JSON format.");
    }

  } catch (error) {
    console.error("Error during segment refinement process:", error);
    if (error instanceof Error && (
      error.message.includes("JSON format") ||
      error.message.includes("empty response") ||
      error.message.includes("timed out") ||
      error.message.includes("refinedSegments")
    )) {
      throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

// --- LRC-Based Karaoke Generation ---

/**
 * Correct LRC timestamps against audio and detect non-lyric sections.
 * This is the first pass before word-level generation.
 */
export const correctLrcTimestamps = async (
  audioFile: File,
  parsedLrc: ParsedLrc,
  languageName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<ParsedLrc> => {
  const models = getModelNames(modelTier);

  try {
    onStatusUpdate('Preparing audio for LRC timestamp verification...');
    const audioPart = await fileToGenerativePart(audioFile);

    onStatusUpdate(`Verifying ${parsedLrc.lines.length} LRC line timestamps against audio...`);
    const prompt = buildLrcCorrectionPrompt(parsedLrc, languageName);
    const textPart = { text: prompt };

    const model = models.pro;
    onStatusUpdate('Analyzing audio to correct LRC timestamps and detect non-lyric sections...');

    const apiCall = () => callGeminiProxy(
      model,
      [{ parts: [textPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: lrcCorrectionSchema,
        maxOutputTokens: 16384, // Smaller output than full karaoke
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`LRC correction API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`LRC correction failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    // 5 minute timeout - shorter than full karaoke generation
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The LRC correction request timed out after 5 minutes.")), 300000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    onStatusUpdate('Received corrections, applying to LRC data...');
    const text = response.text.trim();
    if (!text) {
      throw new Error("The AI model returned an empty response for LRC correction.");
    }

    let correctionData: LrcCorrectionResponse;
    try {
      correctionData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse LRC correction response:", text);
      throw new Error("The AI model's LRC correction response was not in the expected JSON format.");
    }

    // Apply corrections to ParsedLrc
    const correctedLines = [...parsedLrc.lines];
    let correctionsApplied = 0;

    for (const correction of correctionData.correctedLines) {
      const idx = correction.lineIndex;
      if (idx >= 0 && idx < correctedLines.length) {
        const originalStart = correctedLines[idx].startTimeMs;
        const newStart = correction.correctedStartMs;

        if (originalStart !== newStart) {
          correctedLines[idx] = {
            ...correctedLines[idx],
            startTimeMs: newStart,
          };
          correctionsApplied++;
        }
      }
    }

    // Recalculate endTimeMs for each line based on next line's start
    for (let i = 0; i < correctedLines.length - 1; i++) {
      correctedLines[i] = {
        ...correctedLines[i],
        endTimeMs: correctedLines[i + 1].startTimeMs,
      };
    }

    // Log detected sections for visibility
    const sections = correctionData.detectedSections || [];
    if (sections.length > 0) {
      console.log(`Detected ${sections.length} non-lyric section(s):`, sections);
      onStatusUpdate(`Detected ${sections.length} non-lyric section(s): ${sections.map(s => s.type).join(', ')}`);
    }

    onStatusUpdate(`LRC correction complete! ${correctionsApplied} timestamp(s) corrected.`);

    // Return corrected ParsedLrc with detected sections attached
    return {
      ...parsedLrc,
      lines: correctedLines,
      detectedSections: sections,
    };

  } catch (error) {
    console.error("Error during LRC timestamp correction:", error);
    if (error instanceof Error && (
      error.message.includes("JSON format") ||
      error.message.includes("empty response") ||
      error.message.includes("timed out")
    )) {
      throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

/**
 * Internal function to generate karaoke from a pre-parsed LRC.
 * Used by both generateKaraokeFromLrc and generateBilingualKaraokeFromLrc.
 */
const generateKaraokeFromParsedLrc = async (
  audioFile: File,
  parsedLrc: ParsedLrc,
  langName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  const models = getModelNames(modelTier);

  try {
    onStatusUpdate('Preparing audio for analysis...');
    const audioPart = await fileToGenerativePart(audioFile);

    onStatusUpdate('Building LRC-anchored prompt...');
    const prompt = buildLrcBasedPrompt(parsedLrc, langName);
    const textPart = { text: prompt };

    const model = models.pro;
    onStatusUpdate(`Analyzing audio with LRC anchors. This may take several minutes...`);

    const apiCall = () => callGeminiProxy(
      model,
      [{ parts: [textPart, audioPart] }],
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 65536, // Increased to handle longer songs with many segments
      }
    );

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`LRC-based generation failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Request failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The LRC-based generation request timed out after 5 minutes.")), 300000)
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);

    onStatusUpdate('Received response, parsing karaoke data...');
    const text = response.text.trim();
    if (!text) {
      throw new Error("The AI model returned an empty response for LRC-based generation.");
    }

    let karaokeData: KaraokeData;
    try {
      karaokeData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON response from LRC-based generation:", text);
      throw new Error("The AI model's response was not in the expected JSON format.");
    }

    // Add metadata from LRC if available
    if (parsedLrc.metadata.title && !karaokeData.metadata.title) {
      karaokeData.metadata.title = parsedLrc.metadata.title;
    }
    if (parsedLrc.metadata.artist && !karaokeData.metadata.artist) {
      karaokeData.metadata.artist = parsedLrc.metadata.artist;
    }

    onStatusUpdate('LRC-based generation complete!');
    return karaokeData;

  } catch (error) {
    console.error("Error during LRC-based karaoke generation:", error);
    if (error instanceof Error && (
      error.message.includes("JSON format") ||
      error.message.includes("empty response") ||
      error.message.includes("timed out") ||
      error.message.includes("No valid lyric lines")
    )) {
      throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

/**
 * Generate karaoke data from an LRC file (single language).
 * Public wrapper that parses LRC content first.
 */
export const generateKaraokeFromLrc = async (
  audioFile: File,
  lrcContent: string,
  langName: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeData> => {
  onStatusUpdate('Parsing LRC file...');
  const parsedLrc = parseLrc(lrcContent);

  if (parsedLrc.lines.length === 0) {
    throw new Error('No valid lyric lines found in LRC content. Please check the format.');
  }

  onStatusUpdate(`Found ${parsedLrc.lines.length} lyric lines in LRC file.`);

  return generateKaraokeFromParsedLrc(audioFile, parsedLrc, langName, onStatusUpdate, modelTier);
};

/**
 * Generate bilingual karaoke data from a Spanish LRC file.
 * Orchestrates the full pipeline: parse LRC → correct timestamps → translate → generate Spanish → align English.
 */
export const generateBilingualKaraokeFromLrc = async (
  audioFile: File,
  lrcContent: string,
  onStatusUpdate: (message: string) => void,
  modelTier: GeminiModelTier = 'gemini-2.5',
): Promise<KaraokeApiResponse> => {
  try {
    // Step 1: Parse LRC
    onStatusUpdate('Step 1/5: Parsing LRC file...');
    const parsedLrc = parseLrc(lrcContent);

    if (parsedLrc.lines.length === 0) {
      throw new Error('No valid lyric lines found in LRC content. Please check the format.');
    }

    onStatusUpdate(`Found ${parsedLrc.lines.length} lyric lines in LRC file.`);

    // Step 2: Correct LRC timestamps against audio
    onStatusUpdate('Step 2/5: Verifying and correcting LRC timestamps against audio...');
    const correctedLrc = await correctLrcTimestamps(
      audioFile,
      parsedLrc,
      'Spanish',
      (msg) => onStatusUpdate(`Step 2/5: ${msg}`),
      modelTier
    );

    // Step 3: Translate Spanish lyrics to English
    onStatusUpdate('Step 3/5: Translating Spanish lyrics to English...');
    const spanishLyrics = extractLyricsText(correctedLrc);
    const englishLyrics = await translateLyrics(spanishLyrics, 'es', 'en', modelTier);

    onStatusUpdate('Translation complete.');

    // Step 4: Generate Spanish karaoke with CORRECTED LRC anchors
    onStatusUpdate('Step 4/5: Generating Spanish karaoke with corrected LRC timing...');
    const spanishKaraoke = await generateKaraokeFromParsedLrc(
      audioFile,
      correctedLrc,
      'Spanish',
      (msg) => onStatusUpdate(`Step 4/5: ${msg}`),
      modelTier
    );

    // Step 5: Align English translation to Spanish timing
    onStatusUpdate('Step 5/5: Aligning English translation to Spanish timing...');
    const models = getModelNames(modelTier);

    const translationPrompt = buildTranslationAlignmentPrompt(
      spanishKaraoke,
      englishLyrics,
      'Spanish',
      'English'
    );

    const translationApiCall = () => callGeminiProxy(
      models.pro,
      translationPrompt,
      {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
        maxOutputTokens: 65536, // Increased to handle longer songs with many segments
      }
    );

    const translationResponse = await retryWithBackoff(
      translationApiCall, 3, 1000,
      (attempt) => {
        console.warn(`Translation alignment failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Step 5/5: Alignment failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    const translationText = translationResponse.text.trim();
    if (!translationText) {
      throw new Error("The AI model returned an empty response for translation alignment.");
    }

    let englishKaraoke: KaraokeData;
    try {
      englishKaraoke = JSON.parse(translationText);
    } catch (parseError) {
      console.error("Failed to parse JSON response from translation alignment:", translationText);
      throw new Error("The AI model's response for translation was not in the expected JSON format.");
    }

    onStatusUpdate('Bilingual LRC-based generation complete!');

    return {
      spanish: spanishKaraoke,
      english: englishKaraoke,
    };

  } catch (error) {
    console.error("Error during bilingual LRC-based karaoke generation:", error);
    if (error instanceof Error && (
      error.message.includes("JSON format") ||
      error.message.includes("empty response") ||
      error.message.includes("timed out") ||
      error.message.includes("No valid lyric lines")
    )) {
      throw error;
    }
    throw new Error(parseGoogleGenerativeAIError(error));
  }
};

// --- Auto Validation-Guided Refinement ---

export interface AutoRefineProgress {
  iteration: number;
  maxIterations: number;
  problemSegmentCount: number;
  currentScore: number;
  targetScore: number;
  status: 'refining' | 'validating' | 'complete' | 'error';
}

export interface AutoRefineResult {
  karaokeData: KaraokeApiResponse;
  finalValidation: ValidationReport;
  iterations: number;
  improved: boolean;
}

/**
 * Automatically refines karaoke data by identifying problem segments from validation
 * and iteratively refining them until the quality score reaches the target threshold.
 */
export const autoRefineProblems = async (
  audioFile: File,
  karaokeData: KaraokeApiResponse,
  languageFlow: string,
  onStatusUpdate: (message: string) => void,
  onProgress?: (progress: AutoRefineProgress) => void,
  options: {
    targetScore?: number;
    maxIterations?: number;
    includeWarnings?: boolean;
    modelTier?: GeminiModelTier;
  } = {}
): Promise<AutoRefineResult> => {
  const {
    targetScore = 85,
    maxIterations = 3,
    includeWarnings = true,
    modelTier = 'gemini-2.5',
  } = options;

  // Determine language names from flow
  const isSpanishToEnglish = languageFlow === 'es-en';
  const primaryLang = isSpanishToEnglish ? 'Spanish' : 'English';
  const secondaryLang = isSpanishToEnglish ? 'English' : 'Spanish';

  let currentData = karaokeData;
  let currentValidation = validateKaraokeDataPair(currentData.spanish, currentData.english);
  const initialScore = currentValidation.overallScore;

  // Check if already at target
  if (currentValidation.overallScore >= targetScore) {
    onStatusUpdate(`Quality score is already ${currentValidation.overallScore}. No refinement needed.`);
    return {
      karaokeData: currentData,
      finalValidation: currentValidation,
      iterations: 0,
      improved: false,
    };
  }

  onStatusUpdate(`Starting auto-refinement. Current score: ${currentValidation.overallScore}, Target: ${targetScore}`);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    // Extract problem segments
    const problemIndices = extractProblemSegmentIndices(currentValidation, {
      includeWarnings,
      language: 'both',
    });

    const totalProblems = new Set([...problemIndices.spanish, ...problemIndices.english]).size;

    if (totalProblems === 0) {
      onStatusUpdate(`No more problem segments identified. Score: ${currentValidation.overallScore}`);
      break;
    }

    onProgress?.({
      iteration,
      maxIterations,
      problemSegmentCount: totalProblems,
      currentScore: currentValidation.overallScore,
      targetScore,
      status: 'refining',
    });

    onStatusUpdate(
      `Iteration ${iteration}/${maxIterations}: Refining ${totalProblems} problem segment(s)...`
    );

    // Limit segments per batch to avoid response truncation
    const MAX_SEGMENTS_PER_BATCH = 10;

    try {
      // Refine Spanish (primary) if there are issues
      if (problemIndices.spanish.length > 0) {
        // Batch the segments if there are too many
        const spanishBatches: number[][] = [];
        for (let i = 0; i < problemIndices.spanish.length; i += MAX_SEGMENTS_PER_BATCH) {
          spanishBatches.push(problemIndices.spanish.slice(i, i + MAX_SEGMENTS_PER_BATCH));
        }

        for (let batchIdx = 0; batchIdx < spanishBatches.length; batchIdx++) {
          const batch = spanishBatches[batchIdx];
          onStatusUpdate(
            `Refining ${primaryLang} batch ${batchIdx + 1}/${spanishBatches.length} (${batch.length} segment(s))...`
          );
          const refinedSpanish = await refineMarkedSegments(
            audioFile,
            currentData.spanish,
            batch,
            primaryLang,
            onStatusUpdate,
            undefined,
            modelTier
          );
          currentData = { ...currentData, spanish: refinedSpanish };
        }
      }

      // Refine English (secondary) if there are issues
      if (problemIndices.english.length > 0) {
        // Batch the segments if there are too many
        const englishBatches: number[][] = [];
        for (let i = 0; i < problemIndices.english.length; i += MAX_SEGMENTS_PER_BATCH) {
          englishBatches.push(problemIndices.english.slice(i, i + MAX_SEGMENTS_PER_BATCH));
        }

        for (let batchIdx = 0; batchIdx < englishBatches.length; batchIdx++) {
          const batch = englishBatches[batchIdx];
          onStatusUpdate(
            `Refining ${secondaryLang} batch ${batchIdx + 1}/${englishBatches.length} (${batch.length} segment(s))...`
          );
          const refinedEnglish = await refineMarkedSegments(
            audioFile,
            currentData.english,
            batch,
            secondaryLang,
            onStatusUpdate,
            currentData.spanish, // Use Spanish as reference for alignment
            modelTier
          );
          currentData = { ...currentData, english: refinedEnglish };
        }
      }

      // Re-validate
      onProgress?.({
        iteration,
        maxIterations,
        problemSegmentCount: totalProblems,
        currentScore: currentValidation.overallScore,
        targetScore,
        status: 'validating',
      });

      onStatusUpdate('Re-validating refined data...');
      currentValidation = validateKaraokeDataPair(currentData.spanish, currentData.english);

      onStatusUpdate(
        `Iteration ${iteration} complete. Score: ${currentValidation.overallScore} (was ${initialScore})`
      );

      // Check if we've reached target
      if (currentValidation.overallScore >= targetScore) {
        onStatusUpdate(
          `Target score reached! Final score: ${currentValidation.overallScore}`
        );
        break;
      }

    } catch (error) {
      console.error(`Auto-refine iteration ${iteration} failed:`, error);
      onStatusUpdate(
        `Refinement iteration ${iteration} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      onProgress?.({
        iteration,
        maxIterations,
        problemSegmentCount: totalProblems,
        currentScore: currentValidation.overallScore,
        targetScore,
        status: 'error',
      });

      // Continue with next iteration instead of failing completely
      // unless this is the last iteration
      if (iteration === maxIterations) {
        throw error;
      }
    }
  }

  onProgress?.({
    iteration: maxIterations,
    maxIterations,
    problemSegmentCount: 0,
    currentScore: currentValidation.overallScore,
    targetScore,
    status: 'complete',
  });

  const improved = currentValidation.overallScore > initialScore;
  onStatusUpdate(
    `Auto-refinement complete. Score: ${initialScore} → ${currentValidation.overallScore} (${improved ? 'improved' : 'no change'})`
  );

  return {
    karaokeData: currentData,
    finalValidation: currentValidation,
    iterations: maxIterations,
    improved,
  };
};