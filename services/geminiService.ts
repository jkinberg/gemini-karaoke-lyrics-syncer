// FIX: Import GenerateContentResponse to correctly type API call results.
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { KaraokeApiResponse, KaraokeData, VocabularyItem } from '../types';

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
  return `
You are a precise text-transformation engine. Your task is to create a translated karaoke data file by mapping translated lyrics onto an existing, perfectly timed data structure.

**Constraint:** You MUST use the exact same segment structure from the provided "Original Timed Data". Do NOT alter segment-level timings.

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


const buildRefinementPrompt = (draftKaraokeData: KaraokeData, langName: string): string => {
  return `
You are a meticulous Quality Assurance specialist for AI-generated audio-to-text synchronization. Your task is to review a "draft" synchronized karaoke file against its source audio, identify any timing or text inaccuracies, and return a complete, corrected version.

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
  return `
You are a precise Temporal Alignment Specialist for multilingual karaoke. Your task is to adjust the timing of a translated lyric file to match a perfectly timed original version, using the audio as a reference for rhythm and cadence.

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
): Promise<KaraokeApiResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isEsToEn = languageFlow === 'es-en';
  const originalLangName = isEsToEn ? 'Spanish' : 'English';
  const translatedLangName = isEsToEn ? 'English' : 'Spanish';

  try {
    // --- STEP 1: Generate accurately timed data for the original language ---
    onStatusUpdate(`Step 1/2: Preparing audio and ${originalLangName} lyrics for analysis...`);
    const audioPart = await fileToGenerativePart(audioFile);
    const primaryPrompt = buildSingleLanguagePrompt(originalLyrics, originalLangName);
    const primaryTextPart = { text: primaryPrompt };

    const primaryModel = 'gemini-2.5-pro';
    
    onStatusUpdate(`Step 1/2: Analyzing audio waveform and aligning ${originalLangName} lyrics. This is the longest step and may take up to 5 minutes...`);
    
    const primaryApiCall = () => ai.models.generateContent({
      model: primaryModel,
      contents: [{ parts: [primaryTextPart, audioPart] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
      },
    });
    
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

    // FIX: Explicitly type the API response to resolve 'unknown' type from Promise.race.
    const primaryResponse: GenerateContentResponse = await Promise.race([primaryApiCallPromise, timeoutPromise]);
    
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
    // FIX: Upgraded to gemini-2.5-pro for more reliable and complex JSON manipulation.
    const translationModel = 'gemini-2.5-pro';

    const translationApiCall = () => ai.models.generateContent({
        model: translationModel,
        contents: translationPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: singleLanguageSchema,
        },
    });

    // FIX: Explicitly type the API response to resolve 'unknown' type.
    const translationResponse: GenerateContentResponse = await retryWithBackoff(
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
): Promise<KaraokeData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    onStatusUpdate('Preparing audio for analysis...');
    const audioPart = await fileToGenerativePart(audioFile);
    
    onStatusUpdate('Constructing AI review prompt...');
    const refinementPrompt = buildRefinementPrompt(karaokeDataToRefine, languageName);
    const textPart = { text: refinementPrompt };
    
    const model = 'gemini-2.5-pro';
    onStatusUpdate(`Sending data to AI for quality review. This can take several minutes...`);

    const apiCall = () => ai.models.generateContent({
      model: model,
      contents: [{ parts: [textPart, audioPart] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
      },
    });

    const apiCallPromise = retryWithBackoff(
      apiCall, 3, 2000,
      (attempt) => {
        console.warn(`Refinement API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Refinement failed, attempting to reconnect... (Attempt ${attempt + 1}/3)`);
      }
    );
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The refinement request timed out after 5 minutes.")), 300000)
    );
    
    // FIX: Explicitly type the API response to resolve 'unknown' type from Promise.race.
    const response: GenerateContentResponse = await Promise.race([apiCallPromise, timeoutPromise]);
    
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
): Promise<KaraokeData> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    
    const model = 'gemini-2.5-pro';
    onStatusUpdate(`Sending data to AI for timing alignment. This can take several minutes...`);

    const apiCall = () => ai.models.generateContent({
      model: model,
      contents: [{ parts: [textPart, audioPart] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: singleLanguageSchema,
      },
    });

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
    
    const response: GenerateContentResponse = await Promise.race([apiCallPromise, timeoutPromise]);
    
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

export const translateLyrics = async (
  sourceText: string,
  sourceLang: 'es' | 'en',
  targetLang: 'es' | 'en'
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

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
    const apiCall = () => ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    // FIX: Explicitly type the API response to resolve 'unknown' type.
    const response: GenerateContentResponse = await retryWithBackoff(apiCall, 3, 1000, (attempt) => {
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
  spanishLyrics: string,
  englishLyrics: string,
): Promise<VocabularyItem[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

  const prompt = `
You are an expert cultural linguist, specializing in teaching the nuances of modern Spanish slang and idioms to English speakers through popular music.
Your task is to analyze a song's lyrics and extract the most culturally significant vocabulary, prioritizing slang and phrases that a typical textbook would miss.

**Input Data:**
- Spanish Lyrics:
  ---
  ${spanishLyrics}
  ---
- English Lyrics (for contextual understanding):
  ---
  ${englishLyrics}
  ---

**Core Mission: Uncover the "Street Smarts"**

Your goal is to identify 10-15 Spanish terms or phrases from the lyrics that are prime examples of:
-   **Popular Slang & Colloquialisms:** Words or phrases used in informal, everyday conversation.
-   **Idiomatic Expressions:** Phrases where the meaning isn't deducible from the individual words (e.g., "tomar el pelo").
-   **Culturally-Specific Context:** Words that have a deeper meaning or connotation within the culture that might be lost in a direct translation.
-   **Poetic or Figurative Language:** Metaphors or creative word uses that are key to the song's artistic expression.

**Crucially, AVOID simple, common vocabulary** that would be found in a beginner's textbook (e.g., avoid words like 'y', 'el', 'casa', 'ser', 'estar' unless they are used in a very unique idiomatic way).

**Task Instructions:**

For each identified term/phrase, provide the following structured information:

-   \`term\`: An object containing the Spanish term/phrase (\`spanish\`) and its closest English equivalent (\`english\`), which might be a literal translation or a slang equivalent.
-   \`definition\`: This is the most important part. Provide a clear English explanation of the term's literal meaning AND its contextual, slang, or idiomatic usage in the song. Explain *why* it's interesting, what cultural subtext it carries, or how a native speaker would interpret it in this context.
-   \`difficulty\`: An integer from 1 to 10. This score should not represent how common the word is, but rather how *non-obvious* its meaning is to a non-native speaker. A 1 would be slightly nuanced, while a 10 would be a very specific or obscure slang term that is almost impossible to guess.
-   \`example\`: An object containing the full, original line from the Spanish lyrics where the word appears (\`spanish\`) and its corresponding English translation (\`english\`).
-   \`highlight\`: An object containing the exact Spanish word/phrase as it appears in the example sentence (\`spanish\`), and its corresponding English translated word/phrase (\`english\`). This is crucial for accurate highlighting.

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
      },
      required: ['term', 'definition', 'difficulty', 'example', 'highlight'],
    },
  };

  try {
    const apiCall = () => ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
    
    // FIX: Explicitly type the API response to resolve 'unknown' type.
    const response: GenerateContentResponse = await retryWithBackoff(apiCall, 3, 1000, (attempt) => {
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