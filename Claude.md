# Karaoke Syncer AI

AI-powered web app that generates word-level synchronized karaoke lyric files from audio tracks using Google's Gemini API. Also includes a **mobile karaoke viewer app** for language learning through music.

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.8 + Tailwind CSS (CDN)
- **Backend:** Express 4 (API proxy for Gemini)
- **Build:** Vite 6
- **AI:** Google Gemini API (@google/genai)
  - **Pro models** for sync: Gemini 3 Pro (default/recommended) or Gemini 2.5 Pro (stable fallback)
  - **Flash models** for translation: Gemini 3 Flash or Gemini 2.5 Flash
- **Utilities:** jszip, Web Audio API

## Project Structure

```
├── App.tsx              # Syncer tool - main React component
├── server.ts            # Express server with /api/gemini proxy + static file serving
├── services/
│   ├── geminiService.ts # Client-side API calls, auto-refinement logic
│   ├── lrcParser.ts     # LRC file parsing and format detection
│   └── validationService.ts # Quality validation, problem detection
├── types.ts             # TypeScript type definitions (syncer)
├── index.tsx            # Syncer entry point
├── index.html           # Syncer HTML entry
├── viewer/              # Mobile karaoke viewer app
│   ├── ViewerApp.tsx    # Main viewer component
│   ├── index.tsx        # Viewer entry point
│   ├── types.ts         # Viewer type definitions
│   ├── components/      # UI components (PlayerScreen, VideoPlayer, AudioPlayer, etc.)
│   ├── hooks/           # React hooks (useYouTubePlayer, useAudioPlayer, useKaraokeSync, etc.)
│   └── utils/           # Utilities (deviceDetection)
├── viewer.html          # Viewer HTML entry
├── public/              # Static assets (playlist.json, track data)
├── vite.config.ts       # Vite config with multi-entry points
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

### Local Machine Setup

- **Homebrew binaries**: `/opt/homebrew/bin` (includes `gh`, `node`, etc.)
- **GitHub CLI**: `/opt/homebrew/bin/gh`
- **Google Cloud SDK**: `/opt/homebrew/share/google-cloud-sdk/bin/gcloud`

## Key Types

- `KaraokeData` - Main data structure with metadata and segments
- `KaraokeSegment` - Individual lyric/instrumental segment with word-level timing
- `KaraokeWord` - Single word with startTimeMs/endTimeMs
- `VocabularyItem` - Extracted cultural vocabulary with audio timecodes
- `ParsedLrc` - Parsed LRC file with line-level timestamps and detected sections
- `LrcLine` - Single LRC line with timing and text
- `DetectedSection` - Non-lyric section (intro, interlude, skit, outro) detected during LRC correction

## Core Workflow

1. User uploads audio + pastes/uploads LRC content (auto-detected by `[mm:ss.xx]` format)
2. User selects AI model tier (Gemini 3 recommended, Gemini 2.5 stable fallback)
3. **LRC Timestamp Correction** - Gemini Pro verifies/corrects each line's timing against audio:
   - Fixes drift that accumulates when LRC timestamps are off
   - Detects non-lyric sections (intros, interludes, skits, outros) common in YouTube music videos
4. Auto-translate Spanish lyrics to English via Gemini Flash
5. Gemini Pro generates word-level timing using corrected LRC boundaries:
   - Distributes words within each corrected segment based on audio
   - Inserts detected instrumental sections at appropriate positions
6. English words aligned to same segment structure
7. Automatic validation calculates quality score (0-100)
8. Optional: **Auto-Fix Issues** - refines problem segments
9. Export as JSON or zip archive

## Routes

- `/` - Karaoke viewer app (mobile-first)
- `/syncer` - Karaoke syncer tool (content creation)

## Architecture Notes

- **Multi-entry point** - Vite builds two separate apps (viewer + syncer) from different entry points
- **Server-side API proxy** - Express server handles all Gemini API calls, keeping the API key secure (never in browser)
- Single-page app with all components in App.tsx (syncer) or ViewerApp.tsx (viewer)
- State management via React hooks (no external state library)
- geminiService.ts calls `/api/gemini` proxy endpoint with exponential backoff retry
- Real-time audio spectrum visualizer using Web Audio API
- Vocabulary extraction identifies Spanish slang/idioms with audio timecodes
- In development, Vite proxies `/api` requests to Express server on port 8080

## Karaoke Viewer App

A mobile-first viewer for learning Spanish through karaoke music videos.

**Features:**
- YouTube video player (desktop) / HTML5 audio player (mobile)
- Automatic device detection for player selection
- Audio visualizer with full-width waveform animation (Web Audio API)
- Word-by-word synchronized lyrics (Spanish + English translation)
- Responsive font sizes (smaller on mobile to reduce word wrapping)
- Vocabulary word highlighting with purple glow effect
- Toast notifications with ping sound when vocab words are unlocked
- Collapsible vocab panel with progress tracking
- Stats panel with streak tracking and achievements
- Swipe gestures for track navigation
- Session-level progress persistence
- Video end screen with Play Again/Play Next buttons
- Wake lock to prevent screen sleep during playback
- iOS Safari safe area handling

**Mobile Audio Player Features:**
- Darkened thumbnail with track metadata overlay (title, artist, album)
- Full-width waveform visualizer using Web Audio API AnalyserNode
- Tap to unmute (required for mobile autoplay policy)
- Play button shown persistently when paused
- Pause button appears briefly then fades out when playing
- Scrubber with elapsed/remaining time and draggable handle
- CORS retry logic (falls back to no visualizer if CORS fails)

**Key Files:**
- `viewer/ViewerApp.tsx` - Main app component, state management
- `viewer/hooks/useYouTubePlayer.ts` - YouTube IFrame API integration
- `viewer/hooks/useAudioPlayer.ts` - HTML5 Audio API for mobile (with Web Audio visualizer, wake lock)
- `viewer/hooks/useKaraokeSync.ts` - Word-level timing synchronization
- `viewer/hooks/useProgress.ts` - Session progress tracking
- `viewer/components/PlayerScreen.tsx` - Video/audio player and lyrics display
- `viewer/components/VideoPlayer.tsx` - YouTube video player (desktop)
- `viewer/components/AudioPlayer.tsx` - HTML5 audio player (mobile)
- `viewer/components/AudioVisualizer.tsx` - Canvas-based waveform visualization
- `viewer/components/VocabPanel.tsx` - Vocabulary list with seek-to-word
- `viewer/components/VocabToast.tsx` - Toast notifications with ping sound
- `viewer/utils/deviceDetection.ts` - Mobile device detection
- `viewer/utils/pingSoundContext.ts` - Shared AudioContext for UI sounds
- `public/playlist.json` - Track metadata and file paths

## Documentation

- `TODO.md` - Roadmap, known issues, and future ideas
- `docs/karaoke-app-spec.md` - Viewer app feature requirements
- `docs/karaoke-viewer-implementation-plan.md` - Viewer implementation plan
- `docs/tech-spec-lrc-based-synchronization.md` - LRC file support for improved timing accuracy
- `docs/tech-spec-security-and-deployment.md` - API key security fix and Cloud Run CI/CD setup
- `docs/tech-spec-automated-quality-validation.md` - Automated QA for generated karaoke data:
  - Phase 1-3: Core validation logic and UI integration
  - Phase 4: Cross-language consistency validation
  - Phase 5: Translation alignment improvements
  - Phase 6: Vocabulary timecode consistency
  - **Phase 7: Synchronization quality improvements** (includes auto-fix implementation)
- `docs/tech-spec-google-analytics.md` - GA4 integration for viewer engagement tracking

## Key Features

- **LRC-Based Sync** - Upload or paste LRC files for fast, accurate word-level synchronization
- **LRC Timestamp Correction** - Verifies/corrects LRC timing against audio, fixing drift issues
- **YouTube Audio Support** - Detects non-lyric sections (intros, skits, interludes) common in music videos
- **Instrumental Detection** - Automatically detects and adds intro, interlude, and outro sections
- **Model Selection** - Gemini 3 (default/recommended) or Gemini 2.5 (stable fallback)
- **Auto Validation** - Quality score (0-100) with error/warning detection after generation
- **Auto-Fix Issues** - One-click automatic refinement of problem segments (iterates up to 3x until score >= 85)
  - Optimized two-phase approach: Spanish refined with Pro+audio, English realigned with Flash (text-only)
  - ~50% faster than previous implementation
- **Manual Refinement** - Mark specific segments for targeted AI re-analysis
- **Bilingual Output** - Auto-translates and generates both Spanish and English karaoke data
- **Session Persistence** - Auto-saves work to localStorage; survives browser refresh/sleep (re-upload audio to continue)

## External Services

- **Google Cloud Storage** - Audio files for mobile playback hosted in `karaoke_static_assets` bucket
  - Supports MP3 and M4A/AAC formats
  - Audio URLs stored in `playlist.json` under `audioUrl` field

## Known Limitations

1. **LRC correction accuracy** - LRC timestamp correction improves results but may still miss subtle timing issues
2. **Translation timing** - Word-level timing in translations is estimated, not audio-verified
3. **Vocabulary drift** - Segment indices may need re-extraction after major refinements
4. **Mobile audio** - Audio files must be manually uploaded to GCS; no video on mobile (audio only with thumbnail)
