// Re-export shared types from main types file
import type { KaraokeData, KaraokeSegment, KaraokeWord, VocabularyItem } from '../types';
export type { KaraokeData, KaraokeSegment, KaraokeWord, VocabularyItem };

// Playlist types
export interface PlaylistMetadata {
  id: string;
  title: string;
  description: string;
  primaryLanguage: string;
  translationLanguage: string;
  trackCount: number;
  createdAt: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  genre: string;
  difficulty: number;
  vocabularyCount: number;
}

export interface YouTubeInfo {
  videoId: string;
  url: string;
  thumbnailUrl: string;
}

export interface TrackDataFiles {
  spanish: string;
  english: string;
  vocabulary: string;
}

export interface Track {
  id: string;
  order: number;
  metadata: TrackMetadata;
  youtube: YouTubeInfo;
  audioUrl?: string; // Direct audio URL for mobile playback (m4a/mp3)
  dataFiles: TrackDataFiles;
}

export interface PlaylistData {
  playlist: PlaylistMetadata;
  tracks: Track[];
}

// Loaded track data (after fetching JSON files)
export interface LoadedTrackData {
  spanish: KaraokeData;
  english: KaraokeData;
  vocabulary: VocabularyItem[];
}

// Progress tracking types
export interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: string; // "2026-01-12"
}

export interface SongProgress {
  playCount: number;
  completed: boolean; // listened to >80%
  lastPlayed: string; // ISO timestamp
}

export interface VocabProgress {
  unlocked: boolean;
  encounters: number;
}

export interface StatsData {
  totalSongsCompleted: number;
  totalVocabUnlocked: number;
  totalMinutesListened: number;
}

export interface ProgressData {
  streak: StreakData;
  songs: Record<string, SongProgress>;
  vocabulary: Record<string, VocabProgress>; // key: "trackId-term"
  stats: StatsData;
}

// Screen state
export type ScreenType = 'player' | 'vocab' | 'stats';
