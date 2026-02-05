---
status: ready-for-dev
---

# Story 5.1: Hook Strategies Seed Data

## Story

As a developer,
I want default hook strategies bundled with the app,
So that users have options immediately without configuration.

## Acceptance Criteria

**Given** the database is initialized
**When** migrations run
**Then** a `hook_strategies` table is created and seeded with:

- Social Proof (examples: "I've helped 12 clients...", "My clients see 40% increase...")
- Contrarian ("Most freelancers will..., but I...")
- Immediate Value ("Here's a quick win you can implement today...")
- Problem-Aware ("I noticed your team is struggling with...")
- Question-Based ("What if you could reduce costs by 30%?")

**And** each strategy includes 2-3 example openers

## Technical Notes

- AR-18: seed data for default hook strategies
- From implementation artifacts: upwork-proposal-hook-library.md
- FR-5: hook strategy selection
