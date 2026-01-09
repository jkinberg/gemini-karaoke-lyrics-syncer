# Karaoke Syncer AI

AI-powered web app that generates word-level synchronized karaoke lyric files from audio tracks using Google's Gemini API.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.8 + Tailwind CSS (CDN)
- **Backend:** Express 4 (API proxy for Gemini)
- **Build:** Vite 6
- **AI:** Google Gemini API (@google/genai)
  - **Pro models** for sync: Gemini 2.5 Pro (stable) or Gemini 3 Pro (preview) - user selectable
  - **Flash models** for translation: Gemini 2.5 Flash or Gemini 3 Flash
- **Utilities:** jszip, Web Audio API

## Project Structure

```
├── App.tsx              # Main React component (all UI components)
├── server.ts            # Express server with /api/gemini proxy
├── services/
│   ├── geminiService.ts # Client-side API calls, auto-refinement logic
│   └── validationService.ts # Quality validation, problem detection
├── types.ts             # TypeScript type definitions
├── index.tsx            # React entry point
├── index.html           # HTML entry with Tailwind CDN
├── vite.config.ts       # Vite config with dev proxy
├── Dockerfile           # Production container build
├── .env.example         # Environment template
└── docs/                # Technical specifications
```

## Commands

```bash
# Development (requires two terminals)
npm run dev:server  # Terminal 1: Express API server (port 8080)
npm run dev         # Terminal 2: Vite frontend (port 3000, proxies /api to 8080)

# Production
npm run build       # Build frontend + compile server
npm run start       # Run production server (port 8080)
npm run preview     # Preview Vite build only

# Cloud Run Preview Deploys (for testing feature branches)
npm run deploy:preview         # Deploy to karaoke-syncer-preview service
npm run deploy:preview:delete  # Delete preview service when done
```

## Deployment

- **Live URL:** https://karaoke-syncer-362554121203.us-west1.run.app/
- **Platform:** Google Cloud Run

## Environment

Requires `GEMINI_API_KEY` environment variable for Google Gemini API access.

## Key Types

- `KaraokeData` - Main data structure with metadata and segments
- `KaraokeSegment` - Individual lyric/instrumental segment with word-level timing
- `KaraokeWord` - Single word with startTimeMs/endTimeMs
- `VocabularyItem` - Extracted cultural vocabulary with audio timecodes

## Core Workflow

1. User uploads audio + provides lyrics in source language
2. User selects AI model tier (Gemini 2.5 stable or Gemini 3 preview)
3. Optional: Auto-translate via Gemini Flash
4. Gemini Pro generates word-level timestamps (treats audio as ground truth)
5. Second pass aligns translated lyrics to original timing
6. Automatic validation calculates quality score (0-100)
7. Optional: **Auto-Fix Issues** - automatically refines problem segments identified by validation
8. Optional: Manual segment refinement or timing adjustments
9. Export as JSON or zip archive

## Architecture Notes

- **Server-side API proxy** - Express server handles all Gemini API calls, keeping the API key secure (never in browser)
- Single-page app with all components in App.tsx
- State management via React hooks (no external state library)
- geminiService.ts calls `/api/gemini` proxy endpoint with exponential backoff retry
- Real-time audio spectrum visualizer using Web Audio API
- Vocabulary extraction identifies Spanish slang/idioms with audio timecodes
- In development, Vite proxies `/api` requests to Express server on port 8080

## Documentation

- `docs/tech-spec-security-and-deployment.md` - API key security fix and Cloud Run CI/CD setup
- `docs/tech-spec-automated-quality-validation.md` - Automated QA for generated karaoke data:
  - Phase 1-3: Core validation logic and UI integration
  - Phase 4: Cross-language consistency validation
  - Phase 5: Translation alignment improvements
  - Phase 6: Vocabulary timecode consistency
  - **Phase 7: Synchronization quality improvements** (includes auto-fix implementation)

## Key Features

- **Model Selection** - Switch between Gemini 2.5 (stable, reliable) and Gemini 3 (preview, experimental)
- **Auto Validation** - Quality score (0-100) with error/warning detection after generation
- **Auto-Fix Issues** - One-click automatic refinement of problem segments (iterates up to 3x until score >= 85)
- **Manual Refinement** - Mark specific segments for targeted AI re-analysis
- **Cross-language Validation** - Ensures Spanish/English segments stay structurally aligned

## Known Limitations

1. **Long API calls** - Full song analysis takes 3-5+ minutes, prone to timeout with Gemini 3 preview
2. **Translation timing** - Word-level timing in translations is estimated, not audio-verified
3. **Vocabulary drift** - Segment indices may need re-extraction after major refinements
