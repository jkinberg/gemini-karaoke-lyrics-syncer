// This file contains a pre-validated, "known-good" test case for the diagnostic tool.
// The timing data has been manually reviewed and corrected to ensure it is as accurate as possible.
// This allows for reliable testing of the KaraokePreview component's rendering and synchronization logic.

export const testCase = {
  lyrics: {
    spanish: `[Intro]
(Instrumental)

[Estrofa 1]
Si el ritmo te lleva a mover la cabeza
Ya empezamos como es
Mi música no discrimina a nadie
Así que vamos a romper

[Estribillo]
Toda mi gente se mueve
Mira el ritmo cómo los tiene
Hago música que entretiene
El mundo nos quiere, nos quiere y me quiere a mí`,
    english: `[Intro]
(Instrumental)

[Verse 1]
If the rhythm makes your head move
We've already started as it should
My music doesn't discriminate against anyone
So let's break it down

[Chorus]
All my people are moving
Look at how the rhythm has them
I make music that entertains
The world wants us, wants us, and it wants me`
  },
  karaokeData: {
    spanish: {
      "metadata": {
        "title": "Mi Gente",
        "artist": "J Balvin, Willy William",
        "durationMs": 28450,
        "language": "es-ES",
        "version": "1.1"
      },
      "segments": [
        {
          "type": "INSTRUMENTAL",
          "startTimeMs": 0,
          "endTimeMs": 8048,
          "cueText": "Intro",
          "segmentIndex": 1
        },
        {
          "type": "LYRIC",
          "startTimeMs": 8100,
          "endTimeMs": 11530,
          "text": "Si el ritmo te lleva a mover la cabeza",
          "segmentIndex": 2,
          "words": [
            { "word": "Si", "startTimeMs": 8178, "endTimeMs": 8418 },
            { "word": "el", "startTimeMs": 8418, "endTimeMs": 8638 },
            { "word": "ritmo", "startTimeMs": 8638, "endTimeMs": 9048 },
            { "word": "te", "startTimeMs": 9048, "endTimeMs": 9188 },
            { "word": "lleva", "startTimeMs": 9188, "endTimeMs": 9558 },
            { "word": "a", "startTimeMs": 9558, "endTimeMs": 9708 },
            { "word": "mover", "startTimeMs": 9708, "endTimeMs": 10118 },
            { "word": "la", "startTimeMs": 10118, "endTimeMs": 10258 },
            { "word": "cabeza", "startTimeMs": 10258, "endTimeMs": 10900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 11600,
          "endTimeMs": 13200,
          "text": "Ya empezamos como es",
          "segmentIndex": 3,
          "words": [
            { "word": "Ya", "startTimeMs": 11800, "endTimeMs": 12000 },
            { "word": "empezamos", "startTimeMs": 12000, "endTimeMs": 12600 },
            { "word": "como", "startTimeMs": 12600, "endTimeMs": 12900 },
            { "word": "es", "startTimeMs": 12900, "endTimeMs": 13100 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 13300,
          "endTimeMs": 15900,
          "text": "Mi música no discrimina a nadie",
          "segmentIndex": 4,
          "words": [
            { "word": "Mi", "startTimeMs": 13600, "endTimeMs": 13800 },
            { "word": "música", "startTimeMs": 13800, "endTimeMs": 14300 },
            { "word": "no", "startTimeMs": 14300, "endTimeMs": 14500 },
            { "word": "discrimina", "startTimeMs": 14500, "endTimeMs": 15200 },
            { "word": "a", "startTimeMs": 15200, "endTimeMs": 15400 },
            { "word": "nadie", "startTimeMs": 15400, "endTimeMs": 15800 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 16000,
          "endTimeMs": 17800,
          "text": "Así que vamos a romper",
          "segmentIndex": 5,
          "words": [
            { "word": "Así", "startTimeMs": 16200, "endTimeMs": 16500 },
            { "word": "que", "startTimeMs": 16500, "endTimeMs": 16700 },
            { "word": "vamos", "startTimeMs": 16700, "endTimeMs": 17100 },
            { "word": "a", "startTimeMs": 17100, "endTimeMs": 17200 },
            { "word": "romper", "startTimeMs": 17200, "endTimeMs": 17700 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 18200,
          "endTimeMs": 20000,
          "text": "Toda mi gente se mueve",
          "segmentIndex": 6,
          "words": [
            { "word": "Toda", "startTimeMs": 18500, "endTimeMs": 18800 },
            { "word": "mi", "startTimeMs": 18800, "endTimeMs": 19000 },
            { "word": "gente", "startTimeMs": 19000, "endTimeMs": 19400 },
            { "word": "se", "startTimeMs": 19400, "endTimeMs": 19600 },
            { "word": "mueve", "startTimeMs": 19600, "endTimeMs": 19900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 20100,
          "endTimeMs": 22000,
          "text": "Mira el ritmo cómo los tiene",
          "segmentIndex": 7,
          "words": [
            { "word": "Mira", "startTimeMs": 20300, "endTimeMs": 20600 },
            { "word": "el", "startTimeMs": 20600, "endTimeMs": 20700 },
            { "word": "ritmo", "startTimeMs": 20700, "endTimeMs": 21100 },
            { "word": "cómo", "startTimeMs": 21100, "endTimeMs": 21400 },
            { "word": "los", "startTimeMs": 21400, "endTimeMs": 21600 },
            { "word": "tiene", "startTimeMs": 21600, "endTimeMs": 21900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 22100,
          "endTimeMs": 24000,
          "text": "Hago música que entretiene",
          "segmentIndex": 8,
          "words": [
            { "word": "Hago", "startTimeMs": 22400, "endTimeMs": 22700 },
            { "word": "música", "startTimeMs": 22700, "endTimeMs": 23200 },
            { "word": "que", "startTimeMs": 23200, "endTimeMs": 23400 },
            { "word": "entretiene", "startTimeMs": 23400, "endTimeMs": 23900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 24100,
          "endTimeMs": 28450,
          "text": "El mundo nos quiere, nos quiere y me quiere a mí",
          "segmentIndex": 9,
          "words": [
            { "word": "El", "startTimeMs": 24200, "endTimeMs": 24400 },
            { "word": "mundo", "startTimeMs": 24400, "endTimeMs": 24800 },
            { "word": "nos", "startTimeMs": 24800, "endTimeMs": 25000 },
            { "word": "quiere,", "startTimeMs": 25000, "endTimeMs": 25400 },
            { "word": "nos", "startTimeMs": 25500, "endTimeMs": 25800 },
            { "word": "quiere", "startTimeMs": 25800, "endTimeMs": 26200 },
            { "word": "y", "startTimeMs": 26300, "endTimeMs": 26400 },
            { "word": "me", "startTimeMs": 26400, "endTimeMs": 26600 },
            { "word": "quiere", "startTimeMs": 26600, "endTimeMs": 27000 },
            { "word": "a", "startTimeMs": 27000, "endTimeMs": 27200 },
            { "word": "mí", "startTimeMs": 27200, "endTimeMs": 27500 }
          ]
        }
      ]
    },
    english: {
      "metadata": {
        "title": "Mi Gente",
        "artist": "J Balvin, Willy William",
        "durationMs": 28450,
        "language": "en-US",
        "version": "1.1"
      },
      "segments": [
        {
          "type": "INSTRUMENTAL",
          "startTimeMs": 0,
          "endTimeMs": 8048,
          "cueText": "Intro",
          "segmentIndex": 1
        },
        {
          "type": "LYRIC",
          "startTimeMs": 8100,
          "endTimeMs": 11530,
          "text": "If the rhythm makes your head move",
          "segmentIndex": 2,
          "words": [
            { "word": "If", "startTimeMs": 8178, "endTimeMs": 8418 },
            { "word": "the", "startTimeMs": 8418, "endTimeMs": 8638 },
            { "word": "rhythm", "startTimeMs": 8638, "endTimeMs": 9048 },
            { "word": "makes", "startTimeMs": 9048, "endTimeMs": 9558 },
            { "word": "your", "startTimeMs": 9558, "endTimeMs": 9708 },
            { "word": "head", "startTimeMs": 9708, "endTimeMs": 10118 },
            { "word": "move", "startTimeMs": 10118, "endTimeMs": 10900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 11600,
          "endTimeMs": 13200,
          "text": "We've already started as it should",
          "segmentIndex": 3,
          "words": [
            { "word": "We've", "startTimeMs": 11800, "endTimeMs": 12000 },
            { "word": "already", "startTimeMs": 12000, "endTimeMs": 12400 },
            { "word": "started", "startTimeMs": 12400, "endTimeMs": 12800 },
            { "word": "as", "startTimeMs": 12800, "endTimeMs": 12900 },
            { "word": "it", "startTimeMs": 12900, "endTimeMs": 13000 },
            { "word": "should", "startTimeMs": 13000, "endTimeMs": 13100 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 13300,
          "endTimeMs": 15900,
          "text": "My music doesn't discriminate against anyone",
          "segmentIndex": 4,
          "words": [
            { "word": "My", "startTimeMs": 13600, "endTimeMs": 13800 },
            { "word": "music", "startTimeMs": 13800, "endTimeMs": 14300 },
            { "word": "doesn't", "startTimeMs": 14300, "endTimeMs": 14600 },
            { "word": "discriminate", "startTimeMs": 14600, "endTimeMs": 15300 },
            { "word": "against", "startTimeMs": 15300, "endTimeMs": 15600 },
            { "word": "anyone", "startTimeMs": 15600, "endTimeMs": 15800 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 16000,
          "endTimeMs": 17800,
          "text": "So let's break it down",
          "segmentIndex": 5,
          "words": [
            { "word": "So", "startTimeMs": 16200, "endTimeMs": 16500 },
            { "word": "let's", "startTimeMs": 16500, "endTimeMs": 16800 },
            { "word": "break", "startTimeMs": 16800, "endTimeMs": 17100 },
            { "word": "it", "startTimeMs": 17100, "endTimeMs": 17200 },
            { "word": "down", "startTimeMs": 17200, "endTimeMs": 17700 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 18200,
          "endTimeMs": 20000,
          "text": "All my people are moving",
          "segmentIndex": 6,
          "words": [
            { "word": "All", "startTimeMs": 18500, "endTimeMs": 18800 },
            { "word": "my", "startTimeMs": 18800, "endTimeMs": 19000 },
            { "word": "people", "startTimeMs": 19000, "endTimeMs": 19400 },
            { "word": "are", "startTimeMs": 19400, "endTimeMs": 19600 },
            { "word": "moving", "startTimeMs": 19600, "endTimeMs": 19900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 20100,
          "endTimeMs": 22000,
          "text": "Look at how the rhythm has them",
          "segmentIndex": 7,
          "words": [
            { "word": "Look", "startTimeMs": 20300, "endTimeMs": 20600 },
            { "word": "at", "startTimeMs": 20600, "endTimeMs": 20700 },
            { "word": "how", "startTimeMs": 20700, "endTimeMs": 20900 },
            { "word": "the", "startTimeMs": 20900, "endTimeMs": 21000 },
            { "word": "rhythm", "startTimeMs": 21000, "endTimeMs": 21400 },
            { "word": "has", "startTimeMs": 21400, "endTimeMs": 21600 },
            { "word": "them", "startTimeMs": 21600, "endTimeMs": 21900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 22100,
          "endTimeMs": 24000,
          "text": "I make music that entertains",
          "segmentIndex": 8,
          "words": [
            { "word": "I", "startTimeMs": 22400, "endTimeMs": 22500 },
            { "word": "make", "startTimeMs": 22500, "endTimeMs": 22800 },
            { "word": "music", "startTimeMs": 22800, "endTimeMs": 23200 },
            { "word": "that", "startTimeMs": 23200, "endTimeMs": 23400 },
            { "word": "entertains", "startTimeMs": 23400, "endTimeMs": 23900 }
          ]
        },
        {
          "type": "LYRIC",
          "startTimeMs": 24100,
          "endTimeMs": 28450,
          "text": "The world wants us, wants us, and it wants me",
          "segmentIndex": 9,
          "words": [
            { "word": "The", "startTimeMs": 24200, "endTimeMs": 24400 },
            { "word": "world", "startTimeMs": 24400, "endTimeMs": 24800 },
            { "word": "wants", "startTimeMs": 24800, "endTimeMs": 25100 },
            { "word": "us,", "startTimeMs": 25100, "endTimeMs": 25400 },
            { "word": "wants", "startTimeMs": 25500, "endTimeMs": 25800 },
            { "word": "us,", "startTimeMs": 25800, "endTimeMs": 26200 },
            { "word": "and", "startTimeMs": 26300, "endTimeMs": 26400 },
            { "word": "it", "startTimeMs": 26400, "endTimeMs": 26600 },
            { "word": "wants", "startTimeMs": 26600, "endTimeMs": 27000 },
            { "word": "me", "startTimeMs": 27000, "endTimeMs": 27500 }
          ]
        }
      ]
    }
  }
};
