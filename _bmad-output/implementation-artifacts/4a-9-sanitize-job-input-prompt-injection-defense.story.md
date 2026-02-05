---
status: ready-for-dev
---

# Story 4a.9: Sanitize Job Input (Prompt Injection Defense)

## Story

As a system,
I want to prevent malicious job posts from injecting commands into AI prompts,
So that the app remains secure.

## Acceptance Criteria

**Given** a user pastes job content
**When** the content is sent to Claude API
**Then** the system:

1. **Escapes XML special characters (Round 6 Rubber Duck):** Replace `<` with `&lt;`, `>` with `&gt;`, `&` with `&amp;` in job content before wrapping
2. Wraps job content in XML delimiters per AR-13 (`<job_post>...</job_post>`)
3. **Limits input to 25K tokens with sentence boundary preservation (Round 6 Rubber Duck):** If >25K tokens, truncate at last complete sentence (period + space) before 25K boundary
4. Sanitizes attempts like "Ignore previous instructions"

**And** sanitization happens before API call
**And** if truncated, user sees warning: "⚠️ Job post too long. Last ~5K tokens removed. Analysis may be incomplete. Consider summarizing the job post manually."

## Technical Notes

- From Round 5 Security Audit: prompt injection is HIGH severity risk
- AR-13: prompt boundary enforcement with XML delimiters
- AR-6: max 25K input tokens per generation
- From Chaos Monkey: handle extreme inputs gracefully
