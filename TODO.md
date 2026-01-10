# TODO

## Auto-Fix Performance Optimization - COMPLETED

**Problem:** Auto-fix was very slow when fixing many segments (69 segments = ~25-30 min per iteration).

**Previous behavior:**
- Batched segments in groups of 10 to avoid truncation
- Refined Spanish batches sequentially (Gemini Pro with audio)
- Refined English batches sequentially (Gemini Pro with audio)
- 69 segments = 7 Spanish batches + 7 English batches = 14 API calls per iteration
- Each Pro call took ~100-130 seconds

**Solution implemented:**
1. **Spanish as source of truth** - Only refine Spanish segments with Gemini Pro + audio
2. **Flash for English alignment** - After Spanish is refined, use `alignTranslatedToRefinedOriginal()` with Gemini Flash (text-only, no audio) to realign all English words to match Spanish segment timing
3. **Single Flash call** - Instead of batching English, one Flash call realigns the entire English karaoke data

**Performance improvement:**
- Spanish: 7 batches × ~120s = ~14 minutes
- English: 1 Flash call × ~20s = ~20 seconds
- **Total: ~14.5 minutes per iteration (vs ~30 minutes previously) - 50% faster**

**Files modified:**
- `services/geminiService.ts`: Updated `autoRefineKaraokeData()` to use Flash for English realignment

---

## Future Ideas

- [ ] Parallelize Spanish batch API calls (with rate limiting consideration)
- [ ] Increase batch size for shorter songs where truncation is less likely
- [ ] Add progress estimation based on batch count
