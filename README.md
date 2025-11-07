# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. The app also features an interactive preview player and a unique **language-learning module** that acts as a cultural linguist, extracting **slang, idioms, and culturally significant vocabulary** from the song's lyrics.

## 🚀 Live Demo

You can try the live application here: **[https://karaoke-syncer-362554121203.us-west1.run.app/](https://karaoke-syncer-362554121203.us-west1.run.app/)**

## ✨ Features

- **High-Accuracy Synchronization**: Utilizes a two-step process with **Gemini 2.5 Pro** and a sophisticated prompt that treats the audio as the "ground truth," allowing it to correct discrepancies between the provided lyrics and the actual performance.
- **Interactive Karaoke Preview**: Instantly verify the synchronization with a built-in player. Watch lyrics highlight word-by-word in real-time, side-by-side in both languages, complete with audio controls, a **real-time audio spectrum visualizer**, and clickable line-seeking to check timing accuracy.
- **AI Refinement Pass**: An optional "review and refine" step where a second AI pass acts as a quality assurance specialist, critiquing and correcting the initial synchronization for the highest possible accuracy.
- **Built-in Diagnostic Tool**: Run a pre-validated test case to verify the preview player's accuracy independently of the AI's output, helping to isolate and debug issues.
- **Word-Level Timing**: Generates start and end timestamps for every single word, enabling precise karaoke-style highlighting.
- **Bilingual Workflow**: Supports both **Spanish ↔ English** processing. You can provide the original audio in either language.
- **AI Lyric Translation**: Includes a built-in translation feature powered by **Gemini 2.5 Flash** to automatically generate the translated lyrics, saving you time.
- **Cultural Vocabulary Learning**: Goes beyond basic translation. The AI acts as a **cultural linguist**, identifying key **Spanish slang, idioms, and colloquialisms** from the lyrics. It provides definitions that explain cultural context, difficulty scores based on nuance (not just rarity), and examples, creating a practical language-learning tool. Download the list as **CSV** or **JSON** for flashcard apps.
- **Live Status Updates**: A visual progress bar and dynamic status messages give you real-time feedback during the AI generation process.
- **Robust API Communication**: Implements an automatic retry mechanism with exponential backoff for all API calls, making the application more resilient to transient network errors.
- **Flexible Export Options**: Download individual karaoke data files (`.json`) and vocabulary lists (`.json`, `.csv`).
- **Modern & Responsive UI**: A clean "glassmorphism" UI built with Tailwind CSS that provides a guided, tabbed experience and works seamlessly on both desktop and mobile devices.

## 🚀 How It Works

The application improves synchronization accuracy by using a sophisticated, multi-step approach that leverages the best model for each task:

1.  **Input**: The user uploads an audio file and provides the original lyrics in either Spanish or English.
2.  **Translate (Optional)**: The user can click the "Translate" button. The application sends the source lyrics to the **Gemini 2.5 Flash** model to get a high-quality translation, which then populates the second text area.
3.  **Generate Step 1: High-Fidelity Timing**: When "Generate Synced Files" is clicked, the app first sends the audio file and the **original lyrics** to the powerful **Gemini 2.5 Pro** model. The prompt instructs the AI to treat the audio as the "ground truth" and to correct any discrepancies in the provided lyrics to match what is actually sung. This creates a highly accurate, "source of truth" timed data file based on the real performance.
4.  **Generate Step 2: Translation Mapping**: The accurately timed data from Step 1 is then sent, along with the translated lyrics, to the fast and efficient **Gemini 2.5 Flash** model. This second, simpler task instructs the AI to map the translated words onto the existing timestamps without re-analyzing the audio, preserving the precise timing.
5.  **Refine (Optional)**: The refinement process is a sophisticated two-step operation designed to maximize accuracy **while preserving the integrity of the user's translation**. This approach was implemented to solve issues where the AI might incorrectly replace a direct translation with a different, more popular version of the song's lyrics.
    1.  **Source Language Correction:** First, the original language data (e.g., Spanish) is reviewed against the audio. The AI has full permission here to correct timing and transcription errors, ensuring the text is a perfect match for all sung vocals, including ad-libs and background singers. This creates a "ground truth" timing map.
    2.  **Translated Language Alignment:** Next, the translated language data (e.g., English) is refined. In this step, the AI's role is highly constrained: it is **strictly forbidden from changing the translated words**. Its sole task is to adjust the *timing* of the existing translation to perfectly match the cadence and rhythm of the now-corrected source language data, ensuring perfect temporal synchronization between the two versions.
6.  **Cultural Vocabulary Extraction**: Immediately following a successful sync, the app makes another targeted call to **Gemini 2.5 Flash**. The prompt instructs the AI to act as a **cultural linguist**, analyzing both sets of lyrics to identify and explain 10-15 of the most significant **Spanish slang terms, idioms, and culturally-nuanced phrases**, returning them in a structured JSON format. This step specifically avoids common textbook vocabulary to provide real-world learning value.
7.  **Preview, Display & Download**: The application parses all responses and presents them in a clean, **tabbed interface** for easy navigation between the Preview Player, the side-by-side Karaoke Data, and the Vocabulary list. All generated files are available for individual download.

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Model**: Google Gemini 2.5 Pro (for audio synchronization & refinement) & Gemini 2.5 Flash (for translation and vocabulary)
- **Libraries**:
  - `@google/genai`: The official Google client library for the Gemini API.

## 📂 Project Structure

```
.
├── index.html          # Main HTML entry point
├── index.tsx           # Renders the React application
├── App.tsx             # Main application component with all UI and state logic
├── services/
│   └── geminiService.ts  # Handles all API calls to the Gemini model
├── types.ts            # TypeScript type definitions
├── test-data.ts        # Contains pre-validated data for the diagnostic tool
├── metadata.json       # Application metadata
└── README.md           # This file
```

## ⚙️ Running Locally

This project is designed to run in a browser-based development environment that can securely provide a Gemini API key.

1.  **Prerequisites**: A modern web browser and an environment that can serve the static files (`index.html`, `index.tsx`, etc.).
2.  **API Key**: The application requires a Google Gemini API key to function. It expects the key to be available in the execution environment as `process.env.API_KEY`.
3.  **Serve the Files**: Use a simple local server to host the project directory. For example, using Python:
    ```bash
    python -m http.server
    ```
4.  **Access**: Open your browser and navigate to the local server's address (e.g., `http://localhost:8000`).

## 📄 License

This project is licensed under the MIT License.