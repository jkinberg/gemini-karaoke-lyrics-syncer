export interface KaraokeWord {
  word: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface KaraokeSegment {
  type: 'LYRIC' | 'INSTRUMENTAL';
  startTimeMs: number;
  endTimeMs: number;
  cueText?: string;
  text?: string;
  segmentIndex: number;
  words?: KaraokeWord[];
}

export interface KaraokeMetadata {
  title: string;
  artist: string;
  durationMs: number;
  language: 'es-ES' | 'en-US';
  version: string;
}

export interface KaraokeData {
  metadata: KaraokeMetadata;
  segments: KaraokeSegment[];
}

export interface KaraokeApiResponse {
  spanish: KaraokeData;
  english: KaraokeData;
}

export interface VocabularyItem {
  term: {
    spanish: string;
    english: string;
  };
  definition: string;
  difficulty: number;
  example: {
    spanish: string;
    english: string;
  };
  highlight: {
    spanish: string;
    english: string;
  };
  startTimeMs: number;
  endTimeMs: number;
  segmentIndex: number;
}

// LRC (LyRiCs) file types for improved synchronization
export interface LrcLine {
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  wordCount: number;
}

export interface LrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  length?: string;
}

export interface DetectedSection {
  type: 'intro' | 'interlude' | 'skit' | 'outro';
  startTimeMs: number;
  endTimeMs: number;
  description?: string;
  insertAfterLineIndex: number;  // -1 for intro (before all lyrics)
}

export interface ParsedLrc {
  lines: LrcLine[];
  metadata: LrcMetadata;
  detectedSections?: DetectedSection[];  // Non-lyric sections detected during LRC correction
}