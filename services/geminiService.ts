import { GoogleGenAI, Type } from "@google/genai";
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
          error.message.includes("empty response")
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


const singleLanguageSchema = {
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

const buildTranslationAlignmentPrompt = (timedOriginalData: KaraokeData, translatedLyrics: string, originalLangName: string, translatedLangName: string): string => {
  return `
You are a precise text-transformation engine. Your task is to create a translated karaoke data file by mapping translated lyrics onto an existing, perfectly timed data structure.

**Constraint:** You MUST use the exact same temporal data (\`startTimeMs\`, \`endTimeMs\`, and segment structure) from the provided "Original Timed Data". Do NOT alter any timing values.

**Input Data:**

1.  **Original Timed Data (${originalLangName} JSON):**
    \`\`\`json
    ${JSON.stringify(timedOriginalData, null, 2)}
    \`\`\`

2.  **Raw Translated Lyrics (${translatedLangName} Text):**
    ---
    ${translatedLyrics}
    ---

**Task Instructions:**

1.  **Map Translation:** Go through the "Original Timed Data" segment by segment.
2.  **Substitute Text:** For each segment, replace the ${originalLangName} text fields (\`text\`, \`word\`, \`cueText\`) with their corresponding ${translatedLangName} translations from the "Raw Translated Lyrics".
3.  **Preserve Timings:** Keep all \`startTimeMs\`, \`endTimeMs\`, \`segmentIndex\`, and \`type\` fields identical to the original data.
4.  **Update Metadata:** Change the \`metadata.language\` field to reflect the new language code ('en-US' or 'es-ES').

**Output Format:**
You MUST return a single, minified JSON object for the ${translatedLangName} version, strictly following the same schema as the input JSON. Do not include any other text, explanations, or markdown.
`;
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
    onStatusUpdate(`Step 1/2: Preparing audio and ${originalLangName} lyrics for the AI...`);
    const audioPart = await fileToGenerativePart(audioFile);
    const primaryPrompt = buildSingleLanguagePrompt(originalLyrics, originalLangName);
    const primaryTextPart = { text: primaryPrompt };

    const primaryModel = 'gemini-2.5-pro';
    
    onStatusUpdate(`Step 1/2: Sending data to the AI. This is the longest step and may take up to 5 minutes...`);
    
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
        onStatusUpdate(`Step 1/2: Request failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The request timed out after 5 minutes. This is common for longer songs. Please check your inputs or try again.")), 300000)
    );

    const primaryResponse = await Promise.race([primaryApiCallPromise, timeoutPromise]);
    
    onStatusUpdate('Step 1/2: Received response, parsing original language data...');
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
    onStatusUpdate(`Step 2/2: Aligning ${translatedLangName} translation...`);
    
    const translationPrompt = buildTranslationAlignmentPrompt(originalTimedData, translatedLyrics, originalLangName, translatedLangName);
    const translationModel = 'gemini-2.5-flash';

    const translationApiCall = () => ai.models.generateContent({
        model: translationModel,
        contents: translationPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: singleLanguageSchema,
        },
    });

    const translationResponse = await retryWithBackoff(
      translationApiCall, 3, 1000,
      (attempt) => {
        console.warn(`Translation alignment API call failed on attempt ${attempt}. Retrying...`);
        onStatusUpdate(`Step 2/2: Request failed, retrying... (Attempt ${attempt + 1}/3)`);
      }
    );

    onStatusUpdate('Step 2/2: Received response, parsing translated language data...');
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
    throw new Error("An API error occurred while processing the request. Please check your network connection and API key settings, or try again later.");
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
    throw new Error("An API error occurred during translation. Please try again.");
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
You are an expert language tutor specializing in teaching Spanish to native English speakers.
Your task is to analyze a set of song lyrics and extract key vocabulary words that would be most beneficial for an intermediate learner.

**Input Data:**
- Spanish Lyrics:
  ---
  ${spanishLyrics}
  ---
- English Lyrics (for context):
  ---
  ${englishLyrics}
  ---

**Task Instructions:**

1.  Identify 10-15 key Spanish vocabulary terms from the lyrics. Focus on words that are common, useful, or represent important concepts in the song.
2.  For each term, provide the following information:
    - \`term\`: An object containing the Spanish word in its base form (\`spanish\`) and its direct, corresponding English translation (\`english\`).
    - \`definition\`: A concise and accurate English definition of the Spanish term.
    - \`difficulty\`: An integer score from 1 (very common, beginner) to 10 (rare, advanced) representing the word's difficulty for an English speaker.
    - \`example\`: An object containing the full, original line from the Spanish lyrics where the word appears (\`spanish\`) and its corresponding English translation (\`english\`).
    - \`highlight\`: An object containing the exact Spanish word as it appears in the example sentence (\`spanish\`), and its corresponding English translated word (\`english\`). This is crucial for accurate highlighting.

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
    throw new Error("An API error occurred while generating the vocabulary list. This feature may not be available right now.");
  }
};