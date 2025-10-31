# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. The app also features an interactive preview player, allowing you to watch the synchronized lyrics in real-time, and a language-learning module that extracts key vocabulary from the lyrics.

## 🚀 Live Demo

You can try the live application here: **[https://karaoke-syncer-362554121203.us-west1.run.app/](https://karaoke-syncer-362554121203.us-west1.run.app/)**

## ✨ Features

- **High-Accuracy Synchronization**: Utilizes a two-step process with **Gemini 2.5 Pro** and a sophisticated prompt that treats the audio as the "ground truth," allowing it to correct discrepancies between the provided lyrics and the actual performance.
- **Interactive Karaoke Preview**: Instantly verify the synchronization with a built-in player. Watch lyrics highlight word-by-word in real-time, side-by-side in both languages, complete with audio controls and clickable line-seeking to check timing accuracy.
- **Built-in Diagnostic Tool**: Run a pre-validated test case to verify the preview player's accuracy independently of the AI's output, helping to isolate and debug issues.
- **Word-Level Timing**: Generates start and end timestamps for every single word, enabling precise karaoke-style highlighting.
- **Bilingual Workflow**: Supports both **Spanish ↔ English** processing. You can provide the original audio in either language.
- **AI Lyric Translation**: Includes a built-in translation feature powered by **Gemini 2.5 Flash** to automatically generate the translated lyrics, saving you time.
- **Vocabulary Learning**: After generation, the AI identifies key Spanish vocabulary from the lyrics. It provides English definitions, difficulty scores, and contextual examples in a clean table format. You can download this list as a **CSV** or **JSON** file for easy import into flashcard apps.
- **Multi-Format Audio Upload**: Simple drag-and-drop interface for audio files, supporting `MP3`, `WAV`, `M4A`, `FLAC`, `AAC`, `OGG`, `OPUS`, and `3GP`.
- **Live Status Updates**: A visual progress bar and dynamic status messages give you real-time feedback during the AI generation process.
- **Robust API Communication**: Implements an automatic retry mechanism with exponential backoff for all API calls, making the application more resilient to transient network errors.
- **Flexible Export Options**: Download individual karaoke data files (`.json`), vocabulary lists (`.json`, `.csv`), or a single `karaoke_and_vocabulary_data.zip` archive containing all generated files.
- **Fully Responsive**: A clean and modern UI built with Tailwind CSS that works seamlessly on both desktop and mobile devices.

## 🚀 How It Works

The application improves synchronization accuracy by using a sophisticated, two-step "divide and conquer" approach that leverages the best model for each task:

1.  **Input**: The user uploads an audio file and provides the original lyrics in either Spanish or English.
2.  **Translate (Optional)**: The user can click the "Translate" button. The application sends the source lyrics to the **Gemini 2.5 Flash** model to get a high-quality translation, which then populates the second text area.
3.  **Generate Step 1: High-Fidelity Timing**: When "Generate Synced Files" is clicked, the app first sends the audio file and the **original lyrics** to the powerful **Gemini 2.5 Pro** model. The prompt instructs the AI to treat the audio as the "ground truth" and to correct any discrepancies in the provided lyrics to match what is actually sung. This creates a highly accurate, "source of truth" timed data file based on the real performance.
4.  **Generate Step 2: Translation Mapping**: The accurately timed data from Step 1 is then sent, along with the translated lyrics, to the fast and efficient **Gemini 2.5 Flash** model. This second, simpler task instructs the AI to map the translated words onto the existing timestamps without re-analyzing the audio, preserving the precise timing.
5.  **Vocabulary Extraction**: Immediately following a successful sync, the app makes another targeted call to **Gemini 2.5 Flash**. It sends the lyrics and asks the AI to act as a language tutor, extracting key vocabulary terms and returning them in a structured JSON format.
6.  **Preview, Display & Download**: The application parses all responses. Users can immediately test the result in the **interactive preview player**. The raw JSON data is also displayed, the vocabulary list is shown in a table, and all generated files are made available for individual download or as a single combined zip archive.

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Model**: Google Gemini 2.5 Pro (for audio synchronization) & Gemini 2.5 Flash (for translation and vocabulary)
- **Libraries**:
  - `@google/genai`: The official Google client library for the Gemini API.
  - `jszip`: For creating the `.zip` archive on the client side.

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