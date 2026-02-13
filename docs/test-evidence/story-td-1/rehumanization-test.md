# Re-humanization Test Results — TD-1 AC-4

## Test Setup

- **Failing proposal:** Proposal 5 (Copywriting, Creative domain)
- **Original score:** 74.28% AI detection (ZeroGPT)
- **Re-humanization approach:** Medium humanization + attempt-specific boost prompt
- **Script:** `test-rehumanize.mjs`

## Boost 1 Prompt (attempt 1)

Applied in addition to medium humanization:
```
IMPORTANT — PREVIOUS VERSION WAS FLAGGED AS AI-GENERATED. Apply these additional fixes:
- Rewrite the opening sentence to be more specific and personal (reference a real-sounding detail)
- Break up any paragraph longer than 3 sentences into two shorter ones
- Add one conversational aside you wouldn't see in formal writing
- Make sure no two consecutive sentences start the same way
- Include at least one short reaction or opinion ("Neat.", "That's smart.", "Big fan of that approach.")
```

## Results

| Version | AI % | Verdict | Pass |
|---------|------|---------|------|
| Original (medium only) | 74.28% | "Mixed signals" | FAIL |
| Re-humanized (medium + boost 1) | **16.28%** | "Human Written" | **PASS** |

**Improvement: 58 percentage points reduction in AI detection score.**

Boost 2 was not needed — boost 1 already passed.

## Analysis

The re-humanization boost works because it:
1. Forces a specific personal detail (warehouse management tool launch, 23% conversion rate)
2. Breaks uniform paragraph structure
3. Adds conversational elements ("Quick question:", "before midnight panic checks")
4. Introduces an unexpected structural element (sign-off with "Best, [Your name]")
5. Creates more burstiness in sentence length

## AC-4 Status: MET

One-click re-humanization successfully recovers failing proposals. The boost prompt targets the specific statistical signals (uniform structure, predictable patterns) that AI detectors flag.
