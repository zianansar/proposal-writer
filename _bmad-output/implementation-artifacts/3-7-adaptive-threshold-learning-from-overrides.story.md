---
status: ready-for-dev
epic: 3
story: 7
dependencies:
  - 3-1-pre-flight-perplexity-analysis
  - 3-2-safety-warning-screen-with-flagged-sentences
  - 3-5-safety-threshold-configuration
  - 3-6-override-safety-warning
relates_to:
  - 3-3-humanization-injection-during-generation
  - 3-4-one-click-re-humanization
---

# Story 3.7: Adaptive Threshold Learning from Overrides

## Story

As a freelancer,
I want the app to learn from my successful overrides,
So that the threshold adjusts to my risk tolerance over time.

## Acceptance Criteria

### AC1: Override Tracking

**Given** I override a safety warning (Story 3.6)
**When** I click "I Understand the Risks, Proceed Anyway"
**Then** The system records the override event:
- Timestamp of override
- AI detection score that was flagged
- Proposal ID
- Current threshold at time of override
- Status: "pending" (awaiting success confirmation)

**And** The override is stored in `safety_overrides` table

### AC2: Success Definition and Tracking

**Given** An override has been recorded as "pending"
**When** 7 days pass with no negative feedback
**Then** The override status automatically changes to "successful"

**Or When** I explicitly mark the proposal as successful (optional feedback button)
**Then** The override status immediately changes to "successful"

**Or When** I delete or abandon the proposal within 7 days
**Then** The override status changes to "unsuccessful" (not counted toward learning)

### AC3: Learning Threshold Detection

**Given** I have 3 or more "successful" overrides in the last 30 days
**And** All 3 overrides were for scores within 10 points of my current threshold
**When** The 3rd successful override is confirmed
**Then** The system detects a learning opportunity

**And** Only overrides close to the current threshold trigger learning (not extreme outliers)

### AC4: Adaptive Threshold Notification

**Given** The system detected a learning opportunity
**When** I open the app or generate the next proposal
**Then** A prominent notification appears:
- Title: "Adjust Your Safety Threshold?"
- Message: "You've successfully used 3 proposals that were flagged. Your risk tolerance may be higher than your current threshold."
- Current threshold: 180
- Suggested threshold: 190 (current + 10)
- Explanation: "This will reduce false warnings while maintaining safety."
- Buttons: "Yes, Adjust to 190" (primary) | "No, Keep 180" (secondary) | "Remind Me Later"

**And** The notification is non-blocking but persistent until user responds

### AC5: Threshold Adjustment Execution

**Given** I clicked "Yes, Adjust to [new threshold]"
**When** The adjustment is applied
**Then** My safety threshold is updated in settings (Story 3.5)
**And** Future pre-flight analyses (Story 3.1) use the new threshold
**And** The override counter resets to 0
**And** A success toast appears: "Threshold adjusted to 190. Future warnings will be more aligned with your risk tolerance."
**And** The adjustment is logged (Story 1.16)

### AC6: User Rejection or Deferral

**Given** The threshold adjustment notification is shown
**When** I click "No, Keep Current"
**Then** The current threshold remains unchanged
**And** The override counter resets to 0
**And** No further suggestions until I accumulate 3 more successful overrides

**Or When** I click "Remind Me Later"
**Then** The notification dismisses
**And** The override counter is NOT reset
**And** The notification reappears after the next successful override (4th, 5th, etc.)

### AC7: Maximum Threshold Cap

**Given** My current threshold is approaching the maximum (220)
**When** The system suggests an adjustment
**Then** The suggested threshold never exceeds 220

**And** If I'm at 215, the suggestion is 220 (not 225)
**And** If I'm at 220, no further adjustment suggestions are made
**And** A warning appears: "You're at the maximum safety threshold. Consider lowering for better protection."

### AC8: Downward Adjustment Detection

**Given** My threshold was previously increased to 190
**And** I have NOT overridden any warnings in the last 60 days
**And** My threshold is above the default (180)
**When** The system detects this inactivity pattern
**Then** A notification appears suggesting a decrease:
- "Your threshold hasn't been challenged recently."
- "Would you like to lower it back to 180 for added protection?"
- Buttons: "Yes, Lower to 180" | "No, Keep 190"

**And** This ensures users who became more risk-averse get more protection

### AC9: Override History View

**Given** I want to review my override patterns
**When** I open Settings → Safety → "View Override History"
**Then** I see a table of overrides:
- Date/time of override
- AI detection score
- Threshold at time of override
- Status (successful / unsuccessful / pending)
- Proposal excerpt (first 50 chars)

**And** I can filter by status and date range
**And** I can manually mark pending overrides as successful/unsuccessful

## Tasks and Subtasks

### Task 1: Implement Override Tracking Database Schema
- [ ] 1.1: Create `safety_overrides` table
  - [ ] Schema: `id INTEGER PRIMARY KEY, proposal_id INTEGER, timestamp TEXT, ai_score REAL, threshold_at_override REAL, status TEXT, user_feedback TEXT`
  - [ ] Status values: "pending", "successful", "unsuccessful"
  - [ ] Foreign key to proposals table
  - [ ] Index on timestamp and status for query performance
- [ ] 1.2: Add migration for existing databases
  - [ ] Create table if not exists
  - [ ] Handle upgrade from non-tracking version
- [ ] 1.3: Create override tracking queries module
  - [ ] `record_override(proposal_id, ai_score, threshold) -> Result<i64>`
  - [ ] `update_override_status(override_id, status) -> Result<()>`
  - [ ] `get_successful_overrides_last_30_days() -> Result<Vec<Override>>`
  - [ ] `count_pending_overrides() -> Result<usize>`

### Task 2: Replace Story 3.6 Counter Logging with Per-Override Records
- [ ] 2.1: Create Tauri command `record_safety_override` (replaces Story 3.6's `log_safety_override`)
  - [ ] Input: `RecordOverrideRequest { proposal_id, ai_score, threshold }`
  - [ ] Output: `Result<i64>` (override ID)
  - [ ] Insert record into `safety_overrides` table with status "pending"
- [ ] 2.2: Update `handleOverrideConfirm` in CopyButton.tsx to call `record_safety_override` instead of `log_safety_override`
  - [ ] Pass proposal ID, AI score, current threshold from `analysisResult`
  - [ ] Remain fire-and-forget (don't block clipboard copy on DB write)
- [ ] 2.3: Deprecate Story 3.6's settings-based counter (`safety_override_count`, `safety_override_last`)
  - [ ] Remove or comment out `log_safety_override` Tauri command
  - [ ] Old settings keys can remain in DB (no cleanup migration needed)

### Task 3: Implement Success Tracking Mechanism
- [ ] 3.1: Create startup task for auto-confirming successful overrides
  - [ ] Run on app startup (no periodic timer needed — check is cheap and startup-only is sufficient)
  - [ ] Use `tauri::async_runtime::spawn` or call synchronously during init
  - [ ] Query all "pending" overrides older than 7 days
  - [ ] Update status to "successful" if proposal still exists and not deleted
  - [ ] Update status to "unsuccessful" if proposal deleted or CASCADE-removed
  - [ ] Handle gracefully if referenced proposal_id no longer exists (treat as unsuccessful)
- [ ] 3.2: Add optional user feedback mechanism
  - [ ] In proposal view, show badge for proposals with pending overrides
  - [ ] "This proposal was flagged. Mark as successful?" button
  - [ ] Clicking marks override as successful immediately
- [ ] 3.3: Track proposal deletion for override status
  - [ ] When proposal deleted, update related overrides to "unsuccessful"
  - [ ] Add trigger or check in delete proposal function

### Task 4: Build Learning Detection Algorithm
- [ ] 4.1: Create learning opportunity detection function
  - [ ] `detect_learning_opportunity() -> Result<Option<ThresholdSuggestion>>`
  - [ ] Query successful overrides in last 30 days
  - [ ] Count overrides within 10 points of current threshold
  - [ ] If count ≥ 3, return suggestion with new threshold (+10)
  - [ ] Ensure current threshold < 220 (maximum)
- [ ] 4.2: Implement threshold suggestion calculation
  - [ ] Current threshold + 10 points (default increment)
  - [ ] Cap at maximum 220
  - [ ] Calculate average AI score of recent overrides (informational)
- [ ] 4.3: Create Tauri command `check_threshold_learning`
  - [ ] Called on app startup and after each successful override confirmation
  - [ ] Returns `Option<ThresholdSuggestion>`
  - [ ] Frontend displays notification if suggestion returned

### Task 5: Build Adaptive Threshold Notification UI
- [ ] 5.1: Create `ThresholdAdjustmentNotification.tsx` component
  - [ ] Modal or prominent banner (persistent but non-blocking)
  - [ ] Display current and suggested thresholds
  - [ ] Show explanation and learning rationale
  - [ ] Three action buttons: "Yes, Adjust", "No, Keep Current", "Remind Me Later"
- [ ] 5.2: Implement notification state management
  - [ ] Track notification shown/dismissed state
  - [ ] Persist "remind me later" preference
  - [ ] Show notification after app startup or next proposal generation
- [ ] 5.3: Add CSS styling (`ThresholdAdjustmentNotification.css`)
  - [ ] Prominent but not intrusive design
  - [ ] Clear visual hierarchy (suggested threshold emphasized)
  - [ ] Responsive layout

### Task 6: Implement Threshold Adjustment Actions
- [ ] 6.1: Create Tauri command `apply_threshold_adjustment`
  - [ ] Input: `new_threshold: f32`
  - [ ] Update threshold in settings (call Story 3.5 function)
  - [ ] Reset override counter
  - [ ] Log adjustment event (Story 1.16)
  - [ ] Return success confirmation
- [ ] 6.2: Handle "Yes, Adjust" action
  - [ ] Call `apply_threshold_adjustment` with suggested threshold
  - [ ] Show success toast notification
  - [ ] Dismiss modal
  - [ ] Update UI to reflect new threshold
- [ ] 6.3: Handle "No, Keep Current" action
  - [ ] Reset override counter without changing threshold
  - [ ] Log rejection event
  - [ ] Dismiss modal
- [ ] 6.4: Handle "Remind Me Later" action
  - [ ] Dismiss modal but keep override counter
  - [ ] Set flag to re-show notification on next trigger

### Task 7: Implement Downward Adjustment Detection
- [ ] 7.1: Create inactivity detection function
  - [ ] `detect_threshold_decrease_opportunity() -> Result<Option<ThresholdSuggestion>>`
  - [ ] Check if current threshold > default (180)
  - [ ] Query overrides in last 60 days
  - [ ] If count = 0, suggest decrease back to default
  - [ ] Return suggestion with lower threshold
- [ ] 7.2: Integrate downward suggestion into notification flow
  - [ ] Run inactivity detection periodically (monthly)
  - [ ] Show similar notification with decrease suggestion
  - [ ] "Yes, Lower to 180" and "No, Keep 190" buttons

### Task 8: Build Override History View (STRETCH — consider splitting to separate story)
- [ ] 8.1: Create `OverrideHistory.tsx` component
  - [ ] Table view with columns: Date, Score, Threshold, Status, Proposal
  - [ ] Filter controls: Status dropdown, Date range picker
  - [ ] Pagination for large override history
  - [ ] **Note:** This is significant standalone UI scope. If timeline is tight, defer to a follow-up story and ship core learning without the history view.
- [ ] 8.2: Add override history to Settings screen
  - [ ] Safety settings section → "View Override History" link
  - [ ] Opens modal or dedicated page with OverrideHistory component
- [ ] 8.3: Implement manual status update
  - [ ] Action buttons on each pending override row
  - [ ] "Mark Successful" and "Mark Unsuccessful" buttons
  - [ ] Call `update_override_status` command
  - [ ] Refresh table after update

### Task 9: Testing
- [ ] 9.1: Unit tests for override tracking
  - [ ] Test record_override creates database entry
  - [ ] Test update_override_status modifies status
  - [ ] Test get_successful_overrides_last_30_days filters correctly
- [ ] 9.2: Unit tests for learning detection algorithm
  - [ ] Test detection with exactly 3 overrides (triggers suggestion)
  - [ ] Test detection with 2 overrides (no suggestion)
  - [ ] Test detection with overrides beyond 10-point threshold (no suggestion)
  - [ ] Test maximum threshold cap (220)
  - [ ] Test suggestion calculation (+10, capped at 220)
- [ ] 9.3: Integration tests for adaptive learning flow
  - [ ] Test full flow: override 3 times → auto-confirm → notification → adjust
  - [ ] Test rejection flow: override 3 times → reject adjustment → counter resets
  - [ ] Test "remind later" flow: notification persists across sessions
  - [ ] Test downward adjustment: no overrides for 60 days → decrease suggestion
- [ ] 9.4: UX tests for notification
  - [ ] Test notification appears after 3rd successful override
  - [ ] Test notification is persistent but non-blocking
  - [ ] Test threshold adjustment reflects in UI
  - [ ] Test override history table displays correctly

### Task 10: Logging Integration (Story 1.16)
- [ ] 10.1: Log override events via `tracing::info!` (timestamp, score, threshold)
- [ ] 10.2: Log threshold adjustments (old → new value)
- [ ] 10.3: Log learning opportunity detections (count, suggestion)
- [ ] 10.4: Log user responses to threshold suggestions (accept/reject/remind later)
- [ ] **Note:** Algorithm documentation and user guide content deferred to Epic 8 polish or docs story

## Technical Notes

### Architecture Requirements
- **AR-15**: Comprehensive error handling with user feedback
- **AR-16**: Secure logging (log events, not proposal content)

### Functional Requirements
- **FR-8**: Adaptive threshold learning from user overrides

### Non-Functional Requirements
- **NFR-15**: Professional UX (non-intrusive notifications)
- **NFR-18**: Privacy-respecting (override history stored locally, never transmitted)

### CRITICAL: Data Contract Migration from Story 3.6

**Story 3.6** implements override logging using the **settings key-value table** with:
- `safety_override_count` — simple integer counter
- `safety_override_last` — last override timestamp
- `log_safety_override` Tauri command — increments counter, stores timestamp

**Story 3.7 requires per-override granular records** to support the learning algorithm (individual scores, threshold-proximity filtering, success/failure tracking per override). The settings-based counter from 3.6 **cannot support this**.

**Migration approach:**
1. Story 3.7 creates the `safety_overrides` table (Task 1)
2. Story 3.7 creates `record_safety_override` command that writes to the new table (Task 2.1)
3. CopyButton's `handleOverrideConfirm` is updated to call the new command instead of `log_safety_override` (Task 2.2)
4. Story 3.6's `log_safety_override` command is deprecated/removed (Task 2.3)
5. Old settings keys (`safety_override_count`, `safety_override_last`) are left in place — no cleanup migration needed

**Forward-only data:** Learning starts fresh from the new `safety_overrides` table. Override counts accumulated under Story 3.6's settings-based approach are NOT migrated to the new table. This is acceptable because:
- The learning algorithm needs per-override scores, which the old counter doesn't have
- Users won't have accumulated many overrides before 3.7 ships (3.6 and 3.7 are in the same epic)

### Implementation Strategy

**Success Definition:**
- **Auto-confirm**: Override marked "successful" after 7 days if proposal not deleted
- **Explicit confirm**: User can manually mark as successful anytime
- **Unsuccessful**: Proposal deleted within 7 days = unsuccessful override

**Learning Algorithm:**
```
1. Query successful overrides in last 30 days
2. Filter overrides within 10 points of current threshold
3. If count >= 3:
   a. Suggest new_threshold = current + 10
   b. Cap at maximum 220
   c. Show notification
4. On user acceptance:
   a. Update threshold in settings
   b. Reset override counter
5. On user rejection:
   a. Keep threshold unchanged
   b. Reset override counter
6. On "remind later":
   a. Keep threshold unchanged
   b. Keep override counter (re-trigger on next override)
```

**Downward Adjustment Logic:**
```
1. Check if current threshold > default (180)
2. Query overrides in last 60 days
3. If count = 0 AND threshold > default:
   a. Suggest decrease back to default
   b. Show notification
```

**Override Filtering (Learning Detection):**
- Only count overrides within 10 points of current threshold
- Example: Threshold = 180, only count overrides with scores 170-190
- Rationale: User overriding a score of 250 doesn't mean threshold should increase; that's an outlier/exception

**Maximum Threshold Rationale:**
- Cap at 220 to prevent completely disabling safety
- Perplexity scores typically range 150-250
- 220 threshold still provides protection against extreme AI-like text (250+)
- If user needs higher threshold, they should reconsider using AI detection at all

**Database Schema:**
```sql
CREATE TABLE safety_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    ai_score REAL NOT NULL,
    threshold_at_override REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | successful | unsuccessful
    user_feedback TEXT,
    FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
);

CREATE INDEX idx_overrides_status_timestamp ON safety_overrides(status, timestamp);
```

### Dependencies
- **Story 3.1**: Pre-flight analysis generates AI detection scores
- **Story 3.2**: Safety warning screen is where overrides occur
- **Story 3.5**: Threshold configuration stores and manages threshold (provides `get_safety_threshold`)
- **Story 3.6**: Override safety warning triggers override recording — **NOTE: This story replaces 3.6's simple counter logging with per-override record storage. The `log_safety_override` command from 3.6 is superseded by `record_safety_override` from this story.**
- Relates to **Story 3.3**: Humanization can reduce need for overrides
- Relates to **Story 3.4**: Re-humanization alternative to override

### Cross-References
- Override tracking integrates with proposal database (Story 1.12)
- Threshold adjustment updates settings (Story 3.5)
- Logging integration (Story 1.16)
- Override history accessible from Settings screen

### NFR Targets
- **Learning detection**: <100ms (query optimized with indexes)
- **Notification rendering**: <500ms
- **Threshold adjustment**: <200ms (settings update)

### UX Considerations

**Non-Intrusive Design:**
- Notification is persistent but not blocking (can continue working)
- Positioned prominently but not modal (banner at top)
- Can dismiss with "Remind Me Later" without losing progress

**Trust Building:**
- Show reasoning: "You've successfully used 3 proposals..."
- Transparent about what changed: "180 → 190"
- Explain benefit: "Reduce false warnings"
- Allow rejection without penalty

**Safety Guardrails:**
- Maximum threshold cap (220)
- Only learn from recent patterns (30 days)
- Only count overrides close to threshold (within 10 points)
- Downward adjustment for inactivity (60 days without overrides)

## Acceptance Criteria Validation Checklist

- [ ] AC1: Overrides recorded in `safety_overrides` table
- [ ] AC1: Override includes timestamp, score, threshold, status
- [ ] AC2: Pending overrides auto-confirm after 7 days
- [ ] AC2: User can manually mark overrides as successful
- [ ] AC2: Deleted proposals mark overrides as unsuccessful
- [ ] AC3: Learning opportunity detected after 3 successful overrides in 30 days
- [ ] AC3: Only overrides within 10 points of threshold counted
- [ ] AC4: Notification displays with clear messaging and action buttons
- [ ] AC4: Suggested threshold is current + 10
- [ ] AC4: Notification is persistent but non-blocking
- [ ] AC5: "Yes, Adjust" updates threshold in settings
- [ ] AC5: Override counter resets after adjustment
- [ ] AC5: Success toast confirms adjustment
- [ ] AC6: "No, Keep Current" keeps threshold unchanged and resets counter
- [ ] AC6: "Remind Me Later" dismisses but preserves counter
- [ ] AC7: Suggested threshold never exceeds 220
- [ ] AC7: At threshold 220, no further suggestions made
- [ ] AC7: Warning shown when at maximum threshold
- [ ] AC8: Downward adjustment suggested after 60 days of no overrides
- [ ] AC8: Suggestion only shown if threshold > default (180)
- [ ] AC9: Override history view displays all overrides
- [ ] AC9: Override history filterable by status and date
- [ ] AC9: Manual status update available for pending overrides

## Definition of Done
- [ ] All tasks completed and checked off (Task 8 override history is stretch — can ship without)
- [ ] All acceptance criteria validated (AC9 is stretch if Task 8 deferred)
- [ ] Override tracking database schema created (`safety_overrides` table)
- [ ] Story 3.6's `log_safety_override` replaced with `record_safety_override`
- [ ] Learning detection algorithm implemented and tested
- [ ] Notification UI component complete
- [ ] Threshold adjustment actions working
- [ ] Downward adjustment detection implemented
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests verify full learning flow
- [ ] UX tests confirm notification behavior
- [ ] Code review completed (Story 1.11 criteria)
- [ ] Logging integration complete (all override/adjustment events logged via tracing)
