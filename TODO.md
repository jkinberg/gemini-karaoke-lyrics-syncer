# TODO

## Karaoke Viewer App - COMPLETED

**Goal:** Build a mobile-first karaoke viewer for learning Spanish through Bad Bunny songs.

**Features implemented:**
- YouTube video player with autoplay (muted) and tap-to-unmute
- Word-by-word synchronized lyrics (Spanish + English translation)
- Vocabulary word highlighting with purple glow effect
- Toast notifications when vocab words are unlocked (+1 vocab)
- Collapsible vocab panel with progress tracking
- Stats panel with streak, vocab count, songs completed, listening time
- Swipe gestures for track navigation (horizontal) and vocab panel (vertical)
- Session-level progress persistence (resets on refresh)
- Playlist navigation with pagination dots
- Video end screen with Play Again/Play Next buttons
- Slide animations for vocab panel open/close

**Architecture:**
- Multi-entry point Vite config (viewer at `/`, syncer at `/syncer`)
- React hooks for YouTube IFrame API, karaoke sync, progress tracking
- Static playlist.json + track data in public/ folder

---

## Auto-Fix Performance Optimization - COMPLETED

**Problem:** Auto-fix was very slow when fixing many segments (69 segments = ~25-30 min per iteration).

**Previous behavior:**
- Batched segments in groups of 10 to avoid truncation
- Refined Spanish batches sequentially (Gemini Pro with audio)
- Refined English batches sequentially (Gemini Pro with audio)
- 69 segments = 7 Spanish batches + 7 English batches = 14 API calls per iteration
- Each Pro call took ~100-130 seconds

**Solution implemented:**
1. **Spanish as source of truth** - Only refine Spanish segments with Gemini Pro + audio
2. **Flash for English alignment** - After Spanish is refined, use `alignTranslatedToRefinedOriginal()` with Gemini Flash (text-only, no audio) to realign all English words to match Spanish segment timing
3. **Single Flash call** - Instead of batching English, one Flash call realigns the entire English karaoke data

**Performance improvement:**
- Spanish: 7 batches × ~120s = ~14 minutes
- English: 1 Flash call × ~20s = ~20 seconds
- **Total: ~14.5 minutes per iteration (vs ~30 minutes previously) - 50% faster**

**Files modified:**
- `services/geminiService.ts`: Updated `autoRefineKaraokeData()` to use Flash for English realignment

---

## Known Issues

### YouTube Embed Limitations on Mobile
- YouTube IFrame embeds have restrictions on mobile devices (autoplay blocked, controls forced)
- Need alternate solution to demo on mobile devices
- Options to explore:
  - [ ] Native app wrapper (Capacitor/React Native)
  - [ ] Server-side audio extraction + HTML5 audio player
  - [ ] YouTube Data API + separate audio source
  - [ ] PWA with service worker for better mobile experience

---

## Future Ideas

### Viewer App - High Priority
- [ ] Integrate Google Analytics tracking
- [ ] Integrate feedback survey link
- [ ] Display language selector with other options (Italian, French, Korean) shown as "Coming Soon"

### Viewer App - Future
- [ ] Persistent progress (localStorage or backend)
- [ ] User accounts and cross-device sync
- [ ] Spaced repetition for vocabulary review
- [ ] Pronunciation practice with speech recognition
- [ ] More playlists / genres beyond Bad Bunny
- [ ] Offline mode with cached video/data

### Syncer Tool
- [ ] Parallelize Spanish batch API calls (with rate limiting consideration)
- [ ] Increase batch size for shorter songs where truncation is less likely
- [ ] Add progress estimation based on batch count
