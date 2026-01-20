# Google Analytics Integration - Technical Spec

## Overview

Integrate Google Analytics 4 (GA4) into the karaoke viewer app to measure user engagement with tracks, vocabulary learning, and retention patterns.

**Priority Metrics:**
1. **Track completion & listen time** - How much users listen to songs
2. **Vocabulary learning** - Vocab unlocks, toast interactions, seek-to-word behavior

**Configuration:** GA4 measurement ID via `VITE_GA_MEASUREMENT_ID` environment variable.

## Implementation Approach

### 1. GA4 Setup

**Add gtag.js to viewer.html:**
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Create analytics utility module:**
- `viewer/utils/analytics.ts` - Centralized event tracking functions
- Type-safe event definitions
- Conditional loading (respect DNT header, dev mode)

### 2. Files to Modify

| File | Changes |
|------|---------|
| `viewer.html` | Add gtag.js script |
| `viewer/utils/analytics.ts` | NEW - Analytics utility module |
| `viewer/ViewerApp.tsx` | Track screen views, vocab unlocks, session start |
| `viewer/components/PlayerScreen.tsx` | Track panel opens |
| `viewer/components/AudioPlayer.tsx` | Track playback events |
| `viewer/components/VideoPlayer.tsx` | Track playback events |
| `viewer/components/VocabPanel.tsx` | Track vocab interactions |
| `viewer/components/VocabToast.tsx` | Track toast clicks |
| `viewer/components/StatsPanel.tsx` | Track stats views |
| `viewer/hooks/useProgress.ts` | Track milestone achievements |

---

## Event Tracking Specification

### Page/Screen Views

| Event | Trigger | Parameters |
|-------|---------|------------|
| `page_view` | App loads | `page_title`: "Karaoke Viewer" |
| `screen_view` | Screen changes | `screen_name`: "player" \| "vocab_panel" \| "stats_panel" |

### Playback Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `track_start` | First play/unmute of a track | `track_id`, `track_title`, `artist`, `device_type` |
| `track_play` | Play resumed | `track_id`, `position_seconds` |
| `track_pause` | Playback paused | `track_id`, `position_seconds`, `duration_seconds` |
| `track_seek` | User seeks/scrubs | `track_id`, `from_seconds`, `to_seconds` |
| `track_complete` | Reaches 80% of duration | `track_id`, `track_title`, `artist`, `listen_duration_seconds` |
| `track_ended` | Reaches end of track | `track_id`, `completion_percent` |

### Navigation Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `track_change` | User navigates to different track | `from_track_id`, `to_track_id`, `direction`: "next" \| "prev" \| "direct" |
| `play_again` | User clicks Play Again | `track_id` |
| `play_next` | User clicks Play Next | `from_track_id`, `to_track_id` |

### Vocabulary Learning Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `vocab_unlock` | Vocabulary word unlocked | `track_id`, `vocab_term`, `vocab_index`, `position_seconds` |
| `vocab_toast_shown` | Toast notification appears | `track_id`, `vocab_term` |
| `vocab_toast_click` | User clicks toast | `track_id`, `vocab_term` |
| `vocab_panel_open` | Vocab panel opened | `track_id`, `unlocked_count`, `total_count`, `trigger`: "tap" \| "swipe" \| "toast" \| "end_screen" |
| `vocab_seek_to_word` | User seeks to vocab word | `track_id`, `vocab_term`, `position_seconds` |

### Progress & Achievement Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `achievement_unlock` | Achievement earned | `achievement_id`, `achievement_name` |
| `streak_updated` | Daily streak incremented | `streak_days`, `is_new_longest`: boolean |
| `stats_panel_open` | User views stats | `songs_completed`, `vocab_unlocked`, `minutes_listened`, `current_streak` |

### Session Events

| Event | Trigger | Parameters |
|-------|---------|------------|
| `session_start` | App initialized | `device_type`: "mobile" \| "desktop", `player_type`: "audio" \| "video" |
| `unmute_action` | First unmute (mobile engagement) | `track_id`, `device_type` |

---

## User Properties (GA4)

Set once per user/session for segmentation:

| Property | Value | Purpose |
|----------|-------|---------|
| `device_type` | "mobile" \| "desktop" | Segment by platform |
| `player_type` | "audio" \| "video" | Understand player usage |

---

## Analytics Utility Module

```typescript
// viewer/utils/analytics.ts

type DeviceType = 'mobile' | 'desktop';
type PlayerType = 'audio' | 'video';
type ScreenName = 'player' | 'vocab_panel' | 'stats_panel';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const isAnalyticsEnabled = (): boolean => {
  // Disable in dev, respect DNT
  if (import.meta.env.DEV) return false;
  if (navigator.doNotTrack === '1') return false;
  return typeof window.gtag === 'function';
};

const track = (eventName: string, params?: Record<string, unknown>) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.('event', eventName, params);
};

// Exported tracking functions
export const analytics = {
  // Screen views
  screenView: (screenName: ScreenName) =>
    track('screen_view', { screen_name: screenName }),

  // Playback
  trackStart: (trackId: string, title: string, artist: string, deviceType: DeviceType) =>
    track('track_start', { track_id: trackId, track_title: title, artist, device_type: deviceType }),

  trackPlay: (trackId: string, positionSeconds: number) =>
    track('track_play', { track_id: trackId, position_seconds: positionSeconds }),

  trackPause: (trackId: string, positionSeconds: number, durationSeconds: number) =>
    track('track_pause', { track_id: trackId, position_seconds: positionSeconds, duration_seconds: durationSeconds }),

  trackSeek: (trackId: string, fromSeconds: number, toSeconds: number) =>
    track('track_seek', { track_id: trackId, from_seconds: fromSeconds, to_seconds: toSeconds }),

  trackComplete: (trackId: string, title: string, artist: string, listenDurationSeconds: number) =>
    track('track_complete', { track_id: trackId, track_title: title, artist, listen_duration_seconds: listenDurationSeconds }),

  // Vocabulary
  vocabUnlock: (trackId: string, term: string, index: number, positionSeconds: number) =>
    track('vocab_unlock', { track_id: trackId, vocab_term: term, vocab_index: index, position_seconds: positionSeconds }),

  vocabToastClick: (trackId: string, term: string) =>
    track('vocab_toast_click', { track_id: trackId, vocab_term: term }),

  vocabPanelOpen: (trackId: string, unlockedCount: number, totalCount: number, trigger: string) =>
    track('vocab_panel_open', { track_id: trackId, unlocked_count: unlockedCount, total_count: totalCount, trigger }),

  vocabSeekToWord: (trackId: string, term: string, positionSeconds: number) =>
    track('vocab_seek_to_word', { track_id: trackId, vocab_term: term, position_seconds: positionSeconds }),

  // Navigation
  trackChange: (fromTrackId: string, toTrackId: string, direction: 'next' | 'prev' | 'direct') =>
    track('track_change', { from_track_id: fromTrackId, to_track_id: toTrackId, direction }),

  // Progress
  achievementUnlock: (achievementId: string, achievementName: string) =>
    track('achievement_unlock', { achievement_id: achievementId, achievement_name: achievementName }),

  statsView: (stats: { songsCompleted: number; vocabUnlocked: number; minutesListened: number; streak: number }) =>
    track('stats_panel_open', {
      songs_completed: stats.songsCompleted,
      vocab_unlocked: stats.vocabUnlocked,
      minutes_listened: stats.minutesListened,
      current_streak: stats.streak
    }),

  // Session
  sessionStart: (deviceType: DeviceType, playerType: PlayerType) => {
    track('session_start', { device_type: deviceType, player_type: playerType });
    window.gtag?.('set', 'user_properties', { device_type: deviceType, player_type: playerType });
  },
};
```

---

## Implementation Steps

1. **Create analytics utility** (`viewer/utils/analytics.ts`)
   - Type-safe wrapper around gtag
   - Development mode detection (no tracking in dev)
   - Do Not Track header respect

2. **Add gtag script to viewer.html**
   - Load GA4 script asynchronously
   - Configure with measurement ID (env variable or hardcoded)

3. **Integrate tracking calls:**
   - `ViewerApp.tsx`: session_start, screen_view, vocab_unlock
   - `AudioPlayer.tsx` / `VideoPlayer.tsx`: playback events
   - `VocabPanel.tsx`: panel open, seek to word
   - `VocabToast.tsx`: toast click
   - `StatsPanel.tsx`: stats view
   - `useProgress.ts`: achievement unlock

4. **Testing**
   - Use GA4 DebugView for real-time event validation
   - Verify events fire correctly on mobile and desktop
   - Confirm DNT is respected

---

## Key Engagement Metrics (GA4 Reports)

Once implemented, you can build reports for:

| Metric | How to Measure |
|--------|----------------|
| **Track Completion Rate** | `track_complete` / `track_start` events |
| **Avg Listen Duration** | Average `listen_duration_seconds` from track_complete |
| **Vocab Engagement Rate** | Users with `vocab_panel_open` / total users |
| **Toast Click-Through** | `vocab_toast_click` / `vocab_unlock` |
| **Retention (Streaks)** | Distribution of `streak_days` values |
| **Mobile vs Desktop** | Segment all events by `device_type` |
| **Popular Tracks** | `track_start` count by `track_title` |

---

## Environment Configuration

The GA4 measurement ID should be configured via environment variable:

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Update `viewer.html` to use this or hardcode for simplicity.

---

## Verification

1. Run the dev server and open the viewer
2. Open browser DevTools > Network tab
3. Filter by "google" or "collect"
4. Interact with the app (play, pause, open vocab panel, etc.)
5. Verify GA4 requests are sent with correct parameters
6. Check GA4 DebugView in the Analytics console for real-time events
