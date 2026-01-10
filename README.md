# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. The app also features an interactive preview player and a unique **language-learning module** that acts as a cultural linguist, extracting **slang, idioms, and culturally significant vocabulary** from the song's lyrics.

## 🚀 Live Demo

You can try the live application here: **[https://karaoke-syncer-362554121203.us-west1.run.app/](https://karaoke-syncer-362554121203.us-west1.run.app/)**

## ✨ Features

- **LRC-Based Synchronization**: Upload or paste LRC files (with `[mm:ss.xx]` timestamps) for fast, highly accurate word-level synchronization. The app verifies and corrects LRC timestamps against the actual audio, then uses the corrected timing as anchors.
- **LRC Timestamp Correction**: A dedicated AI pass verifies each LRC line's timing against the audio, correcting drift that accumulates when timestamps are off. Also detects non-lyric sections (intros, interludes, skits, outros) common in YouTube music videos.
- **High-Accuracy Synchronization**: Uses **Gemini Pro** with LRC timestamps as the primary timing guide, distributing words within each segment based on audio analysis.
- **AI Model Selection**: Gemini 3.0 (default/recommended) or Gemini 2.5 (stable fallback).
- **Interactive Karaoke Preview**: Instantly verify the synchronization with a built-in player. Watch lyrics highlight word-by-word in real-time, side-by-side in both languages, complete with audio controls, a **real-time audio spectrum visualizer**, and clickable line-seeking to check timing accuracy.
- **Automatic Quality Validation**: After generation, the app automatically validates the output with a quality score (0-100), detecting errors like overlapping words, timing mismatches, and cross-language inconsistencies.
- **Auto-Fix Issues**: One-click automatic refinement that identifies problem segments from validation and iteratively fixes them until quality reaches the target threshold (85+).
- **AI Refinement Pass**: An optional "review and refine" step where a second AI pass acts as a quality assurance specialist, critiquing and correcting the initial synchronization for the highest possible accuracy.
- **Word-Level Timing**: Generates start and end timestamps for every single word, enabling precise karaoke-style highlighting.
- **Bilingual Workflow**: Supports both **Spanish ↔ English** processing. You can provide the original audio in either language.
- **AI Lyric Translation**: Includes a built-in translation feature powered by **Gemini Flash** to automatically generate the translated lyrics, saving you time.
- **Cultural Vocabulary Learning**: Goes beyond basic translation. The AI acts as a **cultural linguist**, identifying key **Spanish slang, idioms, and colloquialisms** from the lyrics. It provides definitions that explain cultural context, difficulty scores based on nuance (not just rarity), and examples.
- **Interactive Vocabulary Playback**: Each vocabulary item includes a play button that seeks the audio to the precise moment the term is sung, providing instant auditory context for pronunciation and rhythm. Download the list as **CSV** or **JSON** for flashcard apps.
- **Live Status Updates**: A visual progress bar and dynamic status messages give you real-time feedback during the AI generation process.
- **Robust API Communication**: Implements an automatic retry mechanism with exponential backoff for all API calls, making the application more resilient to transient network errors.
- **Flexible Export Options**: Download individual karaoke data files (`.json`) and vocabulary lists (`.json`, `.csv`).
- **Modern & Responsive UI**: A clean "glassmorphism" UI built with Tailwind CSS that provides a guided, tabbed experience and works seamlessly on both desktop and mobile devices.

## 🚀 How It Works

The application uses LRC files (with line-level timestamps) as the foundation for fast, accurate synchronization:

1.  **Input & Configuration**: The user uploads an audio file, pastes or uploads LRC content (auto-detected by `[mm:ss.xx]` format), and selects their preferred AI model tier (Gemini 3.0 recommended).
2.  **LRC Parsing**: The app parses the LRC file to extract lyrics with line-level timestamps.
3.  **LRC Timestamp Correction**: **Gemini Pro** verifies each line's timing against the actual audio:
    *   Corrects timestamps that have drifted from the audio
    *   Detects non-lyric sections (intros, interludes, skits, outros) common in YouTube music videos
    *   Returns corrected line boundaries for accurate word distribution
4.  **Auto-Translation**: The Spanish lyrics are automatically translated to English using **Gemini Flash**.
5.  **Generate Spanish Karaoke**: **Gemini Pro** uses the corrected LRC timestamps as anchors:
    *   Distributes words within each corrected line boundary based on audio analysis
    *   Inserts detected instrumental sections at appropriate positions
6.  **Generate English Karaoke**: The translated lyrics are aligned to match the Spanish segment structure.
7.  **Automatic Validation**: The generated data is validated with a quality score (0-100), checking for overlapping words, timing issues, and cross-language consistency.
8.  **Auto-Fix Issues (Optional)**: If the quality score is below 85, one-click refinement identifies and fixes problem segments (up to 3 iterations).
9.  **Segment-Focused Refinement (Optional)**: Mark specific segments for targeted AI re-analysis.
10. **Cultural Vocabulary Extraction**: Generate vocabulary lists with **Gemini Flash** acting as a **cultural linguist**, identifying Spanish slang, idioms, and culturally-nuanced phrases with precise timecodes.
11. **Preview & Download**: Navigate the tabbed interface to preview, view data, and download files.

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS
- **Backend**: Express 4 (API proxy server)
- **Build**: Vite 6
- **AI Models**:
  - Gemini Pro (2.5 or 3.0 preview) for audio synchronization & refinement
  - Gemini Flash (2.5 or 3.0 preview) for translation and vocabulary
- **Libraries**:
  - `@google/genai`: The official Google client library for the Gemini API
  - `jszip`: For creating downloadable zip archives

## 📂 Project Structure

```
.
├── index.html            # Main HTML entry point
├── index.tsx             # Renders the React application
├── App.tsx               # Main application component with all UI and state logic
├── server.ts             # Express server with Gemini API proxy
├── services/
│   ├── geminiService.ts  # API calls, LRC generation, auto-refinement logic
│   ├── lrcParser.ts      # LRC file parsing and format detection
│   └── validationService.ts  # Quality validation, problem detection
├── types.ts              # TypeScript type definitions
├── test-data.ts          # Contains pre-validated data for the diagnostic tool
├── vite.config.ts        # Vite configuration with dev proxy
├── Dockerfile            # Production container build
├── .env.example          # Environment variable template
├── samples/              # Sample LRC files and generated karaoke data
└── docs/                 # Technical specifications
```

## ⚙️ Running Locally

### Prerequisites
- Node.js 20+
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Start the development servers** (requires two terminals):

   **Terminal 1 - Express API server:**
   ```bash
   npm run dev:server
   ```

   **Terminal 2 - Vite frontend:**
   ```bash
   npm run dev
   ```

4. **Access** the application at `http://localhost:3000`

### Architecture Note

The application uses a **server-side proxy** to keep the Gemini API key secure. The Express server (`server.ts`) handles all API calls to Gemini, so the API key never reaches the browser. In development, Vite proxies `/api` requests to the Express server running on port 8080.

### Production Build

```bash
npm run build   # Build frontend + server
npm run start   # Run production server on port 8080
```

## 📄 License

This project is licensed under the MIT License.