# Karaoke Viewer Implementation Plan

## Overview

Build a mobile-first karaoke viewer app within the existing karaoke-lyrics-syncer project. The viewer displays bilingual lyrics with word-by-word highlighting synced to YouTube videos, with a vocabulary unlock/gamification system.

**Target launch:** Before Super Bowl (Feb 8, 2026)
**Reference specs:** `docs/karaoke-app-spec.md`, `docs/karaoke-iphone-v3.jsx`

---

## Architecture Decision: Multi-Entry Point (Same Project)

Both apps in single deployment:
- `/` → Viewer app (`viewer.html`) - mobile-optimized
- `/syncer` → Syncing tool (`index.html`) - existing app
- `/api/*` → Gemini API proxy (syncer only)

**Rationale:**
- Reuse existing CI/CD pipeline
- Viewer bundle ~30KB (no JSZip, Gemini API dependencies)
- Shared data files already generated

**Data Files:**
- Playlist: `/public/playlist.json` - Track list with metadata and data file paths
- Karaoke data: `/samples/{track-id}/spanish_karaoke_data.json`, `english_karaoke_data.json`
- Vocabulary: `/samples/{track-id}/vocabulary.json`

---

## File Structure

```
├── viewer/
│   ├── index.tsx               # React entry point
│   ├── ViewerApp.tsx           # Main app with screen routing
│   ├── components/
│   │   ├── PlayerScreen.tsx    # Main player (video + lyrics + vocab bar)
│   │   ├── VideoPlayer.tsx     # YouTube embed with tap-to-play
│   │   ├── LyricsDisplay.tsx   # Single segment with word highlighting
│   │   ├── VocabBar.tsx        # Collapsed vocab bar with segments
│   │   ├── VocabPanel.tsx      # Expanded vocab overlay sheet
│   │   ├── VocabToast.tsx      # "+1 vocab" notification
│   │   ├── StatsPanel.tsx      # Stats/achievements overlay
│   │   └── TrackList.tsx       # Playlist selection (if needed)
│   ├── hooks/
│   │   ├── useYouTubePlayer.ts # YouTube IFrame API wrapper
│   │   ├── useKaraokeSync.ts   # Timing/segment/word sync logic
│   │   ├── useProgress.ts      # localStorage persistence
│   │   └── usePlaylist.ts      # Fetch playlist.json and track data
│   ├── utils/
│   │   ├── storage.ts          # localStorage helpers
│   │   └── time.ts             # Time formatting utilities
│   └── types.ts                # Viewer-specific types
├── viewer.html                 # Mobile-optimized HTML entry
├── vite.config.ts              # Add multi-entry build
└── server.ts                   # Add route handling
```

---

## Screen Structure (from spec)

### 1. Player Screen (Main)
```
┌─────────────────────────────┐
│ [♪]                    [🔥] │  ← Top bar: logo, flame → stats
├─────────────────────────────┤
│                             │
│      [YouTube Video]        │  ← 16:9, tap = play/pause
│       ◀           ▶         │  ← Swipe hints
│                             │
├─────────────────────────────┤
│  Yo no sé qué hacer         │  ← Spanish 38px bold
│  con tantas nenas           │
│                             │
│  I don't know what to do    │  ← English 22px
│  with so many girls         │
├─────────────────────────────┤
│ [📖] Vocab           [2/6]  │  ← Vocab bar (tap → expand)
│ [████░░░░░░░░░░░░░░░░░░░░]  │  ← Segmented progress
└─────────────────────────────┘
```

### 2. Vocab Panel (Overlay - 75% height)
- Slides up from bottom
- Header: book icon, "Vocabulary", progress, close button
- Segmented progress bar
- List of vocab cards (unlocked/locked states)
- Play button jumps to timestamp

### 3. Stats Panel (Overlay)
- Access via flame icon
- Streak card with personal best
- Stats grid: Songs, Vocab, Time
- Achievements list (unlocked/locked)
- Overall vocab progress bar

---

## Key Features (from spec)

### 1. Single Segment Lyrics Display
- Show ONE lyric segment at a time (not scrolling list)
- Spanish above (38px bold), English below (22px)
- Transitions when `currentTimeMs >= segment.endTimeMs`

### 2. Word-by-Word Highlighting
- Words before current time: highlighted
  - Spanish: `yellow-300`
  - English: `zinc-400`
- Words after current time: dimmed (`zinc-600`/`zinc-700`)

### 3. Vocab Word States (THREE states)
- **Before active:** Dark purple (`text-purple-900`) - barely visible
- **When active:** Bright purple (`text-purple-400`) + glow effect
- **After active:** Stays bright purple with glow (unlocked permanently)
- Both Spanish AND English equivalents glow together
- CSS glow: `text-shadow: 0 0 20px rgba(192, 132, 252, 0.8), 0 0 40px rgba(192, 132, 252, 0.5)`

### 4. Vocab Toast
- Shows when vocab word becomes active: "[word] +1 vocab"
- Purple pill, appears above vocab bar
- Auto-dismiss after 2 seconds
- Animate in from bottom

### 5. Vocab Bar (Collapsed)
- Fixed at bottom
- Shows: book icon, "Vocab", progress badge (e.g., "2/6")
- Segmented progress line (one per vocab word)
- Active segment glows
- Tap to expand panel

### 6. Swipe Navigation
- Swipe left = next song
- Swipe right = previous song
- Use touch events or `react-swipeable`

### 7. Song Metadata Overlay
- Show title/artist on video for 3 seconds
- Fade out with CSS transition

### 8. Autoplay with Muted Start
- Videos autoplay immediately when loaded (for instant engagement)
- Start muted due to browser autoplay restrictions
- Show large "Tap to Unmute" button overlay on video
- Once unmuted, persist mute state across track navigation
- Track `isMuted` state in `useYouTubePlayer` hook
- When navigating to next/prev track, maintain unmuted state

```typescript
// YouTube playerVars for autoplay
playerVars: {
  autoplay: 1,      // Start playing immediately
  mute: 1,          // Start muted (required for autoplay)
  playsinline: 1,   // iOS inline playback
  controls: 0,      // Hide default controls
  modestbranding: 1,
  rel: 0,
}
```

---

## Progress Schema (localStorage)

```typescript
interface ProgressData {
  streak: {
    current: number;
    longest: number;
    lastActiveDate: string; // "2026-01-12"
  };
  songs: {
    [trackId: string]: {
      playCount: number;
      completed: boolean; // listened to >80%
      lastPlayed: string; // ISO timestamp
    };
  };
  vocabulary: {
    [vocabKey: string]: { // e.g., "titi-me-pregunto-titi"
      unlocked: boolean;
      encounters: number;
    };
  };
  stats: {
    totalSongsCompleted: number;
    totalVocabUnlocked: number;
    totalMinutesListened: number;
  };
}
```

---

## Implementation Phases

### Phase 1: Build Infrastructure
1. Create `viewer/` directory structure
2. Create `viewer.html` with mobile meta tags and Tailwind config
3. Update `vite.config.ts` for multi-entry:
   ```typescript
   build: {
     rollupOptions: {
       input: {
         main: resolve(__dirname, 'index.html'),
         viewer: resolve(__dirname, 'viewer.html'),
       },
     },
   }
   ```
4. Update `server.ts` routes:
   - `/syncer` → `dist/index.html`
   - `/*` → `dist/viewer.html`
5. Test build produces both HTML files

### Phase 2: Core Player Screen
1. Create `ViewerApp.tsx` with screen state (player/vocab/stats)
2. Create `PlayerScreen.tsx` layout (top bar, video, lyrics, vocab bar)
3. Create `usePlaylist.ts` to fetch `playlist.json` and track data
4. Static layout with mock data first

### Phase 3: YouTube Integration
1. Create `useYouTubePlayer.ts`:
   - Load YouTube IFrame API dynamically
   - Autoplay muted (required for browser autoplay policy)
   - Track `isMuted` state, persist across track changes
   - `playsinline=1` for iOS
   - Poll `getCurrentTime()` at 50ms
   - Handle play/pause/seek/mute/unmute
2. Create `VideoPlayer.tsx`:
   - Video container with autoplay
   - Large "Tap to Unmute" button overlay (shown when muted)
   - Tap video to play/pause (when unmuted)
   - Swipe hints for navigation
3. Add song metadata overlay with fade

### Phase 4: Lyrics Sync
1. Create `useKaraokeSync.ts`:
   - Find current segment based on `currentTimeMs`
   - Find current word within segment
   - Track vocab word activation
2. Create `LyricsDisplay.tsx`:
   - Single segment display (Spanish + English)
   - Word highlighting with timing
   - Vocab word glow states

### Phase 5: Vocabulary System
1. Create `useProgress.ts` with localStorage
2. Create `VocabBar.tsx` (collapsed, segmented progress)
3. Create `VocabToast.tsx` (+1 notification)
4. Create `VocabPanel.tsx` (expanded sheet)
5. Implement vocab unlock logic when timecode reached

### Phase 6: Stats & Achievements
1. Create `StatsPanel.tsx`:
   - Streak card with personal best
   - Stats grid
   - Achievements list
2. Add streak calculation logic (date comparison)
3. Add song completion tracking (>80%)

### Phase 7: Swipe & Polish
1. Add swipe navigation between songs
2. Mobile polish:
   - iOS Safari safe areas
   - Touch feedback
   - Loading states
3. Test on real devices

---

## Design Tokens (from spec)

### Colors
- Background: `black` / `zinc-900`
- Spanish active: `yellow-300`
- English active: `zinc-400`
- Inactive text: `zinc-600` / `zinc-700`
- Vocab inactive: `purple-900`
- Vocab active: `purple-400` + glow
- Streak/flame: `orange-400`
- Progress gradient: `purple-500` → `pink-500`

### Typography
- Spanish lyrics: 38px, font-weight 700, line-height 1.1
- English lyrics: 22px, font-weight 400, line-height 1.25
- UI text: System font stack

### Spacing
- Side padding: 16px
- Gap Spanish/English: 32px
- Vocab bar padding: 16px

---

## Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Add `rollupOptions.input` for multi-entry |
| `server.ts` | Add `/syncer` route, catch-all serves viewer |

## Files to Create

| File | Purpose |
|------|---------|
| `viewer.html` | Mobile HTML entry with Tailwind config |
| `viewer/index.tsx` | React entry point |
| `viewer/ViewerApp.tsx` | Main app with screen routing |
| `viewer/types.ts` | PlaylistData, Track, ProgressData types |
| `viewer/components/*.tsx` | 8 UI components |
| `viewer/hooks/*.ts` | 4 custom hooks |
| `viewer/utils/*.ts` | Storage and time helpers |

## Files NOT to Modify

- `App.tsx` - Syncer app unchanged
- `services/geminiService.ts` - API service unchanged
- `types.ts` - Shared types (reference only)
- `Dockerfile` - Should work unchanged
- `cloudbuild.yaml` - Should work unchanged

---

## MVP Scope (Ship First)

1. ✅ YouTube video autoplay (muted) with "Tap to Unmute"
2. ✅ Synced bilingual lyrics (word-by-word highlighting)
3. ✅ Vocab glow effect when words appear
4. ✅ Vocab toast notifications
5. ✅ Collapsible vocab bar with progress
6. ✅ Vocab panel with definitions
7. ✅ Basic stats screen
8. ✅ localStorage progress tracking
9. ✅ Swipe to change songs (unmute state persists)

## Post-MVP (If Time)

- Achievements system
- Streak tracking with calendar
- Search/filter songs
- Share progress
- Quiz mode

---

## Testing Checklist

- [ ] Video autoplays muted on page load
- [ ] "Tap to Unmute" button visible and functional
- [ ] Unmute state persists when swiping to next/prev track
- [ ] Lyrics sync accurately with video (±100ms tolerance)
- [ ] Vocab words glow at correct times
- [ ] Toast appears when vocab unlocks
- [ ] Vocab panel shows correct locked/unlocked states
- [ ] Play button in vocab panel jumps to correct timestamp
- [ ] Progress persists after page refresh
- [ ] Swipe navigation works on mobile
- [ ] Works on iPhone Safari (primary target)
- [ ] Works on Android Chrome
- [ ] Works on desktop (secondary)
