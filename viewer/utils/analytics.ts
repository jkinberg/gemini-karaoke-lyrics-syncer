// Google Analytics 4 integration for karaoke viewer
// Tracks user engagement with tracks, vocabulary learning, and retention

export type DeviceType = 'mobile' | 'desktop';
export type PlayerType = 'audio' | 'video';
export type ScreenName = 'player' | 'vocab_panel' | 'stats_panel';
export type VocabPanelTrigger = 'tap' | 'swipe' | 'toast' | 'end_screen';
export type TrackChangeDirection = 'next' | 'prev' | 'direct';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const isAnalyticsEnabled = (): boolean => {
  // Disable in dev mode
  if (import.meta.env.DEV) return false;
  // Respect Do Not Track header
  if (navigator.doNotTrack === '1') return false;
  // Check if gtag is loaded
  return typeof window.gtag === 'function';
};

const track = (eventName: string, params?: Record<string, unknown>) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.('event', eventName, params);
};

export const analytics = {
  // Screen views
  screenView: (screenName: ScreenName) =>
    track('screen_view', { screen_name: screenName }),

  // Session events
  sessionStart: (deviceType: DeviceType, playerType: PlayerType) => {
    track('session_start', { device_type: deviceType, player_type: playerType });
    // Set user properties for segmentation
    if (isAnalyticsEnabled()) {
      window.gtag?.('set', 'user_properties', {
        device_type: deviceType,
        player_type: playerType,
      });
    }
  },

  unmuteAction: (trackId: string, deviceType: DeviceType) =>
    track('unmute_action', { track_id: trackId, device_type: deviceType }),

  // Playback events
  trackStart: (trackId: string, title: string, artist: string, deviceType: DeviceType) =>
    track('track_start', {
      track_id: trackId,
      track_title: title,
      artist,
      device_type: deviceType,
    }),

  trackPlay: (trackId: string, positionSeconds: number) =>
    track('track_play', {
      track_id: trackId,
      position_seconds: Math.round(positionSeconds),
    }),

  trackPause: (trackId: string, positionSeconds: number, durationSeconds: number) =>
    track('track_pause', {
      track_id: trackId,
      position_seconds: Math.round(positionSeconds),
      duration_seconds: Math.round(durationSeconds),
    }),

  trackSeek: (trackId: string, fromSeconds: number, toSeconds: number) =>
    track('track_seek', {
      track_id: trackId,
      from_seconds: Math.round(fromSeconds),
      to_seconds: Math.round(toSeconds),
    }),

  trackComplete: (trackId: string, title: string, artist: string, listenDurationSeconds: number) =>
    track('track_complete', {
      track_id: trackId,
      track_title: title,
      artist,
      listen_duration_seconds: Math.round(listenDurationSeconds),
    }),

  trackEnded: (trackId: string, completionPercent: number) =>
    track('track_ended', {
      track_id: trackId,
      completion_percent: Math.round(completionPercent),
    }),

  // Navigation events
  trackChange: (fromTrackId: string, toTrackId: string, direction: TrackChangeDirection) =>
    track('track_change', {
      from_track_id: fromTrackId,
      to_track_id: toTrackId,
      direction,
    }),

  playAgain: (trackId: string) =>
    track('play_again', { track_id: trackId }),

  playNext: (fromTrackId: string, toTrackId: string) =>
    track('play_next', {
      from_track_id: fromTrackId,
      to_track_id: toTrackId,
    }),

  skipIntro: (trackId: string, introLengthSeconds: number) =>
    track('skip_intro', {
      track_id: trackId,
      intro_length_seconds: Math.round(introLengthSeconds),
    }),

  // Vocabulary learning events
  vocabUnlock: (trackId: string, term: string, index: number, positionSeconds: number) =>
    track('vocab_unlock', {
      track_id: trackId,
      vocab_term: term,
      vocab_index: index,
      position_seconds: Math.round(positionSeconds),
    }),

  vocabToastShown: (trackId: string, term: string) =>
    track('vocab_toast_shown', {
      track_id: trackId,
      vocab_term: term,
    }),

  vocabToastClick: (trackId: string, term: string) =>
    track('vocab_toast_click', {
      track_id: trackId,
      vocab_term: term,
    }),

  vocabPanelOpen: (
    trackId: string,
    unlockedCount: number,
    totalCount: number,
    trigger: VocabPanelTrigger
  ) =>
    track('vocab_panel_open', {
      track_id: trackId,
      unlocked_count: unlockedCount,
      total_count: totalCount,
      trigger,
    }),

  vocabSeekToWord: (trackId: string, term: string, positionSeconds: number) =>
    track('vocab_seek_to_word', {
      track_id: trackId,
      vocab_term: term,
      position_seconds: Math.round(positionSeconds),
    }),

  // Progress & achievement events
  achievementUnlock: (achievementId: string, achievementName: string) =>
    track('achievement_unlock', {
      achievement_id: achievementId,
      achievement_name: achievementName,
    }),

  streakUpdated: (streakDays: number, isNewLongest: boolean) =>
    track('streak_updated', {
      streak_days: streakDays,
      is_new_longest: isNewLongest,
    }),

  statsView: (stats: {
    songsCompleted: number;
    vocabUnlocked: number;
    minutesListened: number;
    streak: number;
  }) =>
    track('stats_panel_open', {
      songs_completed: stats.songsCompleted,
      vocab_unlocked: stats.vocabUnlocked,
      minutes_listened: Math.round(stats.minutesListened),
      current_streak: stats.streak,
    }),
};
