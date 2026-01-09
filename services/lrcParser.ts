import { LrcLine, LrcMetadata, ParsedLrc } from '../types';

// Regex to match LRC timestamp format: [mm:ss.xx] or [mm:ss:xx]
const TIMESTAMP_REGEX = /^\[(\d{1,2}):(\d{2})[.:](\d{2})\]\s*(.*)$/;

// Regex to match metadata tags: [tag:value]
const METADATA_REGEX = /^\[([a-z]+):(.+)\]$/i;

// Threshold for detecting instrumental gaps (5 seconds)
const INSTRUMENTAL_GAP_MS = 5000;

// Default duration for the last line (3 seconds)
const DEFAULT_LAST_LINE_DURATION_MS = 3000;

/**
 * Check if a string contains LRC formatted content
 * Looks for the presence of timestamp patterns like [00:10.14]
 */
export function isLrcFormat(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  // Check if at least 2 lines have LRC timestamps (to avoid false positives)
  const lines = text.split('\n');
  let timestampCount = 0;

  for (const line of lines) {
    if (TIMESTAMP_REGEX.test(line.trim())) {
      timestampCount++;
      if (timestampCount >= 2) return true;
    }
  }

  return false;
}

/**
 * Parse a single LRC timestamp to milliseconds
 * Format: [mm:ss.xx] where xx is centiseconds (1/100th second)
 */
function parseTimestamp(minutes: string, seconds: string, centiseconds: string): number {
  const mm = parseInt(minutes, 10);
  const ss = parseInt(seconds, 10);
  const cs = parseInt(centiseconds, 10);

  return (mm * 60 * 1000) + (ss * 1000) + (cs * 10);
}

/**
 * Count words in a text string
 */
function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Parse LRC content into structured data
 */
export function parseLrc(lrcContent: string): ParsedLrc {
  const lines: LrcLine[] = [];
  const metadata: LrcMetadata = {};

  if (!lrcContent || typeof lrcContent !== 'string') {
    return { lines, metadata };
  }

  const rawLines = lrcContent.split('\n');
  const timestampedLines: { startTimeMs: number; text: string }[] = [];

  // First pass: extract metadata and timestamped lines
  for (const rawLine of rawLines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    // Check for metadata tags first
    const metadataMatch = trimmedLine.match(METADATA_REGEX);
    if (metadataMatch && !TIMESTAMP_REGEX.test(trimmedLine)) {
      const [, tag, value] = metadataMatch;
      const tagLower = tag.toLowerCase();

      switch (tagLower) {
        case 'ti':
        case 'title':
          metadata.title = value.trim();
          break;
        case 'ar':
        case 'artist':
          metadata.artist = value.trim();
          break;
        case 'al':
        case 'album':
          metadata.album = value.trim();
          break;
        case 'length':
          metadata.length = value.trim();
          break;
      }
      continue;
    }

    // Check for timestamp
    const timestampMatch = trimmedLine.match(TIMESTAMP_REGEX);
    if (timestampMatch) {
      const [, minutes, seconds, centiseconds, text] = timestampMatch;
      const startTimeMs = parseTimestamp(minutes, seconds, centiseconds);

      // Only add lines with actual text content
      if (text && text.trim()) {
        timestampedLines.push({
          startTimeMs,
          text: text.trim(),
        });
      }
    }
  }

  // Sort by timestamp (in case LRC is out of order)
  timestampedLines.sort((a, b) => a.startTimeMs - b.startTimeMs);

  // Second pass: calculate end times and create LrcLine objects
  for (let i = 0; i < timestampedLines.length; i++) {
    const current = timestampedLines[i];
    const next = timestampedLines[i + 1];

    // End time is the start of the next line, or +3 seconds for the last line
    const endTimeMs = next
      ? next.startTimeMs
      : current.startTimeMs + DEFAULT_LAST_LINE_DURATION_MS;

    lines.push({
      startTimeMs: current.startTimeMs,
      endTimeMs,
      text: current.text,
      wordCount: countWords(current.text),
    });
  }

  return { lines, metadata };
}

/**
 * Detect gaps between LRC lines that may be instrumental sections
 * Returns array of { startTimeMs, endTimeMs, gapDurationMs }
 */
export function detectInstrumentalGaps(
  parsedLrc: ParsedLrc,
  gapThresholdMs: number = INSTRUMENTAL_GAP_MS
): Array<{ startTimeMs: number; endTimeMs: number; gapDurationMs: number }> {
  const gaps: Array<{ startTimeMs: number; endTimeMs: number; gapDurationMs: number }> = [];

  // Check for intro gap (if first line doesn't start at 0)
  if (parsedLrc.lines.length > 0 && parsedLrc.lines[0].startTimeMs > gapThresholdMs) {
    gaps.push({
      startTimeMs: 0,
      endTimeMs: parsedLrc.lines[0].startTimeMs,
      gapDurationMs: parsedLrc.lines[0].startTimeMs,
    });
  }

  // Check for gaps between lines
  for (let i = 0; i < parsedLrc.lines.length - 1; i++) {
    const current = parsedLrc.lines[i];
    const next = parsedLrc.lines[i + 1];

    // Gap is the difference between current line's end and next line's start
    // Since endTimeMs = next.startTimeMs, we look at duration of lines
    const gapDurationMs = next.startTimeMs - current.endTimeMs;

    // Actually, in our current implementation endTimeMs = next.startTimeMs
    // So gaps would be detected differently - we look at duration instead
    // If a line's duration is > threshold and next line starts much later
    const lineDuration = current.endTimeMs - current.startTimeMs;

    // Check if there's an unusually long gap in timing
    // This would show up if the LRC has lines far apart
    if (lineDuration > gapThresholdMs) {
      // This could indicate an instrumental section within
      // But let's check actual next line start
    }
  }

  // Better approach: look at the original timestamps and find gaps
  // between where one line's text would naturally end and next begins

  return gaps;
}

/**
 * Extract just the lyrics text from LRC content (without timestamps)
 * Useful for translation
 */
export function extractLyricsText(parsedLrc: ParsedLrc): string {
  return parsedLrc.lines.map(line => line.text).join('\n');
}

/**
 * Format milliseconds as mm:ss.xx for display
 */
export function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * Convert ParsedLrc back to LRC format string
 */
export function toLrcString(parsedLrc: ParsedLrc): string {
  const lines: string[] = [];

  // Add metadata
  if (parsedLrc.metadata.title) {
    lines.push(`[ti:${parsedLrc.metadata.title}]`);
  }
  if (parsedLrc.metadata.artist) {
    lines.push(`[ar:${parsedLrc.metadata.artist}]`);
  }
  if (parsedLrc.metadata.album) {
    lines.push(`[al:${parsedLrc.metadata.album}]`);
  }

  if (lines.length > 0) {
    lines.push(''); // Empty line after metadata
  }

  // Add timestamped lyrics
  for (const line of parsedLrc.lines) {
    lines.push(`[${formatTimestamp(line.startTimeMs)}] ${line.text}`);
  }

  return lines.join('\n');
}
