# TODO

## Auto-Fix Performance Optimization

**Problem:** Auto-fix is very slow when fixing many segments (69 segments = ~25-30 min per iteration).

**Current behavior:**
- Batches segments in groups of 10 to avoid truncation
- Refines Spanish batches sequentially (Gemini Pro with audio)
- Refines English batches sequentially (Gemini Pro with audio)
- 69 segments = 7 Spanish batches + 7 English batches = 14 API calls per iteration
- Each call takes ~100-130 seconds

**Proposed optimization:**
1. **Spanish as source of truth** - Only refine Spanish segments with Gemini Pro + audio
2. **Flash for English alignment** - After Spanish is refined, use Gemini Flash (text-only, no audio) to realign English words to match Spanish segment timing
3. **Similar to existing refinement flow** - We already do this in `refineKaraokeData()` where English uses `alignTranslatedToRefinedOriginal()` with Flash

**Expected improvement:**
- Spanish: 7 batches × ~120s = ~14 minutes
- English: 7 batches × ~20s (Flash) = ~2.5 minutes
- **Total: ~17 minutes per iteration (vs ~30 minutes currently)**

**Implementation notes:**
- Reuse `alignTranslatedToRefinedOriginal()` or similar text-only alignment
- English doesn't need audio verification - just redistribute words within Spanish segment boundaries
- Could potentially do all English batches in parallel since they're independent text operations

**Files to modify:**
- `services/geminiService.ts`: Update `autoRefineKaraokeData()` to use Flash for English

---

## Future Ideas

- [ ] Parallelize batch API calls (with rate limiting consideration)
- [ ] Increase batch size for shorter songs where truncation is less likely
- [ ] Add progress estimation based on batch count
