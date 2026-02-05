---
status: ready-for-dev
---

# Story 1.15: Onboarding Flow (Moved from Epic 8)

## Story

As a new user,
I want guided setup when I first open the app,
So that I can start quickly without confusion.

## Acceptance Criteria

**Given** I'm opening the app for the first time
**When** the app loads
**Then** I see an onboarding wizard with 4 steps:

**Step 1: Welcome**

- "Welcome to Upwork Research Agent!"
- "This tool helps you write personalized proposals faster."

**Step 2: API Key**

- "Enter your Anthropic API key"
- Link: "Get a key at console.anthropic.com"
- Validates key format (starts with "sk-ant-")

**Step 3: Voice Calibration (Optional)**

- "Upload 3-5 past proposals OR answer 5 quick questions"
- "Skip for now" option clearly visible

**Step 4: Ready!**

- "You're all set! Paste a job post to get started."

**And** onboarding can be dismissed and revisited
**And** "Show onboarding again" option in settings
**And** onboarding completion status saved to settings table

## Technical Notes

- **Round 6 Critical Resequencing (Shark Tank):** Moved from Epic 8 to Epic 1. Cannot ship beta test (after Epic 3) without first-launch experience. Users need guided setup from day 1.
- UX-7: expectation management during onboarding
- Clear, simple language
- Optional steps clearly marked (Voice Calibration can be skipped)
- First-launch detection: check settings table for 'onboarding_completed' flag
