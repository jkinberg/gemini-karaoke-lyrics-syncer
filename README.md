# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. The app also features an interactive preview player and a unique **language-learning module** that acts as a cultural linguist, extracting **slang, idioms, and culturally significant vocabulary** from the song's lyrics.

## 🚀 Live Demo

You can try the live application here: **[https://karaoke-syncer-362554121203.us-west1.run.app/](https://karaoke-syncer-362554121203.us-west1.run.app/)**

## ✨ Features

- **High-Accuracy Synchronization**: Utilizes a two-step process with **Gemini Pro** (2.5 stable or 3.0 preview - user selectable) and a sophisticated prompt that treats the audio as the "ground truth," allowing it to correct discrepancies between the provided lyrics and the actual performance.
- **AI Model Selection**: Choose between Gemini 2.5 (stable, reliable) or Gemini 3.0 Preview (experimental, potentially higher quality) based on your needs.
- **Interactive Karaoke Preview**: Instantly verify the synchronization with a built-in player. Watch lyrics highlight word-by-word in real-time, side-by-side in both languages, complete with audio controls, a **real-time audio spectrum visualizer**, and clickable line-seeking to check timing accuracy.
- **Instant Manual Timing Adjustment**: A powerful, interactive tool to fix synchronization drift. Users can select an anchor point, nudge its timing with millisecond precision while getting **live audio feedback**, and instantly apply the shift to all subsequent lyrics in both languages. This provides precise, tactile control for perfect results.
- **Automatic Quality Validation**: After generation, the app automatically validates the output with a quality score (0-100), detecting errors like overlapping words, timing mismatches, and cross-language inconsistencies.
- **Auto-Fix Issues**: One-click automatic refinement that identifies problem segments from validation and iteratively fixes them until quality reaches the target threshold (85+).
- **AI Refinement Pass**: An optional "review and refine" step where a second AI pass acts as a quality assurance specialist, critiquing and correcting the initial synchronization for the highest possible accuracy.
- **Built-in Diagnostic Tool**: Run a pre-validated test case to verify the preview player's accuracy independently of the AI's output, helping to isolate and debug issues.
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

The application improves synchronization accuracy by using a sophisticated, multi-step approach that leverages the best model for each task:

1.  **Input & Configuration**: The user uploads an audio file, provides the original lyrics in either Spanish or English, and selects their preferred AI model tier (Gemini 2.5 stable or 3.0 preview).
2.  **Translate (Optional)**: The user can click the "Translate" button. The application sends the source lyrics to **Gemini Flash** to get a high-quality translation, which then populates the second text area.
3.  **Generate Step 1: High-Fidelity Timing**: When "Generate Synced Files" is clicked, the app first sends the audio file and the **original lyrics** to **Gemini Pro**. The prompt instructs the AI to treat the audio as the "ground truth" and to correct any discrepancies in the provided lyrics to match what is actually sung. This creates a highly accurate, "source of truth" timed data file based on the real performance.
4.  **Generate Step 2: Translation Mapping**: The accurately timed data from Step 1 is then sent, along with the translated lyrics, to **Gemini Pro**. This second task instructs the AI to map the translated words onto the existing timestamps without re-analyzing the audio, preserving the precise timing while reliably handling complex word-mapping scenarios.
5.  **Automatic Validation**: The generated data is automatically validated with a quality score (0-100). The validation checks for critical errors (overlapping words, invalid timing), warnings (unusually long/short words, large gaps), and cross-language consistency (segment alignment between Spanish and English).
6.  **Auto-Fix Issues (Optional)**: If the quality score is below 85, an "Auto-Fix Issues" button appears. Clicking it automatically:
    *   Identifies all problem segments from validation results
    *   Refines those segments using the AI
    *   Re-validates the results
    *   Repeats up to 3 times until quality threshold is reached
7.  **Manual Refinement (Optional)**:
    *   **Segment-Focused AI Refinement:** Mark specific segments that need improvement and run targeted AI refinement on just those segments.
    *   **Manual Timing Adjustment:** For ultimate precision, nudge timing with millisecond precision and propagate shifts to subsequent lines.
8.  **Cultural Vocabulary Extraction**: The app can generate vocabulary lists by calling **Gemini Flash** to act as a **cultural linguist**, analyzing both sets of lyrics to identify and explain 10-15 of the most significant **Spanish slang terms, idioms, and culturally-nuanced phrases** with precise timecodes for interactive playback.
9.  **Preview, Display & Download**: The application parses all responses and presents them in a clean, **tabbed interface** for easy navigation between the Preview Player, the side-by-side Karaoke Data, and the Vocabulary list. All generated files are available for individual download.

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
│   ├── geminiService.ts  # API calls, auto-refinement logic
│   └── validationService.ts  # Quality validation, problem detection
├── types.ts              # TypeScript type definitions
├── test-data.ts          # Contains pre-validated data for the diagnostic tool
├── vite.config.ts        # Vite configuration with dev proxy
├── Dockerfile            # Production container build
├── .env.example          # Environment variable template
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