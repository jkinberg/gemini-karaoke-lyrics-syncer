#!/usr/bin/env npx tsx
/**
 * Playlist Generator Script
 *
 * Generates public/playlist.json from CSV track list and sample folders.
 *
 * Usage: npm run generate:playlist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(ROOT_DIR, 'samples');
const OUTPUT_FILE = path.join(ROOT_DIR, 'public', 'playlist.json');

// Types
interface CsvTrack {
  title: string;
  artist: string;
  album: string;
  youtubeUrl: string;
}

interface KaraokeMetadata {
  title: string;
  artist: string;
  durationMs: number;
  language: string;
  version: string;
}

interface KaraokeData {
  metadata: KaraokeMetadata;
  segments: unknown[];
}

interface VocabularyItem {
  term: { spanish: string; english: string };
  difficulty: number;
}

interface PlaylistTrack {
  id: string;
  order: number;
  metadata: {
    title: string;
    artist: string;
    album: string;
    durationMs: number;
    genre: string;
    difficulty: number;
    vocabularyCount: number;
  };
  youtube: {
    videoId: string;
    url: string;
    thumbnailUrl: string;
  };
  dataFiles: {
    spanish: string;
    english: string;
    vocabulary: string;
  };
}

interface Playlist {
  playlist: {
    id: string;
    title: string;
    description: string;
    primaryLanguage: string;
    translationLanguage: string;
    trackCount: number;
    createdAt: string;
  };
  tracks: PlaylistTrack[];
}

// Helper: Parse CSV line handling quoted fields
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: Extract YouTube video ID from URL
function extractVideoId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : '';
}

// Helper: Normalize string for matching
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\([^)]*\)/g, '')        // Remove parentheticals like "(feat. Drake)"
    .replace(/[^a-z0-9]/g, '');       // Remove non-alphanumeric
}

// Helper: Extract core title words for matching
function extractCoreTitleWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // Remove parentheticals
    .split(/\s+/)
    .filter(word => word.length > 2);
}

// Helper: Calculate average difficulty from vocabulary
function calculateAverageDifficulty(vocabulary: VocabularyItem[]): number {
  if (vocabulary.length === 0) return 5;
  const sum = vocabulary.reduce((acc, item) => acc + item.difficulty, 0);
  return Math.round(sum / vocabulary.length);
}

// Main
async function main() {
  console.log('Playlist Generator');
  console.log('==================\n');

  // Read CSV file
  const csvPath = path.join(SAMPLES_DIR, 'Bad Bunny Playlist - Sheet1.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1);

  console.log(`Found ${dataLines.length} tracks in CSV\n`);

  // Parse CSV tracks
  const csvTracks: CsvTrack[] = dataLines.map(line => {
    const [title, artist, album, youtubeUrl] = parseCsvLine(line);
    return { title, artist, album, youtubeUrl };
  });

  // Get sample folders
  const sampleFolders = fs.readdirSync(SAMPLES_DIR)
    .filter(f => {
      const stat = fs.statSync(path.join(SAMPLES_DIR, f));
      return stat.isDirectory() && !f.startsWith('00-');
    })
    .sort();

  console.log(`Found ${sampleFolders.length} sample folders\n`);

  // Match tracks to folders
  const tracks: PlaylistTrack[] = [];
  let order = 1;

  for (const csvTrack of csvTracks) {
    const normalizedTitle = normalize(csvTrack.title);

    // Find matching folder
    const coreWords = extractCoreTitleWords(csvTrack.title);
    const matchingFolder = sampleFolders.find(folder => {
      const folderNormalized = normalize(folder);
      // Check if folder contains the normalized title
      if (folderNormalized.includes(normalizedTitle)) return true;
      // Check if folder contains the first significant word of the title
      if (normalizedTitle.length >= 3 && folderNormalized.includes(normalizedTitle)) return true;
      // Check if all core words appear in folder name (with partial match for plurals)
      if (coreWords.length > 0 && coreWords.every(word => {
        // Try exact match first, then try without trailing 's' (plural handling)
        return folderNormalized.includes(word) ||
               (word.endsWith('s') && folderNormalized.includes(word.slice(0, -1)));
      })) return true;
      return false;
    });

    if (!matchingFolder) {
      console.warn(`⚠ No folder match for: "${csvTrack.title}"`);
      continue;
    }

    const folderPath = path.join(SAMPLES_DIR, matchingFolder);
    const spanishPath = path.join(folderPath, 'spanish_karaoke_data.json');
    const englishPath = path.join(folderPath, 'english_karaoke_data.json');
    const vocabPath = path.join(folderPath, 'vocabulary.json');

    // Check required files exist
    if (!fs.existsSync(spanishPath)) {
      console.warn(`⚠ Missing spanish_karaoke_data.json in: ${matchingFolder}`);
      continue;
    }

    // Load karaoke data for duration
    const karaokeData: KaraokeData = JSON.parse(fs.readFileSync(spanishPath, 'utf-8'));
    const durationMs = karaokeData.metadata?.durationMs || 0;

    // Load vocabulary for count and difficulty
    let vocabularyCount = 0;
    let difficulty = 5;
    if (fs.existsSync(vocabPath)) {
      const vocabulary: VocabularyItem[] = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
      vocabularyCount = vocabulary.length;
      difficulty = calculateAverageDifficulty(vocabulary);
    }

    const videoId = extractVideoId(csvTrack.youtubeUrl);

    const track: PlaylistTrack = {
      id: matchingFolder,
      order: order++,
      metadata: {
        title: csvTrack.title,
        artist: csvTrack.artist,
        album: csvTrack.album,
        durationMs,
        genre: 'Reggaeton', // Default for Bad Bunny playlist
        difficulty,
        vocabularyCount,
      },
      youtube: {
        videoId,
        url: csvTrack.youtubeUrl,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      },
      dataFiles: {
        spanish: `samples/${matchingFolder}/spanish_karaoke_data.json`,
        english: `samples/${matchingFolder}/english_karaoke_data.json`,
        vocabulary: `samples/${matchingFolder}/vocabulary.json`,
      },
    };

    tracks.push(track);
    console.log(`✓ Matched: "${csvTrack.title}" → ${matchingFolder}`);
  }

  // Generate playlist
  const playlist: Playlist = {
    playlist: {
      id: 'bad-bunny-learning',
      title: 'Bad Bunny Spanish Learning Playlist',
      description: 'Learn Spanish through Bad Bunny\'s music with synchronized lyrics and cultural vocabulary',
      primaryLanguage: 'es',
      translationLanguage: 'en',
      trackCount: tracks.length,
      createdAt: new Date().toISOString(),
    },
    tracks,
  };

  // Write output
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(playlist, null, 2));

  console.log(`\n==================`);
  console.log(`Generated: ${OUTPUT_FILE}`);
  console.log(`Tracks: ${tracks.length}/${csvTracks.length}`);
}

main().catch(console.error);
