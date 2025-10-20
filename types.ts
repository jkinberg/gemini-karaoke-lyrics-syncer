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
