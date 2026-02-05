---
status: ready-for-dev
---

# Story 5.4: Local-Only Voice Analysis

## Story

As a freelancer,
I want my past proposals analyzed locally without sending full text to any server,
So that my competitive writing samples stay private.

## Acceptance Criteria

**Given** I've uploaded 3+ Golden Set proposals
**When** I click "Calibrate Voice"
**Then** the system analyzes locally (frontend or Rust backend):

- Tone: Professional/Casual/Friendly (sentiment analysis)
- Average sentence length
- Vocabulary complexity (Flesch-Kincaid)
- Structure patterns (bullets vs paragraphs)
- Common phrases

**And** extracts only statistical parameters (not raw text)
**And** **calibration completes in <2 seconds for 5 proposals (Round 6 Performance Profiler)**
**And** I see: "✓ Proposals analyzed locally in 1.2s. No text was uploaded."

## Technical Notes

- AR-12: privacy layer - send style params, not raw samples
- All analysis happens client-side
- Only derived parameters sent to Claude in prompts
