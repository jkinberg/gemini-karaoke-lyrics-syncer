

# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. It also includes a language-learning feature that extracts key vocabulary from the lyrics to help users learn Spanish.

![Karaoke Syncer AI Screenshot](./assets/karaoke-syncer-demo.png)

## ✨ Features

- **AI-Powered Synchronization**: Utilizes the Gemini 2.5 Pro model to analyze an audio file and align lyrics with millisecond precision.
- **Word-Level Timing**: Generates start and end timestamps for every single word, enabling precise karaoke-style highlighting.
- **Bilingual Workflow**: Supports both **Spanish ↔ English** processing. You can provide the original audio in either language.
- **AI Lyric Translation**: Includes a built-in translation feature powered by Gemini 2.5 Flash to automatically generate the translated lyrics, saving you time.
- **Vocabulary Learning**: After generation, the AI identifies key Spanish vocabulary from the lyrics. It provides English definitions, difficulty scores, and contextual examples in a clean table format. You can download this list as a **CSV** or **JSON** file for easy import into flashcard apps.
- **Multi-Format Audio Upload**: Simple drag-and-drop interface for audio files, supporting `MP3`, `WAV`, `M4A`, `FLAC`, `AAC`, `OGG`, `OPUS`, and `3GP`.
- **Proactive Audio Analysis**: Instantly checks the duration of your uploaded audio and warns you if it's over 10 minutes, helping to manage expectations for processing time.
- **Live Status Updates**: A visual progress bar and dynamic status messages give you real-time feedback during the AI generation process.
- **Flexible Export Options**: Download individual karaoke data files (`.json`), vocabulary lists (`.json`, `.csv`), or a single `karaoke_and_vocabulary_data.zip` archive containing all generated files.
- **Fully Responsive**: A clean and modern UI built with Tailwind CSS that works seamlessly on both desktop and mobile devices.

## 🚀 How It Works

The application operates entirely on the client-side, making direct calls to the Gemini API.

1.  **Input**: The user uploads an audio file and provides the original lyrics in either Spanish or English.
2.  **Translate (Optional)**: The user can click the "Translate" button. The application sends the source lyrics to the **Gemini 2.5 Flash** model to get a high-quality translation, which then populates the second text area.
3.  **Generate**: When the "Generate Synced Files" button is clicked:
    a. The audio file is converted to a base64 string.
    b. A detailed, structured prompt is constructed, containing the original and translated lyrics, the desired language flow, and strict instructions for the output format.
    c. The audio data and the prompt are sent to the multimodal **Gemini 2.5 Pro** model.
4.  **Process**: The Gemini model performs a complex analysis of the audio to identify vocal sections, instrumental breaks, and the precise timing of each word in the original language. It then maps these exact timings to the translated words.
5.  **Output**: The model returns a single JSON object containing two complete, synchronized data structures for both the Spanish and English lyrics.
6.  **Vocabulary Extraction**: Immediately following a successful sync, the app makes a second, targeted call to the **Gemini 2.5 Flash** model. It sends the Spanish and English lyrics and asks the AI to act as a language tutor, extracting key vocabulary terms and returning them in a structured JSON format.
7.  **Display & Download**: The application parses both responses, displays the formatted JSON for the karaoke data, shows the vocabulary list in a table, and makes all generated files available for individual download or as a single combined zip archive.

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Model**: Google Gemini 2.5 Pro (for audio synchronization) & Gemini 2.5 Flash (for translation and vocabulary)
- **Libraries**:
  - `@google/genai`: The official Google client library for the Gemini API.
  - `jszip`: For creating the `.zip` archive on the client side.

## 📂 Project Structure

```
.
├── index.html          # Main HTML entry point, includes CDN links and import map
├── index.tsx           # Renders the React application
├── App.tsx             # The main application component with all UI and state logic
├── services/
│   └── geminiService.ts  # Handles all API calls to the Gemini model
├── types.ts            # TypeScript type definitions for the data structures
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