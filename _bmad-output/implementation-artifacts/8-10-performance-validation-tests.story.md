---
status: ready-for-dev
---

# Story 8.10: Performance Validation Tests

## Story

As a developer,
I want automated tests for performance targets,
So that we don't regress on NFRs.

## Acceptance Criteria

**Given** performance test suite is configured
**When** tests run
**Then** the following are validated:

- NFR-1: App startup <2 seconds
- NFR-4: UI response <100ms (click to render)
- NFR-5: Streaming start <1.5s
- NFR-6: Full generation <8s
- NFR-17: Query performance <500ms (100 proposals)

**And** tests fail if any threshold is exceeded
**And** results are logged with timing data

## Technical Notes

- Automated performance regression detection
- Run in CI on every PR
- Alerts if performance degrades
