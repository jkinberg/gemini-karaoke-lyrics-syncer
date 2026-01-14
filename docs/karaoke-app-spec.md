# Karaoke Language Learning App - Claude Code Implementation Spec

## Project Overview

Build a mobile-first web app that teaches Spanish through karaoke-style synchronized lyrics of Bad Bunny songs. The app displays bilingual lyrics (Spanish/English) with word-by-word highlighting synced to YouTube music videos, and teaches cultural vocabulary/slang through an interactive unlock system.

**Target launch:** Before Super Bowl (Feb 8, 2026) - Bad Bunny is the halftime performer

**Primary audience:** English speakers learning Spanish through Latin music

---

## Tech Stack

- **Framework:** React (Vite or Next.js)
- **Styling:** Tailwind CSS
- **Video:** YouTube IFrame API
- **State:** React hooks + localStorage for persistence
- **Deployment:** Vercel (recommended for speed)

---

## Data Structure

### Playlist (`playlist.json`)
```json
{
  "playlist": {
    "id": "bad-bunny-learning",
    "title": "Bad Bunny Spanish Learning Playlist",
    "trackCount": 6
  },
  "tracks": [
    {
      "id": "05-bad-bunny-titi-me-pregunto",
      "order": 1,
      "metadata": {
        "title": "Tití Me Preguntó",
        "artist": "Bad Bunny",
        "durationMs": 253000,
        "difficulty": 7,
        "vocabularyCount": 7
      },
      "youtube": {
        "videoId": "Cr8K88UcO0s"
      },
      "dataFiles": {
        "spanish": "samples/05-bad-bunny-titi-me-pregunto/spanish_karaoke_data.json",
        "english": "samples/05-bad-bunny-titi-me-pregunto/english_karaoke_data.json",
        "vocabulary": "samples/05-bad-bunny-titi-me-pregunto/vocabulary.json"
      }
    }
  ]
}
```

### Karaoke Data (`spanish_karaoke_data.json` / `english_karaoke_data.json`)
```json
{
  "metadata": {
    "title": "Tití Me Preguntó",
    "artist": "Bad Bunny",
    "durationMs": 253000,
    "language": "es-ES"
  },
  "segments": [
    {
      "type": "INSTRUMENTAL",
      "startTimeMs": 0,
      "endTimeMs": 41740,
      "segmentIndex": 0,
      "cueText": "Intro / Skit"
    },
    {
      "type": "LYRIC",
      "startTimeMs": 41740,
      "endTimeMs": 45520,
      "segmentIndex": 1,
      "text": "Ey, Tití me preguntó si tengo mucha' novia'",
      "words": [
        {
          "word": "Ey,",
          "startTimeMs": 41740,
          "endTimeMs": 42100
        },
        {
          "word": "Tití",
          "startTimeMs": 42100,
          "endTimeMs": 42400
        }
        // ... more words
      ]
    }
  ]
}
```

### Vocabulary (`vocabulary.json`)
```json
[
  {
    "term": {
      "spanish": "Tití",
      "english": "Auntie"
    },
    "definition": "A colloquial, affectionate term for 'aunt'...",
    "difficulty": 4,
    "example": {
      "spanish": "Ey, Tití me preguntó si tengo mucha' novia'",
      "english": "Hey, Auntie asked me if I have many girlfriends"
    },
    "highlight": {
      "spanish": "Tití",
      "english": "Auntie"
    },
    "startTimeMs": 41740,
    "endTimeMs": 45520,
    "segmentIndex": 1
  }
]
```

**Key relationship:** `segmentIndex` links vocabulary terms to specific lyric segments in both Spanish and English files.

---

## Core Features

### 1. YouTube Video Player
- Embed using YouTube IFrame API
- Tap center to play/pause (no visible controls)
- Swipe left/right to change songs in playlist
- Expose `getCurrentTime()` for sync (poll every 50-100ms)

### 2. Synchronized Lyrics Display
- Show ONE lyric segment at a time (Spanish above, English below)
- Spanish: 38px bold, English: 22px regular
- Word-by-word highlighting synced to `currentTimeMs`:
  - Words before current time: highlighted (yellow for Spanish, gray for English)
  - Words after current time: dimmed (zinc-600/zinc-700)
- Segment transitions when `currentTimeMs >= segment.endTimeMs`

### 3. Vocabulary Highlighting
- Vocab words have THREE states:
  - **Before active:** Dark purple (`text-purple-900`) - barely visible
  - **When active:** Bright purple (`text-purple-400`) + glow effect
  - **After active:** Stays bright purple with glow
- Both Spanish AND English equivalent words glow together
- Use `highlight.spanish` and `highlight.english` from vocab data to match words
- CSS glow: `text-shadow: 0 0 20px rgba(192, 132, 252, 0.8), 0 0 40px rgba(192, 132, 252, 0.5)`

### 4. Vocab Toast Notification
- When a vocab word becomes active, show toast: "[word] +1 vocab"
- Purple pill shape, appears above vocab bar
- Auto-dismiss after 2 seconds
- Animate in from bottom with fade

### 5. Vocab Bar (Collapsed)
- Fixed at bottom of screen
- Shows: Book icon, "Vocab" label, progress badge (e.g., "2/6")
- Segmented progress line (one segment per vocab word in current song)
- Segments light up with glow when vocab word is active
- Tap to expand vocab panel

### 6. Vocab Panel (Expanded)
- Slides up as overlay sheet (75% height)
- Header: Book icon, "Vocabulary", "[X] of [Y] unlocked", close button
- Progress bar showing unlocked segments
- List of vocab cards:
  - **Unlocked:** Word (purple), checkmark, definition, lyric context quote, play button
  - **Locked:** Word (gray), lock icon, "Keep listening to unlock"
- Play button jumps video to that vocab word's `startTimeMs`

### 7. Stats/Progress Screen
- Access via flame icon in top bar
- Streak card (flame icon, current streak, personal best)
- Stats grid: Songs completed, Vocab unlocked, Time spent
- Achievements list (unlocked/locked states)
- Overall vocab progress bar

### 8. Progress Tracking (localStorage)
```javascript
const progressSchema = {
  streak: {
    current: 3,
    longest: 7,
    lastActiveDate: "2026-01-12"
  },
  songs: {
    "05-bad-bunny-titi-me-pregunto": {
      playCount: 2,
      completed: true,  // listened to >80%
      lastPlayed: "2026-01-12T15:30:00Z"
    }
  },
  vocabulary: {
    "titi-me-pregunto-titi": { unlocked: true, encounters: 3 },
    "titi-me-pregunto-cabron": { unlocked: true, encounters: 2 }
  },
  stats: {
    totalSongsCompleted: 8,
    totalVocabUnlocked: 24,
    totalMinutesListened: 47
  }
};
```

---

## Screen Structure

### 1. Player Screen (Main)
```
┌─────────────────────────────┐
│ [♪]                    [🔥] │  ← Top bar: music note logo, flame icon
├─────────────────────────────┤
│                             │
│      [YouTube Video]        │  ← 16:9, tap to play/pause
│       ◀           ▶         │  ← Subtle swipe hints
│                             │
├─────────────────────────────┤
│                             │
│  Yo no sé qué hacer         │  ← Spanish 38px bold
│  con tantas nenas           │
│  que me escriben            │
│                             │
│  I don't know what to do    │  ← English 22px
│  with so many girls         │
│  who text me                │
│                             │
├─────────────────────────────┤
│ [📖] Vocab           [2/6]  │  ← Vocab bar collapsed
│ [████░░░░░░░░░░░░░░░░░░░░]  │  ← Segmented progress
└─────────────────────────────┘
```

### 2. Vocab Panel (Overlay)
```
┌─────────────────────────────┐
│         ━━━━━━━━            │  ← Drag handle
│ [📖] Vocabulary        [✕]  │
│      2 of 6 unlocked        │
│ [████████░░░░░░░░░░░░░░░░]  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Tití  ✓             [▶] │ │
│ │ Auntie - A colloquial   │ │
│ │ term for aunt...        │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ "Tití me preguntó"  │ │ │
│ │ │ Auntie asked me     │ │ │
│ │ └─────────────────────┘ │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ cabrón  🔒              │ │
│ │ Keep listening to       │ │
│ │ unlock                  │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 3. Stats Screen (Overlay)
```
┌─────────────────────────────┐
│ Your Progress          [✕]  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🔥  3                   │ │
│ │     Day Streak          │ │
│ │     Best: 7 days        │ │
│ └─────────────────────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │     8     │ │    24     │ │
│ │   Songs   │ │   Vocab   │ │
│ └───────────┘ └───────────┘ │
│ ┌─────────────────────────┐ │
│ │         47 min          │ │
│ │     Time Learning       │ │
│ └─────────────────────────┘ │
│                             │
│ Achievements                │
│ ┌─────────────────────────┐ │
│ │ 🏆 First Song      ✓    │ │
│ │ 🏆 10 Words        ✓    │ │
│ │ 🏆 7 Day Streak    🔒   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## Key Implementation Details

### YouTube Sync Loop
```javascript
useEffect(() => {
  if (!isPlaying) return;
  
  const interval = setInterval(() => {
    const currentTimeMs = player.getCurrentTime() * 1000;
    
    // Find current segment
    const segment = segments.find(
      s => currentTimeMs >= s.startTimeMs && currentTimeMs < s.endTimeMs
    );
    
    // Find current word within segment
    if (segment?.words) {
      const wordIndex = segment.words.findIndex(
        w => currentTimeMs < w.endTimeMs
      );
      setCurrentWordIndex(wordIndex);
    }
    
    // Check for vocab unlocks
    checkVocabUnlocks(currentTimeMs);
    
  }, 50); // 50ms polling for smooth highlighting
  
  return () => clearInterval(interval);
}, [isPlaying, player]);
```

### Vocab Word Matching
```javascript
const isVocabWord = (word, vocabList, segmentIndex) => {
  return vocabList.find(v => 
    v.segmentIndex === segmentIndex && 
    word.toLowerCase().includes(v.highlight.spanish.toLowerCase())
  );
};
```

### Song Metadata Fade
- Show song title/artist overlay on video for 3 seconds
- Fade out with CSS transition: `opacity 0 → 1, duration 1s`

### Swipe Navigation
- Use touch events or a library like `react-swipeable`
- Swipe left = next song, swipe right = previous song
- Update playlist index, load new song data

---

## File Structure
```
/src
  /components
    Player.jsx           # Main player screen
    VideoPlayer.jsx      # YouTube embed wrapper
    LyricsDisplay.jsx    # Synced lyrics with highlighting
    VocabBar.jsx         # Collapsed vocab bar
    VocabPanel.jsx       # Expanded vocab overlay
    StatsPanel.jsx       # Stats/achievements overlay
    VocabToast.jsx       # "+1 vocab" notification
  /hooks
    useYouTubePlayer.js  # YouTube API integration
    useKaraokeSync.js    # Timing/sync logic
    useProgress.js       # localStorage persistence
  /data
    playlist.json
    /samples
      /05-bad-bunny-titi-me-pregunto
        spanish_karaoke_data.json
        english_karaoke_data.json
        vocabulary.json
      /06-bad-bunny-nuevayol
        ...
  /utils
    storage.js           # localStorage helpers
    time.js              # Time formatting utilities
  App.jsx
  index.css              # Tailwind imports
```

---

## Design Tokens

### Colors
- Background: `black` / `zinc-900`
- Spanish text active: `yellow-300`
- English text active: `zinc-400`
- Inactive text: `zinc-600` / `zinc-700`
- Vocab inactive: `purple-900`
- Vocab active: `purple-400` with glow
- Streak/flame: `orange-400`
- Progress bar: `purple-500` → `pink-500` gradient

### Typography
- Spanish lyrics: 38px, font-weight 700, line-height 1.1
- English lyrics: 22px, font-weight 400, line-height 1.25
- UI text: System font stack

### Spacing
- Side padding: 16px
- Gap between Spanish/English: 32px
- Vocab bar padding: 16px

---

## MVP Scope (Ship This First)

1. ✅ YouTube video playback with play/pause
2. ✅ Synced bilingual lyrics (word-by-word highlighting)
3. ✅ Vocab glow effect when words appear
4. ✅ Vocab toast notifications
5. ✅ Collapsible vocab bar with progress
6. ✅ Vocab panel with definitions
7. ✅ Basic stats screen
8. ✅ localStorage progress tracking
9. ✅ Swipe to change songs

## Post-MVP (If Time Permits)

- Achievements system
- Streak tracking with calendar
- Difficulty ratings
- Search/filter songs
- Share progress to social
- Quiz mode after songs

---

## Testing Checklist

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

---

## Reference Files

- **Mockup:** karaoke-iphone-v3.jsx (React component with full UI)
- **Playlist:** playlist.json
- **Sample data:** Tití Me Preguntó and NUEVAYoL JSON files

---

## Notes for Claude Code

1. Start with a single song working end-to-end before adding playlist navigation
2. The YouTube IFrame API requires a callback-based initialization - handle async properly
3. Polling at 50ms gives smooth word highlighting without performance issues
4. Test on real mobile device early - touch events behave differently than mouse
5. The glow effect uses `text-shadow` not `box-shadow`
6. Vocab matching should be case-insensitive and handle partial matches (some vocab terms are multi-word)
