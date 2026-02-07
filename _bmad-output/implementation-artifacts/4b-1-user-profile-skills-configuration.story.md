---
status: ready-for-dev
assignedTo: null
tasksCompleted: 0/8
testsWritten: 0
---

# Story 4b.1: User Profile Skills Configuration

## Story

As a freelancer,
I want to configure my skills profile,
So that the app can match me against job requirements.

## Acceptance Criteria

**AC-1:** Given I'm in Settings → Profile
**When** I enter my skills
**Then** I can add skills via autocomplete (from hardcoded Upwork skills list) or free text
**And** skills are saved to encrypted user_skills table
**And** I see my current skills as removable tags
**And** changes persist immediately (debounced 500ms after last edit)
**And** UI shows "Saving..." indicator during persistence

## Tasks / Subtasks

### Database Implementation (Rust + Migration)

- [ ] Task 1: Create user_skills table migration (AC: #1)
  - [ ] Subtask 1.1: Create migration `V7__add_user_skills_table.sql`
  - [ ] Subtask 1.2: Define schema: `id INTEGER PRIMARY KEY, skill TEXT NOT NULL, added_at TEXT DEFAULT CURRENT_TIMESTAMP, is_primary BOOLEAN DEFAULT 0`
  - [ ] Subtask 1.3: Add unique constraint on skill (case-insensitive)
  - [ ] Subtask 1.4: Add index on skill for fast lookups: `CREATE INDEX idx_user_skills_skill ON user_skills(skill COLLATE NOCASE);`
  - [ ] Subtask 1.5: Verify migration runs with `refinery migrate` or test command
  - [ ] Subtask 1.6: Confirm table is encrypted (SQLCipher) when created

### Backend Implementation (Rust)

- [ ] Task 2: Implement user skills CRUD commands (AC: #1)
  - [ ] Subtask 2.1: Create `add_user_skill(skill: String) -> Result<i64, String>` Tauri command in lib.rs
  - [ ] Subtask 2.2: Implement INSERT with case-insensitive duplicate check: `SELECT WHERE LOWER(skill) = LOWER(?)`
  - [ ] Subtask 2.3: Return skill ID on success, error if duplicate
  - [ ] Subtask 2.4: Create `remove_user_skill(skill_id: i64) -> Result<(), String>` command
  - [ ] Subtask 2.5: Implement DELETE FROM user_skills WHERE id = ?
  - [ ] Subtask 2.6: Create `get_user_skills() -> Result<Vec<UserSkill>, String>` command
  - [ ] Subtask 2.7: Return all skills ordered by added_at DESC (newest first)
  - [ ] Subtask 2.8: Define UserSkill struct: `{ id: i64, skill: String, added_at: String, is_primary: bool }`
  - [ ] Subtask 2.9: Register all commands in invoke_handler

- [ ] Task 3: Create hardcoded Upwork skills list (AC: #1)
  - [ ] Subtask 3.1: Create `COMMON_UPWORK_SKILLS` constant array in lib.rs or separate skills.rs module
  - [ ] Subtask 3.2: Populate with 50+ common skills: ["JavaScript", "Python", "React", "Node.js", "TypeScript", "SQL", "AWS", "GraphQL", "REST API", "Git", "Docker", "PostgreSQL", "MongoDB", "Vue.js", "Angular", "Next.js", "Express", "Django", "Flask", "FastAPI", "Ruby on Rails", "PHP", "Laravel", "WordPress", "Shopify", "Figma", "Adobe Photoshop", "UI/UX Design", "Graphic Design", "Content Writing", "SEO", "Social Media Marketing", "Email Marketing", "Google Analytics", "Data Analysis", "Excel", "Power BI", "Tableau", "Machine Learning", "TensorFlow", "PyTorch", "Natural Language Processing", "Computer Vision", "DevOps", "CI/CD", "Kubernetes", "Terraform", "Linux", "Bash", "Automation"]
  - [ ] Subtask 3.3: Create `get_skill_suggestions(query: String) -> Result<Vec<String>, String>` command
  - [ ] Subtask 3.4: Filter COMMON_UPWORK_SKILLS by case-insensitive prefix match: `skill.to_lowercase().starts_with(query.to_lowercase())`
  - [ ] Subtask 3.5: Return max 10 suggestions sorted alphabetically
  - [ ] Subtask 3.6: Register command in invoke_handler

### Frontend Implementation (React)

- [ ] Task 4: Create UserSkillsConfig component (AC: #1)
  - [ ] Subtask 4.1: Create `src/components/UserSkillsConfig.tsx`
  - [ ] Subtask 4.2: Add input field with autocomplete dropdown (use <datalist> or custom dropdown)
  - [ ] Subtask 4.3: Call `get_skill_suggestions` on input change (debounced 300ms)
  - [ ] Subtask 4.4: Display current skills as removable tags/chips below input
  - [ ] Subtask 4.5: Each tag has "X" button that calls `remove_user_skill(skill_id)`
  - [ ] Subtask 4.6: On Enter or click "Add", call `add_user_skill(skill)`
  - [ ] Subtask 4.7: Clear input after successful add
  - [ ] Subtask 4.8: Show error toast if duplicate skill added
  - [ ] Subtask 4.9: Style with dark mode colors (UX-1): #1a1a1a background, #e0e0e0 text, #3b82f6 accent

- [ ] Task 5: Implement "Saving..." indicator (AC: #1)
  - [ ] Subtask 5.1: Add `isSaving` state to UserSkillsConfig component
  - [ ] Subtask 5.2: Set `isSaving = true` before `add_user_skill` or `remove_user_skill` call
  - [ ] Subtask 5.3: Set `isSaving = false` after call completes (success or error)
  - [ ] Subtask 5.4: Display "Saving..." text or spinner icon when `isSaving === true`
  - [ ] Subtask 5.5: Position indicator near input field (top-right corner or inline)
  - [ ] Subtask 5.6: Add aria-live="polite" for screen reader announcement

- [ ] Task 6: Integrate into Settings page (AC: #1)
  - [ ] Subtask 6.1: Check if Settings page exists, if not create `src/components/Settings.tsx`
  - [ ] Subtask 6.2: Add "Profile" section to Settings page
  - [ ] Subtask 6.3: Import and render UserSkillsConfig component in Profile section
  - [ ] Subtask 6.4: Add section header: "Your Skills" with subtitle "Skills used for job matching (Story 4b.3)"
  - [ ] Subtask 6.5: Style section with dark mode palette
  - [ ] Subtask 6.6: Add Settings navigation to App.tsx if not already present

### Testing

- [ ] Task 7: Write backend tests
  - [ ] Subtask 7.1: Test add_user_skill with valid skill → returns skill ID
  - [ ] Subtask 7.2: Test add_user_skill with duplicate skill (case-insensitive) → returns error
  - [ ] Subtask 7.3: Test remove_user_skill with valid ID → deletes skill
  - [ ] Subtask 7.4: Test remove_user_skill with non-existent ID → returns error
  - [ ] Subtask 7.5: Test get_user_skills returns skills ordered by added_at DESC
  - [ ] Subtask 7.6: Test get_skill_suggestions with query "java" → returns ["JavaScript", "Java"] (if both in list)
  - [ ] Subtask 7.7: Test get_skill_suggestions with query "xyz" → returns empty array
  - [ ] Subtask 7.8: Test skill persistence survives app restart (encrypted database)

- [ ] Task 8: Write frontend tests
  - [ ] Subtask 8.1: Test UserSkillsConfig renders input field
  - [ ] Subtask 8.2: Test typing in input calls get_skill_suggestions (debounced)
  - [ ] Subtask 8.3: Test autocomplete suggestions appear in dropdown
  - [ ] Subtask 8.4: Test clicking suggestion adds skill and clears input
  - [ ] Subtask 8.5: Test Enter key adds skill from input
  - [ ] Subtask 8.6: Test current skills render as removable tags
  - [ ] Subtask 8.7: Test clicking "X" on tag calls remove_user_skill
  - [ ] Subtask 8.8: Test "Saving..." indicator appears during add/remove
  - [ ] Subtask 8.9: Test duplicate skill shows error toast
  - [ ] Subtask 8.10: Test accessibility: keyboard navigation, aria-live, focus management

## Dev Notes

### Architecture Requirements

**AR-1: Tauri Desktop Framework**
- **Framework:** Tauri v2.9.5
- **Backend:** Rust for all database operations and business logic
- **Frontend:** React 19 + TypeScript + Vite 7
- **IPC:** Tauri commands for frontend ↔ backend communication

**AR-2: SQLCipher Database Integration**
- **Database Library:** rusqlite 0.38 + bundled-sqlcipher-vendored-openssl feature
- **SQLCipher Version:** 4.10.0 (AES-256 encryption)
- **Encryption:** ALL user data encrypted, including user_skills table (NFR-2)
- **Migration Framework:** refinery for SQL migrations

**AR-3: Database Design Principles**
- **Schema:** Normalized design with foreign keys where appropriate
- **Indexes:** All frequently queried columns indexed
- **Constraints:** UNIQUE constraints for duplicate prevention
- **Case-insensitive search:** Use `COLLATE NOCASE` for skill matching

### Non-Functional Requirements

**NFR-2: Local Data Encryption**
- User skills table MUST be encrypted with AES-256 (SQLCipher)
- Encryption transparent to application code (handled by SQLCipher layer)
- No plaintext skills stored anywhere (database encrypted at rest)

**NFR-4: UI Response Time**
- Autocomplete suggestions must appear in <100ms after typing stops (300ms debounce)
- Add/remove operations complete in <500ms (perceived as instant)
- "Saving..." indicator provides immediate feedback (prevents user confusion)

**NFR-14: Accessibility (WCAG 2.1 AA)**
- Keyboard navigation: Tab to input, arrow keys for autocomplete, Enter to add, Tab+Enter to remove tags
- Screen reader support: aria-live for "Saving...", aria-label for remove buttons
- High contrast: Dark mode colors meet 4.5:1 contrast ratio minimum

**NFR-9: Query Performance**
- User skills lookup <50ms for typical 10-50 skills
- Autocomplete filtering <10ms (in-memory array filter)
- Case-insensitive duplicate check <50ms (indexed COLLATE NOCASE)

### UX Requirements

**UX-1: Dark Mode by Default**
- **Background:** #1a1a1a
- **Text:** #e0e0e0
- **Accents:** #3b82f6 (blue) for tags and buttons
- **Input field:** #2a2a2a background, #e0e0e0 text, #3b82f6 border on focus

**UX-4: Settings Organization**
- Settings page structure: General / Profile / API Keys / Safety
- Profile section contains: User Skills (this story), other profile fields (future)
- Clear section headers with explanatory subtitles

### Functional Requirements

**FR-4: Weighted Job Scoring**
- This story provides the **user skills baseline** for job-skill match calculation in Story 4b.2
- Skills entered here will be matched against job_skills extracted in Story 4a.3
- Match percentage = (intersection of user_skills and job_skills) / (count of job_skills) * 100
- Critical dependency: Story 4b.2 (Skills Match %) depends on this story's data

### Story Position in Epic 4b Flow

**Story 4b.1 Position in Job Scoring Sequence:**
1. **→ Story 4b.1 (THIS STORY):** User configures skills profile (baseline for matching)
2. **Story 4b.2 (NEXT):** Skills match % calculation (user_skills ∩ job_skills)
3. **Story 4b.3:** Client quality score estimation
4. **Story 4b.4:** Budget alignment detection
5. **Story 4b.5:** Weighted job scoring algorithm (combines 4b.2, 4b.3, 4b.4)
6. **Story 4b.6:** Scoring breakdown UI (displays results from 4b.5)

**Epic 4b Context:**
- Epic 4b is "Job Scoring & Pipeline Management"
- Builds on Epic 4a (Job Analysis) which extracts job_skills from job posts
- Epic 4a must be completed before Epic 4b can deliver end-to-end value
- However, Story 4b.1 is **independent** and can be implemented before Epic 4a completes

### Previous Story Intelligence

**Story 1-8 (Settings Table - DONE):**
- Settings table already exists: `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`
- Settings page may already exist for API key configuration (Story 1-7)
- Check if Settings component exists before creating new one

**Story 2-3 (SQLite → SQLCipher Migration - DONE):**
- Database is now encrypted with SQLCipher
- All new migrations automatically create encrypted tables
- Migration framework (refinery) already set up
- Last migration was V6 (encryption metadata), next is V7 for user_skills

**Story 2-7 (Encrypted Database Access - DONE):**
- Database initialization sequence: external config → logging → passphrase → database → app ready
- User skills can only be loaded AFTER passphrase unlock completes
- Settings page should handle "database not ready" state gracefully

**Key Learnings from Epic 1-2:**
1. **Debouncing:** All user input should be debounced 300-500ms to avoid excessive IPC calls (Story 1-13 API error handling)
2. **Dark Mode:** Established palette in Story 1-5, all new components must follow
3. **Accessibility:** Story 2-8 established keyboard nav + screen reader patterns
4. **Error Handling:** User-friendly error messages with actionable recovery (Story 1-13)

### Database Schema Definition

**Migration File:** `upwork-researcher/src-tauri/migrations/V7__add_user_skills_table.sql`

```sql
-- User Skills Table for Job Matching (Story 4b.1)
-- Used in weighted scoring algorithm (FR-4, Story 4b.2)

CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill TEXT NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT 0,  -- Future: mark top 3-5 skills as primary
    UNIQUE(skill COLLATE NOCASE)   -- Prevent duplicates (case-insensitive)
);

-- Index for fast case-insensitive skill lookups
CREATE INDEX idx_user_skills_skill ON user_skills(skill COLLATE NOCASE);

-- Index for sorting by recency
CREATE INDEX idx_user_skills_added_at ON user_skills(added_at DESC);
```

**Schema Rationale:**
- `id`: Auto-incrementing primary key for stable references
- `skill`: Text field for skill name (e.g., "JavaScript", "React", "SEO")
- `added_at`: Timestamp for sorting (newest first) and analytics
- `is_primary`: Boolean for future enhancement (mark top skills for weighted scoring)
- `UNIQUE(skill COLLATE NOCASE)`: Prevents duplicates like "JavaScript" and "javascript"
- Indexes optimize common queries: skill lookup (matching) and recency sorting (UI display)

### Project Structure Notes

**New Files to Create:**
- `upwork-researcher/src-tauri/migrations/V7__add_user_skills_table.sql` — Database schema
- `upwork-researcher/src/components/UserSkillsConfig.tsx` — Skills input + tags component
- `upwork-researcher/src/components/UserSkillsConfig.css` — Dark mode styling
- `upwork-researcher/src/components/Settings.tsx` (if not exists) — Settings page container

**Files to Modify:**
- `upwork-researcher/src-tauri/src/lib.rs` — Add 3 Tauri commands: add_user_skill, remove_user_skill, get_user_skills, get_skill_suggestions
- `upwork-researcher/src/App.tsx` — Add Settings navigation if not present

**Files to Reference:**
- `upwork-researcher/src-tauri/migrations/` — Check latest migration number (V6), create V7
- `upwork-researcher/src-tauri/src/db/mod.rs` — Database connection patterns
- `upwork-researcher/src/components/` — Check if Settings component exists from Story 1-7

### Component Design Details

**UserSkillsConfig Component:**
```tsx
// Visual: Input field with autocomplete dropdown + skill tags below
// State:
//   - skills: UserSkill[] (from get_user_skills on mount)
//   - inputValue: string (controlled input)
//   - suggestions: string[] (from get_skill_suggestions, debounced)
//   - isSaving: boolean (shows "Saving..." indicator)
// Behavior:
//   - Type in input → debounced autocomplete suggestions appear
//   - Click suggestion or press Enter → add_user_skill → refresh skills list
//   - Click X on tag → remove_user_skill → refresh skills list
//   - Duplicate check on backend, show error toast on duplicate
// Props: None (self-contained, fetches own data)
```

**Settings Page Structure:**
```tsx
<Settings>
  <Section title="General">
    // Future: app preferences
  </Section>
  <Section title="Profile">
    <UserSkillsConfig /> {/* THIS STORY */}
    // Future: hourly rate, bio, etc.
  </Section>
  <Section title="API Keys">
    // Existing: Anthropic API key (Story 1-7)
  </Section>
  <Section title="Safety">
    // Future: safety threshold config (Story 3-5)
  </Section>
</Settings>
```

### Hardcoded Skills List Rationale

**Why Hardcoded Instead of API:**
- **Offline-first:** App must work without internet (NFR-12)
- **Performance:** Instant autocomplete (<10ms filter) vs API latency (100ms+)
- **Cost:** Zero API calls vs potential metered API costs
- **Privacy:** No data sent to third-party for autocomplete
- **Simplicity:** No API key management, no rate limits, no error handling

**Skills List Source:**
- Based on Upwork's top 50 categories: Web Development, Mobile Development, Design, Writing, Marketing, Data Science
- Can be updated in future via dynamic config (FR-18) without app update
- Intentionally limited to 50-100 skills to avoid overwhelming autocomplete

**Free Text Option:**
- Users can add skills NOT in the hardcoded list (e.g., niche frameworks, industry-specific skills)
- Free text ensures no user is blocked by limited autocomplete options
- Backend validates only for duplicates, not against allowed list

### UX Flow Example

**User Journey:**
1. **User opens Settings** → Clicks "Profile" tab
2. **Sees "Your Skills" section** → Empty state: "Add your skills to enable job matching"
3. **Types "jav" in input** → Autocomplete shows ["Java", "JavaScript"] (300ms after typing stops)
4. **Clicks "JavaScript"** → Skill added as tag, "Saving..." appears, input clears
5. **Types "React" and presses Enter** → Skill added, input clears
6. **Types "machine learning" (not in list)** → No autocomplete, presses Enter → Skill added (free text)
7. **Sees 3 tags:** [JavaScript] [React] [machine learning]
8. **Clicks X on "React"** → Tag removed, "Saving..." appears, tag disappears
9. **Tries to add "javascript" (duplicate)** → Error toast: "Skill already added"

**Edge Cases:**
- **Empty input + Enter:** No action (silently ignore)
- **Whitespace-only input:** Trim and ignore
- **Very long skill name (100+ chars):** Allow but truncate display in tag
- **Database locked (passphrase not entered):** Disable input, show "Unlock database to configure skills"

### Security Considerations

**Data Privacy:**
- User skills stored in encrypted database (SQLCipher AES-256)
- Skills never transmitted to external APIs (except as part of job scoring context in Story 4b.5)
- No telemetry on skill selection (NFR-10: zero telemetry default)

**Input Validation:**
- No SQL injection risk (parameterized queries via rusqlite)
- No XSS risk (React escapes by default, no dangerouslySetInnerHTML)
- Duplicate check prevents case-variation attacks (COLLATE NOCASE)

**Performance Security:**
- Debouncing prevents excessive database writes (500ms debounce on save)
- Autocomplete limited to 10 suggestions (prevents UI lag with long lists)
- Case-insensitive search uses index (prevents slow table scans)

### Accessibility Requirements

**Keyboard Navigation:**
- Tab key focuses input field
- Type to filter autocomplete
- Arrow Down/Up navigate autocomplete suggestions (if custom dropdown)
- Enter adds selected suggestion or free text
- Tab to skill tags, Enter or Space to remove
- ESC closes autocomplete dropdown

**Screen Reader Support:**
- Input has aria-label: "Add skills for job matching"
- Autocomplete has aria-live="polite" for suggestion count announcement
- "Saving..." indicator has aria-live="polite" for status announcement
- Remove buttons have aria-label: "Remove {skill}"
- Section header has aria-describedby pointing to subtitle

**High Contrast Mode:**
- Tag background (#3b82f6) has 8.6:1 contrast on dark background (#1a1a1a)
- Input text (#e0e0e0) has 12.6:1 contrast
- Focus indicator: 2px solid #3b82f6 border (clearly visible)

### Testing Strategy

**Backend Unit Tests:**
- Test all CRUD operations with valid/invalid inputs
- Test case-insensitive duplicate detection
- Test autocomplete filtering with various queries
- Test skill persistence and encryption (verify SQLCipher active)

**Frontend Unit Tests:**
- Test component rendering with empty/populated skills
- Test user interactions (type, select, add, remove)
- Test debouncing behavior (autocomplete and save)
- Test error handling (duplicate, database error)
- Test accessibility (keyboard nav, aria attributes)

**Integration Tests (Manual):**
- Test Settings page navigation from main app
- Test skill persistence across app restarts
- Test "Saving..." indicator timing (should be visible <500ms)
- Test autocomplete performance (<100ms after debounce)

### References

- [Source: epics-stories.md#Epic 4b: Job Scoring & Pipeline Management / Story 4b.1]
- [Source: prd.md#FR-4: Weighted Job Scoring]
- [Source: architecture.md#AR-1: Tauri Desktop Framework]
- [Source: architecture.md#AR-2: SQLCipher Database Integration]
- [Source: architecture.md#AR-3: Database Design Principles]
- [Source: prd.md#NFR-2: Local Data Encryption]
- [Source: prd.md#NFR-4: UI Response <100ms]
- [Source: prd.md#NFR-9: Query Performance]
- [Source: prd.md#NFR-14: Accessibility WCAG 2.1 AA]
- [Source: ux-design-specification.md#UX-1: Dark Mode]
- [Source: ux-design-specification.md#UX-4: Settings Organization]
- [Source: Story 1-8: Settings Table Schema]
- [Source: Story 2-3: SQLCipher Migration Framework]

## Dev Agent Record

### Agent Model Used
- (Pending implementation)

### Implementation Summary
- (Pending implementation)

### Deferred Work
- None

### Acceptance Criteria Status
- ⏳ **AC-1:** Pending implementation

### File List
- (Pending implementation)

## Change Log

- 2026-02-06: Story enhanced with comprehensive dev context — SM Agent (Bob)
  - Added database schema definition (V7 migration)
  - Added hardcoded Upwork skills list (50+ skills)
  - Added Tasks/Subtasks breakdown (8 tasks, 50+ subtasks)
  - Added Dev Notes: AR/NFR/UX references, story position, previous story intelligence
  - Added component design details, UX flow, security considerations, accessibility requirements
  - **Status: ready-for-dev — all context provided, no blockers**

- 2026-02-05: Story created by sprint-planning workflow
