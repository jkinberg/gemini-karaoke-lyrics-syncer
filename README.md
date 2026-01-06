# Karaoke Syncer AI

Karaoke Syncer AI is a powerful web-based tool that leverages the Google Gemini model to automatically generate perfectly synchronized, word-level karaoke lyric files from an audio track and raw text lyrics. It supports both Spanish and English, provides AI-powered translation, and exports the data in a clean, developer-friendly JSON format. The app also features an interactive preview player and a unique **language-learning module** that acts as a cultural linguist, extracting **slang, idioms, and culturally significant vocabulary** from the song's lyrics.

## 🚀 Live Demo

You can try the live application here: **[https://karaoke-syncer-362554121203.us-west1.run.app/](https://karaoke-syncer-362554121203.us-west1.run.app/)**

## ✨ Features

- **High-Accuracy Synchronization**: Utilizes a two-step process with **Gemini 2.5 Pro** and a sophisticated prompt that treats the audio as the "ground truth," allowing it to correct discrepancies between the provided lyrics and the actual performance.
- **Interactive Karaoke Preview**: Instantly verify the synchronization with a built-in player. Watch lyrics highlight word-by-word in real-time, side-by-side in both languages, complete with audio controls, a **real-time audio spectrum visualizer**, and clickable line-seeking to check timing accuracy.
- **Instant Manual Timing Adjustment**: A powerful, interactive tool to fix synchronization drift. Users can select an anchor point, nudge its timing with millisecond precision while getting **live audio feedback**, and instantly apply the shift to all subsequent lyrics in both languages. This provides precise, tactile control for perfect results.
- **AI Refinement Pass**: An optional "review and refine" step where a second AI pass acts as a quality assurance specialist, critiquing and correcting the initial synchronization for the highest possible accuracy.
- **Built-in Diagnostic Tool**: Run a pre-validated test case to verify the preview player's accuracy independently of the AI's output, helping to isolate and debug issues.
- **Word-Level Timing**: Generates start and end timestamps for every single word, enabling precise karaoke-style highlighting.
- **Bilingual Workflow**: Supports both **Spanish ↔ English** processing. You can provide the original audio in either language.
- **AI Lyric Translation**: Includes a built-in translation feature powered by **Gemini 2.5 Flash** to automatically generate the translated lyrics, saving you time.
- **Cultural Vocabulary Learning**: Goes beyond basic translation. The AI acts as a **cultural linguist**, identifying key **Spanish slang, idioms, and colloquialisms** from the lyrics. It provides definitions that explain cultural context, difficulty scores based on nuance (not just rarity), and examples.
- **Interactive Vocabulary Playback**: Each vocabulary item includes a play button that seeks the audio to the precise moment the term is sung, providing instant auditory context for pronunciation and rhythm. Download the list as **CSV** or **JSON** for flashcard apps.
- **Live Status Updates**: A visual progress bar and dynamic status messages give you real-time feedback during the AI generation process.
- **Robust API Communication**: Implements an automatic retry mechanism with exponential backoff for all API calls, making the application more resilient to transient network errors.
- **Flexible Export Options**: Download individual karaoke data files (`.json`) and vocabulary lists (`.json`, `.csv`).
- **Modern & Responsive UI**: A clean "glassmorphism" UI built with Tailwind CSS that provides a guided, tabbed experience and works seamlessly on both desktop and mobile devices.

## 🚀 How It Works

The application improves synchronization accuracy by using a sophisticated, multi-step approach that leverages the best model for each task:

1.  **Input**: The user uploads an audio file and provides the original lyrics in either Spanish or English.
2.  **Translate (Optional)**: The user can click the "Translate" button. The application sends the source lyrics to the **Gemini 2.5 Flash** model to get a high-quality translation, which then populates the second text area.
3.  **Generate Step 1: High-Fidelity Timing**: When "Generate Synced Files" is clicked, the app first sends the audio file and the **original lyrics** to the powerful **Gemini 2.5 Pro** model. The prompt instructs the AI to treat the audio as the "ground truth" and to correct any discrepancies in the provided lyrics to match what is actually sung. This creates a highly accurate, "source of truth" timed data file based on the real performance.
4.  **Generate Step 2: Translation Mapping**: The accurately timed data from Step 1 is then sent, along with the translated lyrics, to the powerful **Gemini 2.5 Pro** model. This second task instructs the AI to map the translated words onto the existing timestamps without re-analyzing the audio, preserving the precise timing while reliably handling complex word-mapping scenarios.
5.  **Refine & Adjust**:
    *   **Initial AI Refinement (Optional):** The application offers a powerful two-step AI refinement process. First, it corrects the original language data against the audio to create a "ground truth" timing map. Then, it performs a timing-only alignment on the translated language, ensuring your translation text is never altered.
    *   **Manual Timing Adjustment:** For ultimate precision, the app includes an interactive manual adjustment tool. If you notice any synchronization drift, you can select the exact line where it starts, set it as an "anchor," and nudge its timing with millisecond precision. The audio player seeks in real-time with your adjustments, giving you instant feedback. Once you apply the shift, it's instantly propagated to all subsequent lines in both languages, providing a fast and guaranteed fix.
6.  **Cultural Vocabulary Extraction**: Immediately following a successful sync, the app makes another targeted call to **Gemini 2.5 Flash**. The prompt instructs the AI to act as a **cultural linguist**, analyzing both sets of lyrics to identify and explain 10-15 of the most significant **Spanish slang terms, idioms, and culturally-nuanced phrases**. **Crucially, the prompt also requires the AI to find the precise start and end timecodes for the highlighted phrase**, enabling the interactive playback feature in the vocabulary tab. This step specifically avoids common textbook vocabulary to provide real-world learning value.
7.  **Preview, Display & Download**: The application parses all responses and presents them in a clean, **tabbed interface** for easy navigation between the Preview Player, the side-by-side Karaoke Data, and the Vocabulary list. All generated files are available for individual download.

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Model**: Google Gemini 2.5 Pro (for audio synchronization & refinement) & Gemini 2.5 Flash (for translation and vocabulary)
- **Libraries**:
  - `@google/genai`: The official Google client library for the Gemini API.

## 📂 Project Structure

```
.
├── index.html            # Main HTML entry point
├── index.tsx             # Renders the React application
├── App.tsx               # Main application component with all UI and state logic
├── server.ts             # Express server with Gemini API proxy
├── services/
│   └── geminiService.ts  # Client-side API calls (via server proxy)
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