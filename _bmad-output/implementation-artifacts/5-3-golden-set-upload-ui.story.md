---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 5
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.3: Golden Set Upload UI

## Story

As a freelancer,
I want to upload 3-5 of my best past proposals,
So that the app can learn my writing style quickly.

## Acceptance Criteria

**AC-1:** Given I'm in Settings → Voice Calibration, When I click "Upload Golden Set", Then I see an upload interface with:
- File picker button (supports .txt, .pdf)
- Text paste area as alternative
- Instructions: "Upload 3-5 of your best proposals that got responses"

**AC-2:** And I can upload files via Tauri file dialog:
- Accepts .txt and .pdf files
- Extracts plain text from uploaded files
- Shows filename after successful upload

**AC-3:** And I can paste proposal text directly:
- Large textarea for pasting
- "Add Proposal" button to submit pasted text
- Clears textarea after successful add

**AC-4:** And each proposal is validated:
- Minimum 200 words required
- Shows word count during input: "Word count: 245"
- Error message if below minimum: "Proposal must be at least 200 words (currently: 150)"

**AC-5:** And I see upload progress:
- Counter: "2/5 proposals uploaded"
- List of uploaded proposals with preview (first 50 chars + "...")
- Delete button (×) to remove individual proposals
- Minimum 3 required before "Continue" is enabled

**AC-6:** And proposals are stored in `golden_set_proposals` table for later analysis (Story 5-4)

## Tasks/Subtasks

- [ ] Task 1: Create database migration for golden_set_proposals table (AC-6)
  - [ ] Subtask 1.1: Create V{next}__add_golden_set_proposals_table.sql
  - [ ] Subtask 1.2: Define table schema (id, content, word_count, source_filename, created_at)
  - [ ] Subtask 1.3: Use CREATE TABLE IF NOT EXISTS for idempotency

- [ ] Task 2: Add Rust backend for golden set management (AC-2, AC-6)
  - [ ] Subtask 2.1: Create db/queries/golden_set.rs module
  - [ ] Subtask 2.2: Implement add_golden_proposal(content, word_count, filename?) function
  - [ ] Subtask 2.3: Implement get_golden_proposals() function
  - [ ] Subtask 2.4: Implement delete_golden_proposal(id) function
  - [ ] Subtask 2.5: Implement get_golden_proposal_count() function
  - [ ] Subtask 2.6: Create Tauri commands in commands/voice.rs

- [ ] Task 3: Implement file upload handling (AC-2)
  - [ ] Subtask 3.1: Use Tauri dialog API for file picker (filter: .txt, .pdf)
  - [ ] Subtask 3.2: Extract text from .txt files (simple read)
  - [ ] Subtask 3.3: Extract text from .pdf files (pdf-extract crate or similar)
  - [ ] Subtask 3.4: Return extracted text to frontend

- [ ] Task 4: Build Golden Set Upload UI component (AC-1, AC-3, AC-4, AC-5)
  - [ ] Subtask 4.1: Create GoldenSetUpload.tsx in features/voice-learning/
  - [ ] Subtask 4.2: Implement file upload button with Tauri invoke
  - [ ] Subtask 4.3: Implement text paste area with textarea
  - [ ] Subtask 4.4: Add real-time word count display
  - [ ] Subtask 4.5: Add validation (200+ words) with error messages
  - [ ] Subtask 4.6: Implement progress counter ("2/5 proposals uploaded")
  - [ ] Subtask 4.7: Show uploaded proposal list with previews
  - [ ] Subtask 4.8: Add delete button for each proposal
  - [ ] Subtask 4.9: Enable "Continue" button only when 3+ proposals uploaded

- [ ] Task 5: Add tests (AC-1 through AC-6)
  - [ ] Subtask 5.1: Test golden_set_proposals table creation
  - [ ] Subtask 5.2: Test add/get/delete CRUD operations
  - [ ] Subtask 5.3: Test word count validation (reject <200 words)
  - [ ] Subtask 5.4: Test file text extraction (.txt)
  - [ ] Subtask 5.5: Test UI component renders correctly
  - [ ] Subtask 5.6: Test progress counter updates

## Dev Notes

### Architecture Requirements

**FR-16: Golden Set Calibration**
- User can upload 3-5 past successful proposals as "Golden Samples"
- System extracts style patterns and applies within 30 seconds
- Mitigates Cold Start problem (one-time setup calibration)

**AR-12: Privacy Layer**
- Send derived style parameters, not raw writing samples
- Golden Set text stays LOCAL — only analyzed in Story 5-4 to extract parameters
- Raw proposals NEVER sent to Claude API

**UX-8: Progressive Trust Building**
- Make Golden Set optional (users can skip and use Quick Calibration instead)
- Clear privacy messaging: "Your proposals stay on your device"

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS golden_set_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,                           -- Full proposal text
    word_count INTEGER NOT NULL,                     -- Pre-calculated for display
    source_filename TEXT,                            -- Optional: original filename if uploaded
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_golden_set_created_at
ON golden_set_proposals(created_at DESC);
```

**Column Specifications:**
- `content`: Full text of the proposal (stored locally, never sent to API)
- `word_count`: Pre-calculated for UI display and validation
- `source_filename`: Track origin for user reference (e.g., "proposal-acme-corp.txt")

### File Structure

```
upwork-researcher/
  src-tauri/
    migrations/
      V{next}__add_golden_set_proposals_table.sql   # NEW
    src/
      commands/
        voice.rs                                      # Add golden set commands
      db/
        queries/
          mod.rs                                      # Add golden_set module
          golden_set.rs                               # NEW: CRUD functions
  src/
    features/
      voice-learning/
        GoldenSetUpload.tsx                           # NEW: Upload UI component
        GoldenSetUpload.test.tsx                      # NEW: Component tests
        index.ts                                      # Export component
```

### Tauri Commands

```rust
// commands/voice.rs

#[tauri::command]
pub async fn add_golden_proposal(
    content: String,
    source_filename: Option<String>,
    state: State<'_, AppState>
) -> Result<i64, AppError> {
    // Validate word count
    let word_count = content.split_whitespace().count();
    if word_count < 200 {
        return Err(AppError::Validation("Proposal must be at least 200 words".into()));
    }
    // Insert and return ID
}

#[tauri::command]
pub async fn get_golden_proposals(state: State<'_, AppState>) -> Result<Vec<GoldenProposal>, AppError>

#[tauri::command]
pub async fn delete_golden_proposal(id: i64, state: State<'_, AppState>) -> Result<(), AppError>

#[tauri::command]
pub async fn get_golden_proposal_count(state: State<'_, AppState>) -> Result<i64, AppError>

#[tauri::command]
pub async fn pick_and_read_file() -> Result<FileContent, AppError> {
    // Use tauri::api::dialog::FileDialogBuilder
    // Filter for .txt, .pdf
    // Read and extract text
}
```

### PDF Text Extraction

For PDF support, use one of:
- `pdf-extract` crate (pure Rust, no external dependencies)
- `lopdf` + `pdf_text` for more control

**Fallback:** If PDF extraction fails, show error: "Could not read PDF. Please paste the text instead."

### UI Component Structure

```tsx
// features/voice-learning/GoldenSetUpload.tsx

interface GoldenProposal {
  id: number;
  content: string;
  word_count: number;
  source_filename: string | null;
  created_at: string;
}

export function GoldenSetUpload({ onComplete }: { onComplete: () => void }) {
  const [proposals, setProposals] = useState<GoldenProposal[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wordCount = pasteText.split(/\s+/).filter(Boolean).length;
  const canContinue = proposals.length >= 3;

  // ... handlers for upload, paste, delete

  return (
    <div className="golden-set-upload">
      <h2>Upload Your Best Proposals</h2>
      <p>Upload 3-5 of your best proposals that got responses</p>

      {/* Upload section */}
      <div className="upload-options">
        <button onClick={handleFileUpload}>
          📁 Upload File (.txt, .pdf)
        </button>
        <span>or paste below</span>
      </div>

      {/* Paste area */}
      <textarea
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        placeholder="Paste your proposal text here..."
      />
      <div className="word-count">
        Word count: {wordCount}
        {wordCount > 0 && wordCount < 200 && (
          <span className="error"> (minimum 200 required)</span>
        )}
      </div>
      <button
        onClick={handleAddPasted}
        disabled={wordCount < 200}
      >
        Add Proposal
      </button>

      {/* Progress */}
      <div className="progress">
        {proposals.length}/5 proposals uploaded
        {proposals.length < 3 && " (minimum 3 required)"}
      </div>

      {/* Uploaded list */}
      <ul className="proposal-list">
        {proposals.map(p => (
          <li key={p.id}>
            <span>{p.content.slice(0, 50)}...</span>
            <span className="word-count">({p.word_count} words)</span>
            <button onClick={() => handleDelete(p.id)}>×</button>
          </li>
        ))}
      </ul>

      {/* Continue button */}
      <button
        onClick={onComplete}
        disabled={!canContinue}
        className="primary"
      >
        Continue to Calibration
      </button>
    </div>
  );
}
```

### Validation Rules

| Rule | Threshold | Error Message |
|------|-----------|---------------|
| Minimum words | 200 | "Proposal must be at least 200 words (currently: X)" |
| Minimum proposals | 3 | "Upload at least 3 proposals to continue" |
| Maximum proposals | 5 | "Maximum 5 proposals allowed" (disable add after 5) |
| File types | .txt, .pdf | "Unsupported file type. Please use .txt or .pdf" |

### Testing Requirements

**Backend Tests (Rust):**

1. **Migration Test:**
   - Verify golden_set_proposals table exists
   - Verify columns: id, content, word_count, source_filename, created_at

2. **CRUD Tests:**
   - Test add_golden_proposal inserts correctly
   - Test get_golden_proposals returns all proposals
   - Test delete_golden_proposal removes by ID
   - Test get_golden_proposal_count returns correct count

3. **Validation Tests:**
   - Test rejection of proposals < 200 words
   - Test acceptance of proposals ≥ 200 words

4. **File Extraction Tests:**
   - Test .txt file reading
   - Test .pdf text extraction (if implemented)

**Frontend Tests (React):**

1. **Component Tests:**
   - Renders upload button and paste area
   - Shows word count as user types
   - Shows error when < 200 words
   - Shows progress counter
   - Shows uploaded proposal list
   - Delete button removes proposal
   - Continue button disabled until 3+ proposals

### Scope Boundaries

**In Scope for Story 5.3:**
- golden_set_proposals database table
- File upload (txt, basic pdf)
- Text paste input
- Word count validation
- Progress counter UI
- Proposal list with delete

**Out of Scope (Future Stories):**
- Voice analysis of proposals (Story 5-4)
- Voice profile extraction (Story 5-4)
- Voice profile display (Story 5-5)

### Dependencies

**Depends On:**
- Story 1.11: Database Migration Framework Setup (migration patterns)
- Settings/Voice Calibration route exists

**Depended On By:**
- Story 5-4: Local-Only Voice Analysis (requires 3+ golden proposals)
- Story 5-5: Voice Profile Display (shows results of analysis)

### Privacy Considerations

**Critical:** The golden_set_proposals table stores raw proposal text. This data:
- MUST stay local (never transmitted)
- Is only analyzed locally in Story 5-4
- Only derived parameters (tone, structure, etc.) are ever used in API calls
- User can delete all proposals at any time

Display in UI: "🔒 Your proposals stay on your device. Only style patterns are used for generation."

### References

- [Source: epics-stories.md#Story 5.3: Golden Set Upload UI]
- [Source: epics.md#Epic 5 — Golden Set Value Emphasis]
- [Source: architecture.md#AR-12: Privacy layer]
- [Source: prd.md#FR-16: Golden Set calibration]
- [Story 5-4: Local-Only Voice Analysis — consumes golden set proposals]
