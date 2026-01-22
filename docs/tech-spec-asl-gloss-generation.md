# ASL Gloss Generation - Technical Specification

## Overview

This document describes a feature to transform time-synced English karaoke lyrics into ASL (American Sign Language) Gloss notation. ASL Gloss is a written representation of ASL that can later be used to drive a synthetic signing avatar.

## Background

### What is ASL Gloss?

ASL Gloss is a written notation system that represents ASL signs using English words in UPPERCASE. It captures the grammatical structure of ASL, which differs significantly from English:

- **Word order**: ASL typically uses Topic-Comment structure (OSV) vs English SVO
- **Function words**: ASL omits articles (a, an, the), copulas (is, are, am), and many prepositions
- **Indexing**: Pronouns and references use pointing (IX) to established locations
- **Non-manual markers**: Facial expressions and body movements conveyed through notation
- **Classifiers**: Handshape representations of objects/actions (CL:)
- **Fingerspelling**: Proper nouns spelled letter-by-letter (fs-NAME)

### ASL Gloss Conventions

| Convention | Meaning | Example |
|------------|---------|---------|
| UPPERCASE | ASL sign | `LOVE`, `WANT`, `GO` |
| IX-1, IX-2, IX-3 | Index/point (I, you, he/she) | `IX-1 LOVE IX-2` = "I love you" |
| fs-word | Fingerspelling | `fs-MARIA` |
| CL:handshape | Classifier | `CL:3` (vehicle), `CL:1` (person) |
| ++ | Repeated sign | `WORK++` = "working continuously" |
| #word | Lexicalized fingerspelling | `#WHAT`, `#JOB` |
| __t__ | Topic marker (raised eyebrows) | `MOVIE __t__, IX-1 LIKE` |
| __q__ | Question (furrowed brows, head forward) | `IX-2 NAME WHAT __q__` |
| __neg__ | Negation (head shake) | `IX-1 LIKE NOT __neg__` |
| __rhq__ | Rhetorical question | `WHY IX-1 GO __rhq__` |

## Data Structures

### Input: English KaraokeData

```typescript
interface KaraokeData {
  metadata: {
    title: string;
    artist: string;
    language: string;
    durationMs: number;
  };
  segments: KaraokeSegment[];
}

interface KaraokeSegment {
  segmentIndex: number;
  type: 'LYRIC' | 'INSTRUMENTAL';
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  words?: KaraokeWord[];
}

interface KaraokeWord {
  word: string;
  startTimeMs: number;
  endTimeMs: number;
}
```

### Output: ASL Gloss Data

```typescript
interface ASLGlossData {
  metadata: {
    title: string;
    artist: string;
    sourceLanguage: 'english';
    targetLanguage: 'asl-gloss';
    durationMs: number;
    glossVersion: string; // e.g., "1.0"
  };
  segments: ASLGlossSegment[];
}

interface ASLGlossSegment {
  segmentIndex: number;
  type: 'SIGN' | 'INSTRUMENTAL' | 'FINGERSPELL';
  englishText: string;        // Original English
  glossText: string;          // Full gloss notation as string
  startTimeMs: number;
  endTimeMs: number;
  signs: ASLSign[];
  nonManualMarkers?: string[]; // ["__t__", "__q__", etc.]
}

interface ASLSign {
  gloss: string;              // e.g., "LOVE", "IX-1", "fs-MARIA"
  type: 'sign' | 'index' | 'fingerspell' | 'classifier';
  startTimeMs: number;
  endTimeMs: number;
  // Optional enrichment for avatar rendering
  handshape?: string;
  movement?: string;
  location?: string;
}
```

## Transformation Pipeline

### Phase 1: English to ASL Gloss (Gemini API)

Use Gemini to transform English lyrics into ASL Gloss notation:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  English        │     │  Gemini API     │     │  ASL Gloss      │
│  KaraokeData    │────▶│  Transformation │────▶│  Data           │
│  (with timing)  │     │                 │     │  (with timing)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Phase 2: Timing Redistribution

English word timing doesn't map 1:1 to ASL signs. After gloss generation:

1. **Count signs** in each segment
2. **Redistribute timing** evenly across signs within segment boundaries
3. **Adjust for sign complexity** (fingerspelling takes longer)

```typescript
function redistributeSignTiming(
  segment: ASLGlossSegment,
  signs: string[]
): ASLSign[] {
  const segmentDuration = segment.endTimeMs - segment.startTimeMs;
  const totalWeight = signs.reduce((sum, sign) => {
    // Fingerspelling needs more time
    if (sign.startsWith('fs-')) {
      return sum + sign.replace('fs-', '').length * 0.3;
    }
    return sum + 1;
  }, 0);

  let currentTime = segment.startTimeMs;
  return signs.map(sign => {
    const weight = sign.startsWith('fs-')
      ? sign.replace('fs-', '').length * 0.3
      : 1;
    const duration = (weight / totalWeight) * segmentDuration;
    const result = {
      gloss: sign,
      type: classifySignType(sign),
      startTimeMs: Math.round(currentTime),
      endTimeMs: Math.round(currentTime + duration),
    };
    currentTime += duration;
    return result;
  });
}
```

## Gemini Prompt Design

### System Prompt

```
You are an expert ASL (American Sign Language) interpreter and linguist. Your task is to transform English song lyrics into ASL Gloss notation that accurately represents how a Deaf signer would perform these lyrics.

## ASL Gloss Conventions

Use these standard notation conventions:
- UPPERCASE for all signs (e.g., LOVE, DANCE, FEEL)
- IX-1 (I/me), IX-2 (you), IX-3 (he/she/it) for indexing/pointing
- fs-WORD for fingerspelling proper nouns
- CL:X for classifiers (e.g., CL:3 for vehicles, CL:1 for person)
- ++ for repeated/continuous action (e.g., DANCE++)
- __t__ for topic marker, __q__ for questions, __neg__ for negation
- #WORD for lexicalized fingerspelling (e.g., #WHAT, #JOB)

## ASL Grammar Rules

1. Topic-Comment structure: State topic first, then comment
   - English: "I love the music" → ASL: MUSIC, IX-1 LOVE
2. Remove articles (a, an, the), copulas (is, are, was, am)
3. Time markers come first: YESTERDAY IX-1 GO STORE
4. Questions use non-manual markers and often put WH-words at end
5. Negation typically follows the verb: IX-1 LIKE NOT
6. Adjectives often follow nouns: HOUSE BIG (not "big house")

## Song Lyric Considerations

- Preserve emotional intensity through sign choice and repetition
- Use classifiers for visual imagery
- Maintain rhythm where possible through sign grouping
- Some English idioms need cultural translation to ASL equivalents
```

### Request Format

```json
{
  "segments": [
    {
      "segmentIndex": 0,
      "englishText": "I can't stop this feeling",
      "startTimeMs": 5000,
      "endTimeMs": 8500
    },
    {
      "segmentIndex": 1,
      "englishText": "Deep inside of me",
      "startTimeMs": 8500,
      "endTimeMs": 11000
    }
  ]
}
```

### Expected Response Format

```json
{
  "segments": [
    {
      "segmentIndex": 0,
      "englishText": "I can't stop this feeling",
      "glossText": "FEELING IX-1 STOP CAN'T",
      "signs": ["FEELING", "IX-1", "STOP", "CAN'T"],
      "nonManualMarkers": ["__neg__"]
    },
    {
      "segmentIndex": 1,
      "englishText": "Deep inside of me",
      "glossText": "DEEP INSIDE IX-1",
      "signs": ["DEEP", "INSIDE", "IX-1"],
      "nonManualMarkers": []
    }
  ]
}
```

## Implementation Plan

### Files to Create/Modify

| File | Purpose |
|------|---------|
| `services/aslGlossService.ts` | NEW - Gemini API calls for gloss generation |
| `types.ts` | Add ASLGlossData, ASLGlossSegment, ASLSign types |
| `server.ts` | Add `/api/asl-gloss` endpoint |

### API Endpoint

```typescript
// POST /api/asl-gloss
// Request body: { englishData: KaraokeData }
// Response: { glossData: ASLGlossData }
```

### Service Implementation

```typescript
// services/aslGlossService.ts

export async function generateASLGloss(
  englishData: KaraokeData
): Promise<ASLGlossData> {
  // 1. Filter to LYRIC segments only
  const lyricSegments = englishData.segments
    .filter(s => s.type === 'LYRIC');

  // 2. Batch segments (to avoid token limits)
  const batches = batchSegments(lyricSegments, 10);

  // 3. Transform each batch via Gemini
  const glossSegments: ASLGlossSegment[] = [];
  for (const batch of batches) {
    const result = await transformBatchToGloss(batch);
    glossSegments.push(...result);
  }

  // 4. Redistribute timing within each segment
  const timedSegments = glossSegments.map(segment => ({
    ...segment,
    signs: redistributeSignTiming(segment, segment.signs)
  }));

  // 5. Merge back instrumental segments
  const allSegments = mergeWithInstrumentals(
    englishData.segments,
    timedSegments
  );

  return {
    metadata: {
      ...englishData.metadata,
      sourceLanguage: 'english',
      targetLanguage: 'asl-gloss',
      glossVersion: '1.0'
    },
    segments: allSegments
  };
}
```

## Verification Challenges

ASL Gloss accuracy is difficult to verify without ASL expertise. Potential approaches:

### 1. Structural Validation (Automated)
- Verify all signs are UPPERCASE
- Check for common errors (articles not removed, wrong word order)
- Validate notation syntax (IX-, fs-, CL:, etc.)

### 2. Comparison Validation
- Generate multiple versions with different prompts
- Flag segments where outputs differ significantly

### 3. Expert Review (Manual)
- Partner with Deaf consultants or ASL interpreters
- Create review interface for spot-checking

### 4. Community Feedback
- Allow users to flag incorrect glosses
- Build correction dataset over time

## Future Enhancements

### Avatar Integration
The ASLGlossData structure is designed to support avatar rendering:

```typescript
// Future: Map gloss to avatar animation data
interface AvatarSignData extends ASLSign {
  animationId: string;    // Reference to sign animation
  blendShapes?: object;   // Facial expression data
  bodyPose?: object;      // Body orientation
}
```

### Sign Language Variants
The architecture can extend to other signed languages:
- BSL (British Sign Language)
- LSF (French Sign Language)
- DGS (German Sign Language)

Each would need:
- Language-specific gloss conventions
- Adapted Gemini prompts
- Separate timing models (sign languages have different rhythms)

## Limitations

1. **AI Translation Quality**: Gemini may make grammatical errors in ASL structure
2. **Cultural Nuance**: Song idioms may not translate well to ASL equivalents
3. **Timing Precision**: Sign timing is estimated, not verified against actual signing
4. **Regional Variation**: ASL has regional dialects not captured in gloss
5. **Artistic Expression**: Signed music interpretation involves artistic choices an AI may not capture

## References

- [ASL Gloss Conventions](https://www.lifeprint.com/asl101/topics/gloss.htm)
- [SignWriting](https://www.signwriting.org/) - Alternative notation system
- [ASL Linguistics](https://www.gallaudet.edu/department-of-asl-and-deaf-studies)
