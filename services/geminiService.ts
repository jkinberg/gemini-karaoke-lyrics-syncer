import { GoogleGenAI, Type } from "@google/genai";
import { KaraokeApiResponse, VocabularyItem } from '../types';

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


const buildPrompt = (originalLyrics: string, translatedLyrics: string, languageFlow: 'es-en' | 'en-es'): string => {
  const isEsToEn = languageFlow === 'es-en';
  const originalLangName = isEsToEn ? 'Spanish' : 'English';
  const translatedLangName = isEsToEn ? 'English' : 'Spanish';
  
  return `
You are a professional Audio Alignment and Translation Engine. Your task is to generate a pair of synchronized karaoke lyric data files (${originalLangName} and ${translatedLangName}) based on an audio file and provided lyrics.

**Constraint:** Both generated files MUST use the exact same temporal data (startTimeMs and endTimeMs) derived from the ${originalLangName} vocal track in the provided audio. The ${translatedLangName} translation will use the timing of the ${originalLangName} words they correspond to.

**Input Data:**
- Audio File: [Provided in the request]
- Raw ${originalLangName} Lyrics (Original):
  ---
  ${originalLyrics}
  ---
- Raw ${translatedLangName} Lyrics (Translation):
  ---
  ${translatedLyrics}
  ---

**Task Instructions:**

1.  **Primary Alignment (${originalLangName}):** Analyze the provided audio and align the ${originalLangName} lyrics to the vocal track with millisecond precision (all time values must be integers).
2.  **Segment the Song:** Segment the entire song into a \`segments\` array, identifying every portion as either "LYRIC" or "INSTRUMENTAL" based on the audio.
    - For LYRIC segments: Include word-level timing for every word, preserving natural gaps based on the audio.
    - For INSTRUMENTAL segments: Create instrumental breaks (like an intro, outro, or solo) based on the audio and provide a descriptive ${originalLangName} \`cueText\`.
3.  **Synchronize (${translatedLangName}):** Generate the ${translatedLangName} file by performing a one-to-one word substitution, strictly using the EXACT \`startTimeMs\` and \`endTimeMs\` values determined in the ${originalLangName} alignment from the audio.
    - For LYRIC segments: Substitute the ${originalLangName} \`word\` and \`text\` fields with the ${translatedLangName} translations.
    - For INSTRUMENTAL segments: Substitute the ${originalLangName} \`cueText\` with an appropriate ${translatedLangName} translation.

**Output Format:**

You MUST return a single, minified JSON object with two top-level keys: "spanish" and "english". Each key should contain a JSON object that strictly follows this schema:

\`\`\`json
{
  "metadata": {
    "title": "Song Title",
    "artist": "Artist Name",
    "durationMs": 180000,
    "language": "es-ES" or "en-US",
    "version": "1.1"
  },
  "segments": [
    {
      "type": "INSTRUMENTAL",
      "startTimeMs": 0,
      "endTimeMs": 5000,
      "cueText": "Intro",
      "segmentIndex": 1
    },
    {
      "type": "LYRIC",
      "startTimeMs": 5500,
      "endTimeMs": 9900,
      "text": "This is the first phrase",
      "segmentIndex": 2,
      "words": [
        { "word": "This", "startTimeMs": 5500, "endTimeMs": 5900 },
        { "word": "is", "startTimeMs": 6100, "endTimeMs": 6450 }
      ]
    }
  ]
}
\`\`\`

Do not include any other text, explanations, or markdown formatting in your response. Only the single JSON object is allowed.
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
  const model = 'gemini-2.5-pro';

  const prompt = buildPrompt(originalLyrics, translatedLyrics, languageFlow);
  
  onStatusUpdate('Preparing audio file for the AI...');
  const audioPart = await fileToGenerativePart(audioFile);
  const textPart = { text: prompt };

  try {
    onStatusUpdate('Sending audio and lyrics to the AI model...');
    const apiCallPromise = ai.models.generateContent({
      model: model,
      contents: [{ parts: [textPart, audioPart] }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("The request timed out after 5 minutes. This is common for longer songs. Please check your inputs or try again.")), 300000)
    );
    
    // Set status *before* starting the race
    onStatusUpdate('AI is analyzing the audio. This is the longest step and may take up to 5 minutes for a typical song...');
    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    
    onStatusUpdate('Received response, parsing JSON data...');
    const text = response.text.trim();
    if (!text) {
        throw new Error("The AI model returned an empty response. This could be due to a content safety filter or an issue with the provided audio/lyrics.");
    }

    try {
        // Find the start and end of the main JSON object to handle malformed responses
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
            throw new Error("Could not find a valid JSON object in the model's response.");
        }
        const jsonStr = text.substring(startIndex, endIndex + 1);
        
        const parsedJson = JSON.parse(jsonStr);
        onStatusUpdate('Success! Finalizing results...');
        return parsedJson as KaraokeApiResponse;
    } catch (parseError) {
        console.error("Failed to parse JSON response from model:", text);
        throw new Error("The AI model's response was not in the expected JSON format. Please try adjusting your lyrics or try again.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && (error.message.includes("JSON format") || error.message.includes("empty response") || error.message.includes("timed out") || error.message.includes("valid JSON object"))) {
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
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
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
    - \`term\`: The Spanish word in its base form (e.g., infinitive for verbs, singular for nouns).
    - \`definition\`: A concise and accurate English definition.
    - \`difficulty\`: An integer score from 1 (very common, beginner) to 10 (rare, advanced) representing the word's difficulty for an English speaker.
    - \`example\`: The full, original line from the Spanish lyrics where the word appears, to provide context.

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
          type: Type.STRING,
          description: 'The Spanish word in its base form (e.g., infinitive for verbs, singular for nouns).',
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
          type: Type.STRING,
          description: 'The full, original line from the Spanish lyrics where the word appears.',
        },
      },
      required: ['term', 'definition', 'difficulty', 'example'],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
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
