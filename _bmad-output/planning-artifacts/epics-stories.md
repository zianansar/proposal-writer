xx# Epic Stories - Complete Breakdown

## Epic 0: Walking Skeleton (Proof of Concept) [MVP - SPIKE]

### Story 0.1: Basic Job Input UI

As a freelancer,
I want to paste a job post URL or text into the application,
So that I can start the proposal generation process quickly.

**Acceptance Criteria:**

**Given** the app is running
**When** I open the main window
**Then** I see a text input area for job post content
**And** I can paste either a URL or raw job text
**And** the input area has placeholder text explaining what to paste

**Technical Notes:**

- Simple textarea component, no database persistence yet
- URL vs text detection not required (both treated as text)
- No validation required in spike

---

### Story 0.2: Claude API Integration for Basic Generation

As a freelancer,
I want the app to generate a proposal draft using AI,
So that I don't have to write from scratch.

**Acceptance Criteria:**

**Given** I have pasted job content in the input
**When** I click "Generate Proposal"
**Then** the system calls Claude Sonnet 4.5 API with the job content
**And** receives a 3-paragraph proposal (Hook, Bridge, CTA)
**And** displays the generated text in a simple output area

**Technical Notes:**

- Hardcoded API key for spike (will move to keychain in Epic 2)
- Basic prompt template for generation
- No streaming yet (get full response, then display)
- Must achieve NFR-6: full generation <8s

---

### Story 0.3: Streaming UI Display

As a freelancer,
I want to see the proposal being generated in real-time,
So that I know the system is working and don't wait blindly.

**Acceptance Criteria:**

**Given** generation has started
**When** Claude API returns streaming tokens
**Then** I see text appearing progressively in the output area
**And** streaming starts within 1.5 seconds (NFR-5)
**And** tokens are batched at 50ms intervals (AR-10)

**Technical Notes:**

- **Round 6 Streaming Optimization (Performance Profiler):** Batch tokens in Rust for 50ms, emit single Tauri event with array of tokens. Frontend appends array to editor in one operation. Reduces re-renders from 20/sec to 2-3/sec, prevents jank with complex editor state.
- Tauri events for streaming from Rust backend to React frontend
- Simple text display (no rich formatting yet)
- If streaming UI takes >3 days, acceptable to ship console output instead per Round 4 refinement

---

### Story 0.4: Manual Copy to Clipboard

As a freelancer,
I want to manually copy the generated proposal,
So that I can paste it into Upwork's proposal form.

**Acceptance Criteria:**

**Given** a proposal has been generated
**When** I click "Copy to Clipboard" button
**Then** the proposal text is copied to my system clipboard
**And** I see a confirmation message "Copied!"
**And** I can paste it into any external application

**Technical Notes:**

- FR-13: Manual copy only, no auto-submit
- Simple button, no safety checks yet (Epic 3)

---

### Story 0.5: Validate AI Detection Passing

As a product team,
I want to validate that generated proposals pass AI detection tools,
So that we know the core concept works before investing in infrastructure.

**Acceptance Criteria:**

**Given** 5 test job posts from different industries
**When** I generate proposals for each
**Then** all 5 proposals are manually tested with AI detection tools
**And** at least 4/5 pass with perplexity <150
**And** findings are documented for Epic 3 safety threshold calibration

**Technical Notes:**

- Manual testing story (not automated)
- Use ZeroGPT, GPTZero, or similar tools
- If 5/5 pass, Epic 0 can be skipped per Round 4 refinement

---

## Epic 1: Basic Data Persistence [MVP]

### Story 1.1: SQLite Database Setup

As a developer,
I want a local SQLite database configured,
So that we can persist user data.

**Acceptance Criteria:**

**Given** the app starts for the first time
**When** the database connection is initialized
**Then** an SQLite database file is created in the user's app data directory
**And** the connection is available for all future operations
**And** app startup time remains <2 seconds (NFR-1)

**Technical Notes:**

- rusqlite 0.38 (AR-2)
- Database location: OS-specific app data folder
- UNENCRYPTED in this epic (encrypted in Epic 2)

---

### Story 1.2: Proposals Table Schema

As a developer,
I want a proposals table to store generated proposals,
So that users can access their past work.

**Acceptance Criteria:**

**Given** the database is initialized
**When** the app creates the schema
**Then** a `proposals` table exists with columns:

- id (INTEGER PRIMARY KEY)
- job_content (TEXT NOT NULL)
- generated_text (TEXT NOT NULL)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP)

**Technical Notes:**

- Only create proposals table in this story (not all tables upfront)
- Use SQL migration via refinery 0.9 (AR-18)

---

### Story 1.3: Save Generated Proposal to Database

As a freelancer,
I want my generated proposals automatically saved,
So that I can access them after closing the app.

**Acceptance Criteria:**

**Given** a proposal has been generated
**When** generation completes
**Then** the proposal is automatically saved to the `proposals` table
**And** I see a subtle "Saved" indicator
**And** the save operation completes in <100ms (NFR-4)

**Technical Notes:**

- Insert into proposals table
- Atomic transaction (NFR-19)
- No user confirmation needed (auto-save)

---

### Story 1.4: View Past Proposals List

As a freelancer,
I want to see a list of my past proposals,
So that I can review what I've generated before.

**Acceptance Criteria:**

**Given** I have generated 3+ proposals
**When** I navigate to "History" section
**Then** I see a list of all past proposals ordered by created_at DESC
**And** each item shows: job excerpt (first 100 chars), created date, and preview of proposal (first 200 chars)
**And** the list loads in <500ms even with 100+ proposals (NFR-17)

**Technical Notes:**

- Simple list view, no search/filter yet (Epic 7)
- **Query optimization (Round 6 Performance Profiler):** Exclude `generated_text` from list view to reduce data transfer from SQLCipher decryption. Use: `SELECT id, job_content, created_at FROM proposals ORDER BY created_at DESC LIMIT 100`
- **Database index:** Add index on `created_at` for fast sorting
- Load full proposal content only on detail view click

---

### Story 1.5: Dark Mode Basic CSS

As a freelancer (and developer),
I want the app to have a dark color scheme,
So that I can work comfortably during late-night proposal writing sessions.

**Acceptance Criteria:**

**Given** the app opens
**When** I view any screen
**Then** I see a dark background (#1a1a1a or similar)
**And** light text (#e0e0e0 or similar)
**And** sufficient contrast for WCAG AA compliance (NFR-20)
**And** no "white flash" on app startup

**Technical Notes:**

- Simple CSS variables, no theme switching yet (Epic 8 adds full theme system)
- From Round 4: prevents developer eye strain during 10-week dev cycle
- UX-1: dark mode by default

---

### Story 1.6: Encryption Stack Spike

As a developer,
I want to validate that rusqlite + SQLCipher + keyring work together,
So that Epic 2 encryption migration is de-risked.

**Acceptance Criteria:**

**Given** a test environment on Windows 10/11 and macOS
**When** I attempt to:

1. Create an encrypted SQLCipher database
2. Store a test key in OS keychain via keyring crate
3. Retrieve the key and open the encrypted database

**Then** all operations succeed on both platforms
**And** any platform-specific issues are documented
**And** fallback strategies are identified if integration fails

**Technical Notes:**

- From Round 4 Thesis Defense: de-risk Epic 2 before it starts
- Test on Windows 10 (multiple versions) and Windows 11
- Document Windows Defender interactions (from Hindsight: 40% failure was due to Defender)

---

### Story 1.7: API Key Configuration UI

As a freelancer,
I want to enter my Anthropic API key in the app,
So that I can use my own account for proposal generation.

**Acceptance Criteria:**

**Given** the app starts for the first time (no API key configured)
**When** I see the setup screen
**Then** I can enter my Anthropic API key in a text field
**And** the key is saved to a plaintext config file (will move to keychain in Epic 2)
**And** I see validation that the key format is correct (starts with "sk-ant-")

**Technical Notes:**

- Simple config file for now
- Warning: "Your API key will be encrypted in a future update"
- Basic format validation only

---

### Story 1.8: Settings Table for Configuration

As a developer,
I want a settings table to store app configuration,
So that user preferences persist across sessions.

**Acceptance Criteria:**

**Given** the database exists
**When** the settings table migration runs
**Then** a `settings` table is created with columns:

- key (TEXT PRIMARY KEY)
- value (TEXT)
- updated_at (TIMESTAMP)
**And** default settings are seeded (e.g., theme: "dark", api_provider: "anthropic")

**Technical Notes:**

- Key-value store pattern
- Migration includes seed data for defaults (AR-18)

---

### Story 1.9: Persist User Preferences

As a freelancer,
I want my app preferences saved,
So that I don't have to reconfigure every time I restart.

**Acceptance Criteria:**

**Given** I change a setting (e.g., adjust safety threshold)
**When** the setting is modified
**Then** it's immediately persisted to the settings table
**And** the setting is reloaded when I restart the app
**And** save completes in <50ms (NFR-4)

**Technical Notes:**

- UPSERT operation on settings table
- Reactive updates (setting change immediately affects UI)

---

### Story 1.10: Export Proposals to JSON

As a freelancer,
I want to export my proposals to a JSON file,
So that I have a manual backup before database migration in Epic 2.

**Acceptance Criteria:**

**Given** I have proposals in the database
**When** I click "Export Data" → "Export to JSON"
**Then** a JSON file is generated with all proposals
**And** the file is saved to my chosen location
**And** I see confirmation: "Exported 47 proposals to proposals-backup.json"

**Technical Notes:**

- From Round 4 Red Team: safety net for Epic 2 migration
- JSON format: array of proposal objects with all fields
- Include metadata (export_date, app_version)

---

### Story 1.11: Database Migration Framework Setup

As a developer,
I want a migration framework configured,
So that we can evolve the database schema safely over time.

**Acceptance Criteria:**

**Given** the app uses refinery 0.9 for migrations (AR-18)
**When** the app starts
**Then** all pending migrations are applied automatically
**And** migration history is tracked in a schema_migrations table
**And** failed migrations are logged with rollback capability

**Technical Notes:**

- refinery 0.9 setup with migration folder
- Migrations numbered: V1__initial_schema.sql, V2__add_settings.sql, etc.
- Atomic migrations with rollback on failure

---

### Story 1.12: Job Posts Table Schema

As a developer,
I want a table to store job posts separately from proposals,
So that users can analyze jobs before generating proposals (Epic 4).

**Acceptance Criteria:**

**Given** the database exists
**When** the job_posts table migration runs
**Then** a `job_posts` table is created with columns:

- id (INTEGER PRIMARY KEY)
- url (TEXT)
- raw_content (TEXT NOT NULL)
- client_name (TEXT)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

**Technical Notes:**

- Separate from proposals table (jobs are reusable, proposals are one-time)
- Will be populated in Epic 4a

---

### Story 1.13: API Error Handling

As a freelancer,
I want the app to handle API errors gracefully,
So that I can retry if Anthropic's service is down.

**Acceptance Criteria:**

**Given** I click "Generate Proposal"
**When** the Anthropic API returns an error (500, timeout, rate limit)
**Then** I see a user-friendly error message:

- "Unable to generate proposal. Anthropic API is temporarily unavailable."
- "Error: [specific error if helpful]"
- Button: "Retry" | "Save Job for Later"

**And** if I click "Save for Later", job is saved to queue
**And** retry uses exponential backoff (1s, 2s, 4s delays)

**Technical Notes:**

- From Round 5 Chaos Monkey: API errors will happen
- AR-23: circuit breaker (MVP = simple retry-once per stage)
- Graceful degradation, not crash

---

### Story 1.14: Draft Recovery on Crash

As a freelancer,
I want my in-progress proposals saved automatically,
So that I don't lose work if the app crashes.

**Acceptance Criteria:**

**Given** proposal generation is in progress
**When** the app crashes or is force-closed
**Then** on restart, I see: "Draft recovered from previous session"
**And** the last generated text is restored
**And** I can continue editing or regenerate

**Technical Notes:**

- NFR-11: draft recovery - atomic persistence, state saved on every generation chunk
- Save to proposals table with status: 'draft' vs 'completed'
- Stream chunks save every 50ms (AR-10 batching)

---

### Story 1.15: Onboarding Flow (Moved from Epic 8)

As a new user,
I want guided setup when I first open the app,
So that I can start quickly without confusion.

**Acceptance Criteria:**

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

**Technical Notes:**

- **Round 6 Critical Resequencing (Shark Tank):** Moved from Epic 8 to Epic 1. Cannot ship beta test (after Epic 3) without first-launch experience. Users need guided setup from day 1.
- UX-7: expectation management during onboarding
- Clear, simple language
- Optional steps clearly marked (Voice Calibration can be skipped)
- First-launch detection: check settings table for 'onboarding_completed' flag

---

### Story 1.16: Logging Infrastructure (Moved from Epic 8)

As a developer,
I want application logs for debugging,
So that we can diagnose issues in production.

**Acceptance Criteria:**

**Given** the app is running
**When** operations occur
**Then** logs are written via Rust `tracing` crate to:

- File: {app_data}/logs/app-{date}.log
- Levels: ERROR, WARN, INFO, DEBUG
- Daily rotation (new file each day)
- 7-day retention (old logs auto-deleted)

**And** logs include: timestamp, level, module, message
**And** sensitive data (API keys, passphrases) are redacted
**And** log level configurable via settings (default: INFO)

**Technical Notes:**

- **Round 6 Critical Resequencing (Lessons Learned):** Moved from Epic 8 to Epic 1. Logging is infrastructure, not polish. Required for debugging beta test issues starting after Epic 3.
- AR-19: logging with daily rotation, 7-day retention
- tracing + tracing-subscriber crates (Rust)
- Structured logging (JSON format for parsing)
- Log to file AND console in development, file only in production

---

## Epic 2: Security & Encryption [MVP]

### Story 2.1: Passphrase Entry UI

As a freelancer,
I want to create a strong passphrase to protect my data,
So that my proposals and API key are encrypted.

**Acceptance Criteria:**

**Given** the app starts for the first time after Epic 1
**When** I'm prompted to set up encryption
**Then** I see a passphrase entry screen with:

- Password field (**min 12 characters** - updated from 8 per Round 5 Security Audit)
- Confirmation field
- Strength meter showing weak/medium/strong
- **Warning (Round 6 Rubber Duck):** "⚠️ CRITICAL: If you forget your passphrase AND lose your recovery key, all proposals are PERMANENTLY UNRECOVERABLE. We cannot reset your password or decrypt your data. Keep your recovery key safe."

**And** I cannot proceed until passphrase meets minimum requirements
**And** I must check acknowledgment: "I understand my data will be permanently lost if I forget my passphrase and lose my recovery key"

**Technical Notes:**

- Argon2id key derivation (AR-3)
- Strength meter checks: length (≥12), uppercase, numbers, symbols
- From Round 5: increased from 8 to 12 chars to prevent GPU brute force
- Clear warning about recovery impossibility

---

### Story 2.2: Pre-Migration Automated Backup

As a freelancer,
I want my data automatically backed up before encryption migration,
So that I don't lose anything if migration fails.

**Acceptance Criteria:**

**Given** I've set my passphrase
**When** migration begins
**Then** the system automatically exports all data to JSON
**And** saves it to: {app_data}/backups/pre-encryption-backup-{timestamp}.json
**And** I see: "Backup created: 47 proposals saved to backup file"
**And** migration does not proceed until backup confirms success

**Technical Notes:**

- From Round 4 Red Team + migration safety protocol
- Automatic, not user-triggered (different from Story 1.10 manual export)
- Verify backup file is readable before proceeding

---

### Story 2.3: SQLite to SQLCipher Database Migration

As a developer,
I want to migrate the unencrypted SQLite database to encrypted SQLCipher,
So that user data is protected at rest.

**Acceptance Criteria:**

**Given** backup is complete and passphrase is set
**When** migration executes
**Then** the system:

1. Creates new SQLCipher database with Argon2id-derived key
2. Copies all tables and data from old SQLite database
3. Verifies row counts match (proposals, settings, job_posts)
4. Renames old database to .old extension
5. Sets new database as primary

**And** migration completes in single atomic transaction
**And** if any step fails, system rolls back and restores from backup

**Technical Notes:**

- From Round 4 migration safety protocol (6 steps)
- **Round 6 Atomic Transaction Method (Rubber Duck):** Use ATTACH DATABASE to enable single transaction across unencrypted→encrypted migration:
  1. Create new encrypted database with Argon2id key (3 iterations, ~200ms derivation)
  2. ATTACH old unencrypted database: `ATTACH DATABASE 'old.db' AS old_db`
  3. INSERT INTO encrypted SELECT FROM old_db in single transaction
  4. Verify row counts match: `SELECT COUNT(*) FROM proposals` vs `SELECT COUNT(*) FROM old_db.proposals`
  5. COMMIT transaction (atomic all-or-nothing)
  6. DETACH old_db and rename to .old extension
- Test that ATTACH works across encryption boundary (SQLCipher-specific behavior)
- Test on Windows 10/11 all versions per Epic 1.6 findings
- AR-2: SQLCipher 4.10 bundled with rusqlite 0.38

---

### Story 2.4: Migration Verification and User Confirmation

As a freelancer,
I want to confirm my data was migrated correctly,
So that I can safely delete the unencrypted backup.

**Acceptance Criteria:**

**Given** migration completed successfully
**When** I see the migration summary screen
**Then** I see:

- "Migration complete! ✓"
- "47 proposals migrated successfully"
- "Original database backed up to: {path}"
- Button: "Delete Unencrypted Database" (requires confirmation)
- Button: "Keep Both (for now)"

**And** I must make explicit choice before proceeding

**Technical Notes:**

- From Round 4 migration safety protocol step 4
- Conservative default: keep both until user confirms
- Clear explanation of security implications

---

### Story 2.5: Migration Failure Recovery

As a freelancer,
I want the app to recover gracefully if migration fails,
So that I don't lose my data.

**Acceptance Criteria:**

**Given** migration encounters an error (e.g., disk full, corruption)
**When** the error is detected
**Then** the system:

1. Halts migration immediately
2. Rolls back any partial changes
3. Restores from pre-migration backup
4. Shows error: "Migration failed: {reason}. Your data has been restored."
5. Logs detailed error for debugging

**And** the app continues to function with unencrypted database
**And** user can retry migration after fixing issue

**Technical Notes:**

- From Round 4 Hindsight (40% failure rate in future)
- Detailed logging for support
- Graceful degradation, not crash

---

### Story 2.6: API Key Migration to OS Keychain

As a freelancer,
I want my Anthropic API key moved from plaintext config to OS keychain,
So that it's securely stored.

**Acceptance Criteria:**

**Given** API key exists in plaintext config file from Epic 1
**When** encryption setup completes
**Then** the system:

1. Reads API key from config file
2. Stores it in OS keychain via keyring crate (AR-17)
3. Deletes key from config file
4. Verifies retrieval from keychain works

**And** future API calls retrieve key from keychain
**And** macOS uses Keychain Access, Windows uses Credential Manager

**Technical Notes:**

- NFR-10: credential storage in OS keychain
- Test keychain access on both platforms
- Handle keychain access denied gracefully

---

### Story 2.7: Encrypted Database Access on App Restart

As a freelancer,
I want to enter my passphrase when restarting the app,
So that I can access my encrypted data.

**Acceptance Criteria:**

**Given** the app is restarting with encrypted database
**When** the app opens
**Then** I'm prompted for my passphrase
**And** the passphrase is used to derive the decryption key via Argon2id
**And** if correct, the database opens and app proceeds normally
**And** if incorrect, I see "Incorrect passphrase. Try again." and can retry
**And** after 5 failed attempts, I see recovery options (restore from backup)

**Technical Notes:**

- Passphrase not stored anywhere (derived key only)
- Constant-time comparison to prevent timing attacks
- Clear button to reveal/hide passphrase

---

### Story 2.8: Encryption Status Indicator

As a freelancer,
I want to see that my data is encrypted,
So that I have confidence in the app's security.

**Acceptance Criteria:**

**Given** encryption is enabled
**When** I view the app
**Then** I see a lock icon 🔒 in the status bar
**And** hovering shows tooltip: "Data encrypted with AES-256"
**And** clicking shows encryption details: database encrypted, API key in keychain

**Technical Notes:**

- Simple visual confidence signal
- NFR-7: AES-256 encryption via SQLCipher

---

### Story 2.9: Passphrase Recovery Options

As a freelancer,
I want a way to recover my data if I forget my passphrase,
So that I don't permanently lose all my proposals.

**Acceptance Criteria:**

**Given** I'm setting up encryption (Story 2.1)
**When** I create my passphrase
**Then** I'm offered recovery options:

- **Option 1:** "Print Recovery Key" (generates one-time recovery code, user prints it)
- **Option 2:** "Export Unencrypted Backup" (export JSON before encryption, user stores safely)

**And** I must acknowledge: "Recovery key is the ONLY way to recover if passphrase forgotten"
**And** I can skip recovery setup (with warning)

**Technical Notes:**

- From Round 5 Security Audit: passphrase forgotten = data lost without recovery
- Recovery key: random 32-char string, can decrypt database
- Stored separately (user's responsibility to keep safe)
- Balance security (no password reset) with usability (recovery option)

---

## Epic 3: Safety & Compliance Controls [MVP]

### Story 3.1: Pre-Flight Perplexity Analysis

As a freelancer,
I want the app to check my proposal for AI detection risk before I copy it,
So that I don't accidentally submit a proposal that gets flagged.

**Acceptance Criteria:**

**Given** a proposal has been generated
**When** I click "Copy to Clipboard"
**Then** the system first runs a pre-flight scan using Claude Haiku
**And** calculates a perplexity score
**And** if score is <180 (adjusted from 150 per Round 4), copy proceeds
**And** if score is ≥180, copy is blocked and I see warning screen

**Technical Notes:**

- FR-11: pre-flight scan before copy
- Uses Claude Haiku for cost-effective analysis (AR-4)
- Threshold 180 from Round 4 Hindsight (150 flagged 60% of proposals)

---

### Story 3.2: Safety Warning Screen with Flagged Sentences

As a freelancer,
I want to see which parts of my proposal are risky,
So that I can fix them before submitting.

**Acceptance Criteria:**

**Given** pre-flight scan failed (perplexity ≥180)
**When** I see the warning screen
**Then** I see:

- "⚠️ AI Detection Risk Detected"
- Perplexity score: 185 (threshold: 180)
- List of flagged sentences with highlights
- Humanization suggestions for each sentence
- Buttons: "Edit Proposal" | "Override (Risky)"

**Technical Notes:**

- FR-11: display flagged sentences with suggestions
- Specific edit examples, not generic "add variety" (from Round 3 User Persona)
- Clear, actionable guidance

---

### Story 3.3: Humanization Injection During Generation

As a freelancer,
I want natural imperfections automatically injected into proposals,
So that they sound more human-written.

**Acceptance Criteria:**

**Given** proposal generation is in progress
**When** text is being generated by Claude
**Then** the system injects natural imperfections at rate of 1-2 per 100 words
**And** imperfections include: contractions, minor grammatical variations, informal transitions
**And** the proposal still reads professionally
**And** generation time remains <8 seconds (NFR-6)

**Technical Notes:**

- FR-7: natural imperfections injection
- Applied during generation via prompt engineering, not post-processing
- Subtle enough to not harm quality

---

### Story 3.4: One-Click Re-Humanization

As a freelancer,
I want to regenerate a proposal with more humanization,
So that I can pass AI detection without manual editing.

**Acceptance Criteria:**

**Given** I'm on the safety warning screen
**When** I click "Regenerate with More Humanization"
**Then** the system regenerates the proposal with increased imperfection rate (2-3 per 100 words)
**And** runs pre-flight scan again
**And** shows new perplexity score
**And** if still failing, offers to increase further

**Technical Notes:**

- From Round 3 User Persona: actionable solution, not just warning
- Iterative approach: increase humanization until passing
- Maximum 3 attempts to avoid degrading quality

---

### Story 3.5: Safety Threshold Configuration

As a freelancer,
I want to adjust the AI detection sensitivity,
So that I can balance safety vs. strictness based on my comfort level.

**Acceptance Criteria:**

**Given** I'm in Settings
**When** I navigate to Safety settings
**Then** I see a slider for "AI Detection Threshold"
**And** range is 140-220 (default 180 per Round 4)
**And** slider shows labels: "Strict" (140) | "Balanced" (180) | "Permissive" (220)
**And** changing the slider immediately saves to database
**And** I see explanation: "Lower = stricter checks, Higher = more proposals pass"

**Technical Notes:**

- From Round 3 User Persona: configurable threshold
- Default 180 from Round 4 Hindsight data
- Persistent across sessions

---

### Story 3.6: Override Safety Warning

As a freelancer,
I want to manually override the safety warning,
So that I can copy a proposal even if it's flagged (at my own risk).

**Acceptance Criteria:**

**Given** I'm on the safety warning screen
**When** I click "Override (Use at Your Own Risk)"
**Then** I see a confirmation dialog:

- "⚠️ This proposal may be detected as AI-generated."
- "Upwork may penalize your account."
- "Are you sure you want to copy it?"
- Buttons: "Cancel" | "Copy Anyway"

**And** if I confirm, the proposal is copied to clipboard
**And** override is logged for adaptive learning (Story 3.7)

**Technical Notes:**

- From Round 3 User Persona: override capability for edge cases
- Clear warning about consequences
- Not encouraged, but available

---

### Story 3.7: Adaptive Threshold Learning from Overrides

As a freelancer,
I want the app to learn from my successful overrides,
So that the threshold adjusts to my risk tolerance over time.

**Acceptance Criteria:**

**Given** I have overridden the safety warning 3+ times
**When** the system detects this pattern
**Then** I see a notification:

- "You've successfully used 3 proposals that were flagged."
- "Would you like to adjust your threshold from 180 to 190?"
- Buttons: "Yes, Adjust" | "No, Keep Current"

**And** if I accept, my personal threshold is increased
**And** future proposals are evaluated against my adjusted threshold

**Technical Notes:**

- From Round 4 Red Team: "learn from overrides" adaptive system
- Only suggests increase if overrides were "successful" (user confirms no issues)
- Maximum threshold 220 to prevent completely disabling safety

---

### Story 3.8: Rate Limiting Enforcement

As a freelancer,
I want the app to prevent me from over-generating,
So that I don't burn through API credits or raise red flags.

**Acceptance Criteria:**

**Given** I have generated a proposal
**When** I try to generate another within 2 minutes
**Then** I see: "⏱️ Please wait 47 seconds before generating another proposal."
**And** the "Generate" button is disabled with countdown timer
**And** after 2 minutes, the button re-enables

**Technical Notes:**

- FR-12: cooldown max 1 generation per 2 minutes
- Backend enforcement (not just UI disable)
- Phase 2: UI controls in settings (for now, hardcoded)

---

### Story 3.9: Core Keyboard Shortcuts

As a freelancer,
I want to use keyboard shortcuts for common actions,
So that I can work efficiently without reaching for my mouse.

**Acceptance Criteria:**

**Given** I'm using the app
**When** I press keyboard shortcuts
**Then** the following work correctly:

- **Cmd/Ctrl + Enter**: Generate proposal (if job input has content)
- **Cmd/Ctrl + C**: Copy proposal to clipboard (if generation complete and safety passed)
- **Tab / Shift+Tab**: Navigate between UI elements in logical order

**And** shortcuts are displayed in tooltips/buttons
**And** focus indicators are clearly visible

**Technical Notes:**

- From Round 4 Hindsight: early adopters are power users, need shortcuts NOW
- UX-3: keyboard shortcuts for power users
- Full keyboard nav (accessibility) comes in Epic 8
- macOS uses Cmd, Windows uses Ctrl

---

## Epic 4a: Job Input & Extraction [MVP]

### Story 4a.1: Job Post Input with URL or Text Detection

As a freelancer,
I want to paste either a job URL or raw job text,
So that I have flexibility in how I provide job information.

**Acceptance Criteria:**

**Given** I'm on the job input screen
**When** I paste content into the input field
**Then** the system detects if it's a URL (starts with http/https) or raw text
**And** if URL, shows indicator: "Job URL detected"
**And** if text, shows indicator: "Raw job text detected"
**And** both are accepted and saved to job_posts table

**Technical Notes:**

- FR-1: paste URL or text
- Simple detection: URL starts with http/https
- No actual URL fetching yet (future enhancement)
- Both stored in raw_content field

---

### Story 4a.2: Client Name Extraction

As a freelancer,
I want the app to automatically identify the client's name from the job post,
So that I can personalize my proposal.

**Acceptance Criteria:**

**Given** I've pasted a job post
**When** I click "Analyze Job"
**Then** the system uses Claude Haiku to extract the client name
**And** displays: "Client: John Smith" (or "Unknown" if not found)
**And** saves client_name to job_posts table
**And** analysis completes in <3 seconds

**Technical Notes:**

- FR-2: extract client name
- Uses Claude Haiku for cost-effective analysis (AR-4)
- Prompt caching for analysis prompts (AR-5)
- Few-shot examples in prompt to improve accuracy

---

### Story 4a.3: Key Skills Extraction

As a freelancer,
I want to see which skills are required for this job,
So that I can highlight relevant experience in my proposal.

**Acceptance Criteria:**

**Given** job analysis is running
**When** Claude Haiku processes the job post
**Then** it extracts 3-7 key skills mentioned in the post
**And** displays them as tags: [React] [TypeScript] [API Integration] [Testing]
**And** skills are saved to a job_skills table (new migration)

**Technical Notes:**

- FR-2: extract key skills
- Skills stored separately for future matching (Epic 4b)
- Return structured list from Claude

---

### Story 4a.4: Hidden Needs Detection

As a freelancer,
I want the app to identify implied client priorities not explicitly stated,
So that I can address their real concerns in my proposal.

**Acceptance Criteria:**

**Given** job analysis is running
**When** Claude Haiku analyzes the job post
**Then** it identifies 2-3 hidden needs based on job language
**And** displays them with explanations:

- "Client is stressed → They mention 'urgent' and 'ASAP'"
- "Budget-conscious → They emphasize 'cost-effective solution'"

**And** hidden needs are saved to job_posts table (JSON field)

**Technical Notes:**

- FR-2: extract hidden needs (2-3 implied priorities)
- Advanced analysis requiring reasoning
- Examples help Claude identify patterns: "fast turnaround" → urgency, "proven track record" → risk-averse
- From Round 4 Thesis Defense: most valuable for high-volume users (Marcus)

---

### Story 4a.5: Job Skills Table Schema

As a developer,
I want a table to store job skills separately,
So that we can match skills against user profile in Epic 4b.

**Acceptance Criteria:**

**Given** the database exists
**When** the job_skills migration runs
**Then** a `job_skills` table is created with columns:

- id (INTEGER PRIMARY KEY)
- job_post_id (INTEGER, foreign key to job_posts)
- skill_name (TEXT NOT NULL)

**And** a many-to-many relationship allows multiple skills per job

**Technical Notes:**

- Normalized schema for skill matching
- Will be used in Epic 4b for scoring

---

### Story 4a.6: Job Analysis Loading State

As a freelancer,
I want to see progress while job analysis is running,
So that I know the app is working and not frozen.

**Acceptance Criteria:**

**Given** I clicked "Analyze Job"
**When** analysis is in progress
**Then** I see a progress indicator with stages:

- "Analyzing job post..." (0-2s)
- "Extracting details..." (2-3s)
- "Complete! ✓" (3s)

**And** each stage shows a subtle animation
**And** total time is <3 seconds per performance target

**Technical Notes:**

- UX feedback during async operation
- Real-time stage updates via Tauri events

---

### Story 4a.7: Job Analysis Results Display

As a freelancer,
I want to see all extracted information in a clear format,
So that I can quickly understand the job requirements.

**Acceptance Criteria:**

**Given** job analysis has completed
**When** I view the results
**Then** I see a structured display:

**Client:** John Smith
**Key Skills:** [React] [TypeScript] [API Integration]
**Hidden Needs:**

- 🔥 Client is stressed (mentioned "urgent" 3 times)
- 💰 Budget-conscious (emphasized "cost-effective")

**And** I can click "Generate Proposal" to use this analysis

**Technical Notes:**

- Clear information hierarchy
- Icons for visual scanning
- Prepares context for Epic 5 (hook selection)

---

### Story 4a.8: Save Job Analysis to Database

As a freelancer,
I want analyzed jobs saved to my database,
So that I can reference them later.

**Acceptance Criteria:**

**Given** job analysis has completed
**When** the analysis finishes
**Then** the system saves to database:

- job_posts table: id, url, raw_content, client_name, created_at
- job_skills table: extracted skills linked to job_post_id
- hidden_needs JSON field in job_posts

**And** save completes atomically in <100ms (NFR-4)
**And** I see subtle "Saved ✓" indicator

**Technical Notes:**

- NFR-19: atomic persistence
- All related data saved in single transaction

---

### Story 4a.9: Sanitize Job Input (Prompt Injection Defense)

As a system,
I want to prevent malicious job posts from injecting commands into AI prompts,
So that the app remains secure.

**Acceptance Criteria:**

**Given** a user pastes job content
**When** the content is sent to Claude API
**Then** the system:

1. **Escapes XML special characters (Round 6 Rubber Duck):** Replace `<` with `&lt;`, `>` with `&gt;`, `&` with `&amp;` in job content before wrapping
2. Wraps job content in XML delimiters per AR-13 (`<job_post>...</job_post>`)
3. **Limits input to 25K tokens with sentence boundary preservation (Round 6 Rubber Duck):** If >25K tokens, truncate at last complete sentence (period + space) before 25K boundary
4. Sanitizes attempts like "Ignore previous instructions"

**And** sanitization happens before API call
**And** if truncated, user sees warning: "⚠️ Job post too long. Last ~5K tokens removed. Analysis may be incomplete. Consider summarizing the job post manually."

**Technical Notes:**

- From Round 5 Security Audit: prompt injection is HIGH severity risk
- AR-13: prompt boundary enforcement with XML delimiters
- AR-6: max 25K input tokens per generation
- From Chaos Monkey: handle extreme inputs gracefully

---

## Epic 4b: Job Scoring & Pipeline Management [MVP]

### Story 4b.1: User Profile Skills Configuration

As a freelancer,
I want to configure my skills profile,
So that the app can match me against job requirements.

**Acceptance Criteria:**

**Given** I'm in Settings → Profile
**When** I enter my skills
**Then** I can add skills via autocomplete or free text
**And** skills are saved to a user_skills table (new migration)
**And** I see my current skills as removable tags
**And** changes save immediately

**Technical Notes:**

- Required for FR-4: weighted scoring
- Autocomplete suggests common Upwork skills
- Will be matched against job_skills in Story 4b.3

---

### Story 4b.2: Skills Match Percentage Calculation

As a freelancer,
I want to see how well my skills match the job requirements,
So that I know if this job is a good fit for me.

**Acceptance Criteria:**

**Given** I have configured my skills profile
**When** a job is analyzed
**Then** the system calculates skills match percentage:

- Count: skills in job that I have / total skills in job
- Example: Job requires [React, TypeScript, Testing] → I have [React, TypeScript] → 67% match

**And** displays: "Skills Match: 67%" with color:

- Green: ≥75%
- Yellow: 50-74%
- Red: <50%

**Technical Notes:**

- Simple intersection calculation
- Case-insensitive matching
- Part of FR-4 weighted scoring

---

### Story 4b.3: Client Quality Score Estimation

As a freelancer,
I want to see an estimated client quality score,
So that I can avoid problematic clients.

**Acceptance Criteria:**

**Given** a job post is being analyzed
**When** Claude Haiku processes the job
**Then** it estimates client quality (0-100) based on:

- Payment history indicators ("paid on time", "verified payment")
- Hire rate signals ("0 hires" vs "100% hire rate")
- Communication quality (well-written post vs vague)

**And** displays: "Client Quality: 85%" with color:

- Green: ≥80
- Yellow: 60-79
- Red: <60 or "0 hires"

**Technical Notes:**

- FR-4: client quality scoring
- Inference-based (no access to real Upwork data)
- Claude analyzes job post language for signals

---

### Story 4b.4: Budget Alignment Detection

As a freelancer,
I want to know if the job budget matches my rate expectations,
So that I don't waste time on low-budget jobs.

**Acceptance Criteria:**

**Given** I've configured my hourly/project rate in settings
**When** a job mentions budget
**Then** the system extracts budget from job post
**And** compares to my rate
**And** displays: "Budget Alignment: 90%" with color:

- Green: budget ≥ my rate
- Yellow: budget 70-99% of my rate
- Red: budget <70% of my rate

**Technical Notes:**

- Part of FR-4 weighted scoring
- Handles hourly ($50/hr) and project ($2000 fixed) budgets
- If budget not mentioned, shows "Unknown"

---

### Story 4b.5: Weighted Job Scoring Algorithm

As a freelancer,
I want an overall job score combining multiple factors,
So that I can quickly prioritize which jobs to pursue.

**Acceptance Criteria:**

**Given** skills match, client quality, and budget alignment are calculated
**When** overall score is computed
**Then** the system uses weighted formula:

- Skills match: 40% weight
- Client quality: 40% weight
- Budget alignment: 20% weight

**And** final score (0-100) determines color:

- **Green:** ≥75% match AND ≥80 client score
- **Yellow:** 50-74% match OR 60-79% client score
- **Red:** <50% match OR <60% client score OR 0-hire client

**And** I see overall score with breakdown

**Technical Notes:**

- FR-4: weighted scoring with Green/Yellow/Red flags
- Exact thresholds from PRD
- Allows drill-down to see why job scored as it did

---

### Story 4b.6: Scoring Breakdown UI ("Why is this Yellow?")

As a freelancer,
I want to understand why a job received its color rating,
So that I can trust the scoring system.

**Acceptance Criteria:**

**Given** a job has been scored
**When** I click on the color flag or score
**Then** I see a detailed breakdown:

**Overall: Yellow (68%)**
**Why Yellow?**

- ✅ Skills Match: 75% (good) - You have 3/4 required skills
- ⚠️ Client Quality: 60% (medium risk) - Only 2 previous hires
- ✅ Budget: 90% (good) - $55/hr vs your $50/hr rate

**Recommendation:** Proceed with caution. Client is new to Upwork.

**Technical Notes:**

- From Round 3 User Persona (Marcus needs transparency)
- FR-17: rationalized scoring with human-readable explanations
- Each component shows why it scored as it did

---

### Story 4b.7: RSS Feed Import

As a freelancer,
I want to import multiple jobs from an RSS feed,
So that I can batch-analyze opportunities.

**Acceptance Criteria:**

**Given** I'm on the Job Import screen
**When** I paste an Upwork RSS feed URL
**Then** the system fetches the feed
**And** extracts 10-50 job posts (depending on feed size)
**And** saves each to job_posts table with status 'pending_analysis'
**And** **returns immediately with confirmation (Round 6 Performance Profiler):** "23 jobs imported. Analysis in progress..."
**And** I can navigate away to other screens
**And** background worker processes queue sequentially at 1 job per 2 seconds
**And** I see real-time progress updates: "Analyzed 5/23 jobs..." (updates every 2 seconds)
**And** I receive notification when complete: "All 23 jobs analyzed. View queue →"

**Technical Notes:**

- FR-3: RSS feed batch import
- Parse standard RSS XML format
- **Round 6 Background Processing:** Import RSS → save to queue → return immediately → background worker processes queue. Prevents UI blocking for 100+ seconds.
- Rate limit: 1 analysis per 2 seconds to avoid API throttling
- Background worker uses Tauri async commands with progress events

---

### Story 4b.8: RSS Feed Fallback to Web Scraping

As a freelancer,
I want the app to still work if Upwork blocks RSS feeds,
So that I can continue importing jobs.

**Acceptance Criteria:**

**Given** RSS feed import fails (403 Forbidden, timeout, or invalid feed)
**When** the error is detected
**Then** the system shows: "RSS blocked. Trying alternative method..."
**And** falls back to web scraping the Upwork search page
**And** extracts jobs from HTML
**And** if both fail, shows clear error with manual paste option

**Technical Notes:**

- From Round 4 Hindsight: "RSS will break. Upwork hates automation."
- Graceful degradation: RSS → scraping → manual paste
- Scraping requires HTML parsing (use scraper crate)

---

### Story 4b.9: Job Queue View with Sorting

As a freelancer,
I want to see all my imported jobs in a sortable queue,
So that I can prioritize which proposals to write first.

**Acceptance Criteria:**

**Given** I have imported/analyzed multiple jobs
**When** I view the Job Queue
**Then** I see a list of all jobs with:

- Client name
- Skills match %
- Client quality %
- Overall score & color
- Created date

**And** I can sort by: score (default), date, client name
**And** I can filter by: Green only, Yellow+Green, All
**And** queue loads in <500ms even with 100+ jobs (NFR-17)

**Technical Notes:**

- UX-2: Green/Yellow/Red indicators with progressive disclosure
- Query performance critical (NFR-17)
- **Round 6 Database Index (Performance Profiler):** Create index on `overall_score` column for fast sorting: `CREATE INDEX idx_jobs_overall_score ON job_posts(overall_score DESC)`
- **Reuse virtualization pattern (Round 6):** Same react-window virtualization library used in Story 8.7 for proposal history
- Query: `SELECT id, client_name, skills_match, client_quality, overall_score, created_at FROM job_posts ORDER BY overall_score DESC LIMIT 100`

---

### Story 4b.10: Report Bad Scoring Feedback Loop

As a freelancer,
I want to report when the scoring is wrong,
So that the system can improve over time.

**Acceptance Criteria:**

**Given** I disagree with a job's score
**When** I click "Report Incorrect Score" on a job
**Then** I see a form:

- "What's wrong with this score?"
- Checkboxes: Skills mismatch, Client quality wrong, Budget wrong, Other
- Free text field for details

**And** when I submit, feedback is logged to database
**And** I see: "Thanks! We'll use this to improve scoring."

**Technical Notes:**

- From Round 4 Red Team: feedback loop for bad scoring
- Data collected for future ML improvements (v1.1+)
- For now, just logged (not used to adjust scoring yet)

---

## Epic 5: Strategic Hook Selection & Voice Calibration [MVP]

### Story 5.1: Hook Strategies Seed Data

As a developer,
I want default hook strategies bundled with the app,
So that users have options immediately without configuration.

**Acceptance Criteria:**

**Given** the database is initialized
**When** migrations run
**Then** a `hook_strategies` table is created and seeded with:

- Social Proof (examples: "I've helped 12 clients...", "My clients see 40% increase...")
- Contrarian ("Most freelancers will..., but I...")
- Immediate Value ("Here's a quick win you can implement today...")
- Problem-Aware ("I noticed your team is struggling with...")
- Question-Based ("What if you could reduce costs by 30%?")

**And** each strategy includes 2-3 example openers

**Technical Notes:**

- AR-18: seed data for default hook strategies
- From implementation artifacts: upwork-proposal-hook-library.md
- FR-5: hook strategy selection

---

### Story 5.2: Hook Strategy Selection UI

As a freelancer,
I want to choose which hook strategy to use for my proposal,
So that I can match my approach to the client's needs.

**Acceptance Criteria:**

**Given** I'm about to generate a proposal
**When** I see the hook selection screen
**Then** I see 5 hook strategies as cards:

- Strategy name
- Brief description
- Example opening line
- "Best for: [client type]"

**And** I can select one strategy (default: Social Proof)
**And** selection is saved and used for generation

**Technical Notes:**

- FR-5: hook strategy selection
- Visual card interface for easy scanning
- Strategy influences generation prompt

---

### Story 5.3: Golden Set Upload UI

As a freelancer,
I want to upload 3-5 of my best past proposals,
So that the app can learn my writing style quickly.

**Acceptance Criteria:**

**Given** I'm in Settings → Voice Calibration
**When** I click "Upload Golden Set"
**Then** I see a file picker or text paste area
**And** I can upload/paste 3-5 past proposals
**And** I see: "Upload 3-5 of your best proposals that got responses"
**And** each proposal must be 200+ words
**And** I see count: "2/5 proposals uploaded"

**Technical Notes:**

- FR-16: Golden Set calibration
- Text paste OR file upload (.txt, .pdf)
- Stored in golden_set_proposals table

---

### Story 5.4: Local-Only Voice Analysis

As a freelancer,
I want my past proposals analyzed locally without sending full text to any server,
So that my competitive writing samples stay private.

**Acceptance Criteria:**

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

**Technical Notes:**

- AR-12: privacy layer - send style params, not raw samples
- All analysis happens client-side
- Only derived parameters sent to Claude in prompts

---

### Story 5.5: Voice Profile Display

As a freelancer,
I want to see my calibrated voice profile,
So that I understand how the app will generate proposals for me.

**Acceptance Criteria:**

**Given** voice calibration is complete
**When** I view my Voice Profile
**Then** I see:

**Your Writing Style:**

- **Tone:** Professional (85% formal language)
- **Length:** Moderate (avg 15 words/sentence)
- **Structure:** Mixed (60% paragraphs, 40% bullets)
- **Technical Depth:** Expert (technical terms: 12%)

**And** I see "Based on 5 past proposals"
**And** I can click "Recalibrate" to update

**Technical Notes:**

- Human-readable parameters
- Transparent about what was learned
- Builds trust per UX-8 (progressive trust building)

---

### Story 5.6: Privacy Indicator: "Proposals Never Leave Your Device"

As a freelancer,
I want clear reassurance that my proposals stay private,
So that I feel comfortable uploading my best work.

**Acceptance Criteria:**

**Given** I'm on the Golden Set upload screen
**When** I view the page
**Then** I see a prominent indicator:

**🔒 Your proposals never leave your device**
"We analyze your writing style locally and only send statistical parameters (like tone and length) to the AI. Your actual proposal text stays on your computer."

**And** clicking "How does this work?" shows detailed explanation

**Technical Notes:**

- From Round 4 Red Team: change "privacy layer" to "local-only"
- Visual trust signal (lock icon, green badge)
- Clear, non-technical language

---

### Story 5.7: Quick Calibration Alternative (5 Questions)

As a freelancer,
I want to calibrate my voice by answering questions instead of uploading proposals,
So that I can start quickly without past examples.

**Acceptance Criteria:**

**Given** I'm on Voice Calibration screen
**When** I click "Quick Calibration (No uploads needed)"
**Then** I answer 5 questions:

1. **Tone:** Formal / Professional / Casual / Friendly?
2. **Length:** Brief / Moderate / Detailed?
3. **Technical Depth:** Simple / Technical / Expert?
4. **Structure:** Bullet points / Paragraphs / Mixed?
5. **Call-to-Action:** Direct / Consultative / Question-based?

**And** answers are converted to voice parameters
**And** I see: "Voice calibrated! You can always upload proposals later for better accuracy."

**Technical Notes:**

- From Round 3 What If Scenarios: alternative for users without past work
- Maps questions to same parameters as Golden Set analysis
- Less accurate but immediate

---

### Story 5.5b: Persist Voice Profile to Database

As a developer,
I want voice profile parameters saved to the database,
So that they persist across sessions and can be loaded for generation.

**Acceptance Criteria:**

**Given** voice calibration completes (Golden Set or Quick Calibration)
**When** parameters are extracted
**Then** they are saved to a `voice_profiles` table:

- user_id (for multi-user future support)
- tone (1-10 scale: formal to casual)
- avg_sentence_length (integer)
- structure_preference (bullets/paragraphs/mixed percentages)
- technical_depth (1-10 scale)
- updated_at (TIMESTAMP)

**And** voice profile is loaded on app startup
**And** updates when user recalibrates

**Technical Notes:**

- From Round 5 Thread of Thought: missing link in voice storage
- Single row per user (UPDATE on recalibration)
- Queried in Story 5.8 for generation

---

### Story 5.8: Voice-Informed Proposal Generation

As a freelancer,
I want generated proposals to match my calibrated voice,
So that they sound like I wrote them.

**Acceptance Criteria:**

**Given** I have calibrated my voice (Golden Set or Quick Calibration)
**When** I generate a proposal
**Then** the system:

1. **Loads voice profile AND job context in parallel (Round 6 Rubber Duck clarification):**
   - Concurrent query 1: `SELECT * FROM voice_profiles WHERE user_id = ?`
   - Concurrent query 2: `SELECT * FROM job_posts JOIN job_skills WHERE job_id = ?`
   - Both complete before prompt assembly (AR-8 hybrid pipeline)
2. Assembles generation prompt combining both contexts
3. Includes voice parameters in Claude prompt:
   - "Write in a [professional] tone"
   - "Use [moderate] length sentences (avg 15 words)"
   - "Mix [paragraphs 60%] and [bullets 40%]"
   - "Technical depth: [expert level]"

**And** the generated proposal reflects these parameters
**And** before/after calibration shows noticeable difference

**Technical Notes:**

- AR-5: prompt caching for voice parameters
- Voice params injected into system prompt
- 30-second calibration time target (FR-16)
- From Round 5 Thread of Thought: clarified data flow

---

## Epic 6: Rich Editor & Manual Voice Refinement [MVP]

### Story 6.1: TipTap Editor Integration

As a freelancer,
I want to edit generated proposals in a rich text editor,
So that I can refine formatting and content easily.

**Acceptance Criteria:**

**Given** a proposal has been generated
**When** I view the proposal
**Then** I see a TipTap rich text editor with toolbar:

- Bold, Italic
- Bullet list, Numbered list
- Clear formatting
- Undo/Redo

**And** I can edit the proposal text
**And** changes are auto-saved every 2 seconds
**And** editor loads in <100ms (NFR-4)

**Technical Notes:**

- AR-9: TipTap 3.x (ProseMirror-based)
- FR-8: rich text editor
- Auto-save to proposals table (updated_at timestamp)

---

### Story 6.2: Manual Voice Parameter Adjustments

As a freelancer,
I want to manually adjust voice settings,
So that future proposals better match my style.

**Acceptance Criteria:**

**Given** I'm in Settings → Voice
**When** I view voice settings
**Then** I see sliders for:

- Tone: Formal ←→ Casual (1-10 scale)
- Length: Brief ←→ Detailed (1-10 scale)
- Technical Depth: Simple ←→ Expert (1-10 scale)

**And** adjusting a slider immediately saves
**And** I see: "Changes will affect future proposals"
**And** current values are shown (e.g., Tone: 7/10 Professional)

**Technical Notes:**

- FR-10: voice weight updates (manual only in MVP)
- AR-22: MVP = few-shot prompting, NO automated learning
- Simplified from original FR-9/FR-10 scope per Round 3

---

### Story 6.3: Proposal Revision History

As a freelancer,
I want to see previous versions of a proposal,
So that I can revert if I make a mistake.

**Acceptance Criteria:**

**Given** I have edited a proposal multiple times
**When** I click "View History"
**Then** I see a list of revisions with timestamps
**And** I can preview each revision
**And** I can click "Restore this version"
**And** restoration creates a new revision (doesn't delete history)

**Technical Notes:**

- New table: proposal_revisions (proposal_id, content, created_at)
- Immutable log (never delete revisions)
- Each auto-save creates a revision

---

### Story 6.4: Character and Word Count

As a freelancer,
I want to see character and word counts as I edit,
So that I can match Upwork's proposal length guidelines.

**Acceptance Criteria:**

**Given** I'm editing a proposal
**When** I type or delete text
**Then** I see real-time counts in status bar:

- "342 characters"
- "67 words"

**And** if <200 words, shows warning: "Upwork recommends 200-500 words"
**And** if >600 words, shows warning: "Long proposals may not be fully read"

**Technical Notes:**

- Real-time calculation (no debounce needed for counts)
- Based on Upwork best practices

---

### Story 6.5: Formatting Shortcuts

As a freelancer,
I want keyboard shortcuts for common formatting,
So that I can edit quickly.

**Acceptance Criteria:**

**Given** I'm editing in TipTap
**When** I use keyboard shortcuts
**Then** the following work:

- Cmd/Ctrl + B: Bold
- Cmd/Ctrl + I: Italic
- Cmd/Ctrl + Z: Undo
- Cmd/Ctrl + Shift + Z: Redo

**And** shortcuts are shown in toolbar tooltips

**Technical Notes:**

- Standard rich text shortcuts
- ProseMirror handles keybindings natively

---

### Story 6.6: Copy Edited Proposal

As a freelancer,
I want to copy my edited proposal to clipboard,
So that I can paste it into Upwork.

**Acceptance Criteria:**

**Given** I've edited a proposal
**When** I click "Copy to Clipboard"
**Then** the current (edited) version is copied
**And** formatting is converted to plain text
**And** I see "Copied! ✓"
**And** safety check still runs (Epic 3 pre-flight)

**Technical Notes:**

- Strip HTML formatting, keep only text
- Newlines preserved for paragraphs
- Safety check applies to final edited version

---

### Story 6.7: Archive Old Revisions

As a developer,
I want old revisions automatically archived,
So that the database doesn't grow unbounded.

**Acceptance Criteria:**

**Given** a proposal has >5 revisions (from Round 5 Occam's Razor: limit to 5)
**When** a new revision is created
**Then** the system:

1. Keeps the 5 most recent revisions
2. Archives older revisions to compressed JSON blob
3. User can still access archived revisions (read-only)

**And** active revisions table stays performant
**And** archiving happens in background (doesn't block save)

**Technical Notes:**

- From Round 5 Code Review: prevent 1000+ revision bloat
- Archiving after 5 revisions per Occam's Razor simplification
- Compressed storage for historical data

---

### Story 6.8: Delete Proposal & All Revisions

As a freelancer,
I want to permanently delete a proposal and all its revisions,
So that I can remove content I no longer want.

**Acceptance Criteria:**

**Given** I'm viewing a proposal
**When** I click "Delete Proposal"
**Then** I see confirmation dialog:

- "⚠️ This will permanently delete the proposal and all revisions."
- "This cannot be undone."
- Buttons: "Cancel" | "Delete Permanently"

**And** if confirmed, proposal and all revisions are hard-deleted from database
**And** I see: "Proposal deleted."

**Technical Notes:**

- From Round 5 Security Audit: right to deletion (GDPR-like)
- CASCADE delete on proposal_revisions
- Atomic transaction (all or nothing)

---

## Epic 8: Essential UX & Accessibility [MVP]

### Story 8.1: Dark Theme System

As a freelancer,
I want a polished dark theme with proper contrast,
So that I can work comfortably at night.

**Acceptance Criteria:**

**Given** the app opens
**When** I view any screen
**Then** I see a complete dark theme with:

- Background: #1a1a1a (dark gray, not pure black)
- Text: #e0e0e0 (light gray)
- Primary accent: #3b82f6 (blue)
- Success: #10b981 (green)
- Warning: #f59e0b (yellow)
- Error: #ef4444 (red)

**And** all colors meet WCAG AA contrast ratio (4.5:1 minimum)
**And** no bright white flashes anywhere

**Technical Notes:**

- Builds on Story 1.5 basic CSS
- CSS custom properties for theme system
- Full design system per UX-1
- Light mode toggle deferred to v1.1

---

### Story 8.2: Complete Keyboard Navigation

As a freelancer (keyboard power user),
I want to navigate the entire app with keyboard only,
So that I never have to use my mouse.

**Acceptance Criteria:**

**Given** I'm using the app with keyboard only
**When** I press Tab repeatedly
**Then** focus moves through all interactive elements in logical order:

1. Job input field
2. "Analyze Job" button
3. Results (if present)
4. "Generate Proposal" button
5. Editor (if present)
6. "Copy" button

**And** focus indicators are clearly visible (2px blue outline)
**And** Shift+Tab moves focus backwards
**And** Enter activates focused button
**And** Escape closes dialogs/modals

**Technical Notes:**

- Builds on Story 3.9 core shortcuts
- Full keyboard navigation (not just shortcuts)
- NFR-20: WCAG AA compliance
- Focus trap in modals (Esc to close, Tab stays within modal)

---

### Story 8.3: Screen Reader Support

As a visually impaired freelancer,
I want the app to work with screen readers,
So that I can use it independently.

**Acceptance Criteria:**

**Given** I'm using a screen reader (VoiceOver, NVDA, JAWS)
**When** I navigate the app
**Then** all elements are announced correctly:

- Buttons announce their label and state
- Form fields announce label + type + value
- Status updates are announced via aria-live regions
- Headings create logical structure

**And** images have alt text
**And** loading states are announced
**And** error messages are associated with fields

**Technical Notes:**

- NFR-20: WCAG AA screen reader support
- ARIA labels on all interactive elements
- Semantic HTML (h1-h6, nav, main, article)
- Test with macOS VoiceOver and Windows NVDA

---

### Story 8.4: Pipeline Stage Indicators During Generation

As a freelancer,
I want to see what stage of generation is happening,
So that I understand the process and know it's working.

**Acceptance Criteria:**

**Given** I've clicked "Generate Proposal"
**When** generation is in progress
**Then** I see stage indicators:

1. "Analyzing job..." (0-1s) ⏳
2. "Selecting hook approach..." (1-2s) ⏳
3. "Loading your voice profile..." (2-3s) ⏳
4. "Generating proposal..." (3-7s) ⏳
5. "Running safety check..." (7-8s) ⏳
6. "Complete! ✓" (8s)

**And** current stage is highlighted
**And** completed stages show ✓
**And** total time <8s (NFR-6)

**Technical Notes:**

- UX-4: pipeline stage indicators
- Real-time updates via Tauri events
- Builds confidence and shows progress

---

### Story 8.5: Onboarding Flow → MOVED TO EPIC 1 AS STORY 1.15

**Round 6 Resequencing (Shark Tank):** This story was moved from Epic 8 to Epic 1 as Story 1.15. First-launch experience is infrastructure, not polish. Required for beta testing after Epic 3. See Story 1.15 in Epic 1 for full details.

---

### Story 8.6: Expectation Management: Voice Learning Timeline

As a new user,
I want to know how long it takes for the app to learn my voice,
So that I have realistic expectations.

**Acceptance Criteria:**

**Given** I'm in the onboarding flow or voice calibration
**When** I see voice learning information
**Then** I see clear messaging:

"**How Voice Learning Works:**

- First proposal: Uses your Quick Calibration or Golden Set
- After 3-5 proposals: System learns your editing patterns
- After 10+ proposals: Highly personalized to your style

Takes 3-5 uses to learn your voice."

**And** progress indicator shows: "Proposals edited: 2/5 (learning in progress)"

**Technical Notes:**

- UX-7: "Takes 3-5 uses to learn your voice"
- Manages expectations (not instant perfection)
- Shows progress toward calibration goal

---

### Story 8.7: Memory Optimization for Large Proposal Lists

As a freelancer with 100+ proposals,
I want the app to remain fast and responsive,
So that I can access my history quickly.

**Acceptance Criteria:**

**Given** I have 100+ proposals in my database
**When** I view the proposal history list
**Then** the system uses virtualization (only render visible rows)
**And** scrolling is smooth (60fps)
**And** memory usage stays <300MB (NFR-2)
**And** query returns in <500ms (NFR-17)

**Technical Notes:**

- NFR-2: RAM target <300MB
- Virtual scrolling (react-window or similar)
- Lazy loading (load 50 at a time)
- Database indexed on created_at for fast queries

---

### Story 8.8: Logging Infrastructure → MOVED TO EPIC 1 AS STORY 1.16

**Round 6 Resequencing (Lessons Learned):** This story was moved from Epic 8 to Epic 1 as Story 1.16. Logging is infrastructure, not polish. Required for debugging beta test issues starting after Epic 3. See Story 1.16 in Epic 1 for full details.

---

### Story 8.9: Comprehensive E2E Test Suite

As a developer,
I want end-to-end tests covering full user journeys,
So that we can ship with confidence.

**Acceptance Criteria:**

**Given** the test suite is configured
**When** tests run
**Then** the following user journeys are covered:

**Journey 1: First-Time User**

1. Open app → onboarding
2. Enter API key
3. Quick Calibration (5 questions)
4. Paste job → analyze → generate → copy

**Journey 2: Returning User**

1. Open app → enter passphrase
2. View past proposals
3. Paste job → analyze → generate → edit → copy

**Journey 3: Golden Set Calibration**

1. Upload 3 proposals
2. Calibrate voice
3. Generate proposal → verify voice match

**Journey 4: Safety Override**

1. Generate proposal that fails safety
2. View warning
3. Override → copy

**And** tests pass on both macOS and Windows
**And** tests verify performance targets (startup <2s, generation <8s)
**And** tests verify accessibility (keyboard nav, screen reader)

**Technical Notes:**

- From Round 2: testing strategy
- **Round 6 Effort Estimate (Shark Tank):** 24-32 hours for complete E2E suite (setup, authoring 4 journeys, cross-platform debugging, CI integration), not 8-16 hours
- Tauri + Playwright or similar E2E framework
- Cross-platform CI testing on macOS and Windows
- Tests must be deterministic (no flakiness) to ship with confidence

---

### Story 8.10: Performance Validation Tests

As a developer,
I want automated tests for performance targets,
So that we don't regress on NFRs.

**Acceptance Criteria:**

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

**Technical Notes:**

- Automated performance regression detection
- Run in CI on every PR
- Alerts if performance degrades

---

### Story 8.11: Accessibility Audit

As a product team,
I want a comprehensive accessibility audit,
So that we meet WCAG AA compliance.

**Acceptance Criteria:**

**Given** the app is feature-complete
**When** accessibility audit is performed
**Then** the following are validated:

- ✅ Color contrast meets 4.5:1 minimum (WCAG AA)
- ✅ All interactive elements keyboard accessible
- ✅ Focus indicators visible (2px minimum)
- ✅ Screen reader announces all content correctly
- ✅ Forms have associated labels
- ✅ Error messages use aria-live
- ✅ Semantic HTML structure (headings, landmarks)
- ✅ No keyboard traps

**And** audit uses axe-core or similar tool
**And** any issues found are documented as bugs

**Technical Notes:**

- NFR-20: WCAG AA compliance
- Automated audit + manual testing
- Test with real screen readers (VoiceOver, NVDA)

---

### Story 8.12: Milestone Celebrations for Voice Learning [DEFERRED TO v1.1]

**DEFERRED:** From Round 5 Code Review Gauntlet - celebrations are nice-to-have, not MVP-critical. Users care about proposal quality and response rates, not toast notifications. Deferred to v1.1 after core value validated.

**Original Story (for v1.1):**
As a freelancer, I want to see progress milestones as the app learns my voice, so that I feel engaged and see improvement.

---

### Story 8.13: Network Allowlist Enforcement

As a security-conscious user,
I want the app to block all network connections except approved APIs,
So that my data cannot be exfiltrated by malicious code.

**Acceptance Criteria:**

**Given** the app is running
**When** any component attempts network connection
**Then** the system:

1. Checks against allowlist: [api.anthropic.com]
2. Blocks all other domains with error log
3. Shows notification if blocked: "Blocked network request to unauthorized domain"

**And** allowlist is configured via Tauri CSP (AR-14)
**And** Rust backend also checks domains (dual enforcement per AR-14)

**Technical Notes:**

- From Round 5 Security Audit: AR-14 mentioned but no story implemented it
- NFR-9: block ALL traffic except allowlisted domains
- Dual enforcement: CSP + Rust-side check

---

### Story 8.14: Disable Telemetry & Analytics

As a privacy-conscious user,
I want zero telemetry or usage tracking,
So that my proposal writing activity remains private.

**Acceptance Criteria:**

**Given** the app is configured
**When** I check telemetry settings
**Then** all analytics are disabled:

- No crash reporting (unless explicitly opt-in)
- No usage metrics sent
- No error reporting to external services
- No update check sends user data

**And** Settings shows: "✓ Zero Telemetry: No data sent without your permission"
**And** opt-in is available for crash reports only (explicit checkbox)

**Technical Notes:**

- From Round 5 Security Audit: NFR-8 zero telemetry default
- Tauri may enable telemetry by default - explicitly disable
- Opt-in crash reports acceptable, but default OFF

---

**END OF STORY GENERATION**

**Stories Generated (After Round 6 Validation):**

- Epic 0: 5 stories (no change)
- Epic 1: 16 stories (+2 moved from Epic 8: onboarding flow, logging infrastructure)
- Epic 2: 9 stories (no change)
- Epic 3: 9 stories (no change)
- Epic 4a: 9 stories (no change)
- Epic 4b: 10 stories (no change)
- Epic 5: 9 stories (no change)
- Epic 6: 8 stories (no change)
- Epic 8: 12 stories (-2 moved to Epic 1: onboarding flow, logging infrastructure)

**Total: 87 stories (unchanged from Round 5, but redistributed: Epic 1 +2, Epic 8 -2)**

**Round 5 Validation Summary:**

- **Code Review Gauntlet:** Found over-engineering (migrations debate), identified missing stories (archive revisions), deferred nice-to-haves (celebrations)
- **Thread of Thought:** Found missing links (voice profile storage, job context loading)
- **Security Audit:** HIGH severity issues addressed (prompt injection, API key in plaintext warning, passphrase strength, network allowlist, telemetry)
- **Chaos Monkey:** Added resilience stories (API errors, crash recovery, disk full, token limits, Windows Defender)
- **Occam's Razor:** Simplified over-engineered stories (client quality, voice analysis, logging, E2E tests)

**Key Additions:**

1. Story 1.13: API Error Handling
2. Story 1.14: Draft Recovery on Crash (NFR-11)
3. Story 2.1: Passphrase min 8→12 chars
4. Story 2.9: Passphrase Recovery Options
5. Story 4a.9: Sanitize Job Input (prompt injection defense)
6. Story 5.5b: Persist Voice Profile to Database
7. Story 6.7: Archive Old Revisions
8. Story 6.8: Delete Proposal & All Revisions
9. Story 8.13: Network Allowlist Enforcement (AR-14, NFR-9)
10. Story 8.14: Disable Telemetry (NFR-8)
11. Story 8.12: DEFERRED TO v1.1 (celebrations)

---

**Round 6 Final Validation Summary:**

- **Shark Tank Pitch:** Exposed timeline optimism (87 stories in 10-12 weeks unrealistic with 2 devs), Epic 4b deferral breaks FR-4 promise, Epic 8 sequencing wrong (onboarding should be Epic 1), underestimated story sizing (E2E tests = 24-32 hours not 8-16). Forced realism: 12-14 weeks for Polished MVP, Epic 4a+4b must ship together OR cut Epic 4 entirely.
- **Performance Profiler Panel:** Found performance bottlenecks: Story 1.4 loads full generated_text (needs query optimization + index), Story 2.3 atomic transaction unclear (ATTACH DATABASE method), Story 0.3 streaming causes 20 re-renders/sec (batch tokens), Story 5.4 no performance target (<2s added), Story 4b.7 RSS blocks UI 100s (background processing), Story 4b.9 needs index on overall_score.
- **Lessons Learned Extraction:** Validated what worked (Epic 1/2 split, distributed NFRs, Hindsight predictions, Security Audit), what didn't (Epic 0 might be throwaway, Epic 4 split confusing, Epic 8 too late, no cost/benefit), surprises (11 security stories, accessibility is 15-20% effort), lessons (onboarding/logging are infrastructure not polish, beta gate critical, Epic 4a alone is weak).
- **Rubber Duck Debugging Evolved:** Found implementation gaps: Story 2.3 atomic transaction (SQLite doesn't span databases - ATTACH needed), Story 2.1 password warning too weak (permanent data loss emphasized), Story 4a.9 truncation cuts mid-sentence (preserve boundaries + XML escaping), Story 5.8 parallel loading not clear in AC.
- **Reasoning via Planning:** Reverse-engineered optimal paths, identified Three Launch Tiers: (1) Minimal MVP 6-7 weeks (Epic 0-3, 5, basic 8), (2) Full MVP 10-11 weeks (add Epic 4 + 6), (3) Polished MVP 12-14 weeks (add full Epic 8). Clarified Epic 4 optional for Minimal but REQUIRED for Full MVP (fulfills FR-4).

**Key Refinements from Round 6:**

1. **Timeline Adjusted:** 12-14 weeks for Polished MVP (was 10-12), accounting for Round 5 scope growth and realistic story sizing
2. **Three Launch Tiers:** Strategic flexibility - Minimal (6-7w) vs Full (10-11w) vs Polished (12-14w) based on market pressure
3. **Epic Resequencing:** Moved Story 8.5 (Onboarding) → Story 1.15, Story 8.8 (Logging) → Story 1.16 (cannot ship beta without first-launch experience)
4. **Epic 4 Decision:** Epic 4a+4b MUST ship together OR cut Epic 4 entirely from MVP (deferring Epic 4b breaks FR-4 promise)
5. **Story Sizing:** 8-hour (schema, basic UI), 16-hour (migration, scoring), 24-32 hour (E2E tests, accessibility audit, encryption spike)
6. **Performance Targets:** Story 1.4 (query optimization), Story 5.4 (calibration <2s), Story 4b.7 (background processing), Story 4b.9 (index)
7. **Implementation Details:** Story 2.3 (ATTACH DATABASE method), Story 2.1 (stronger warning), Story 4a.9 (sentence boundaries + XML escape), Story 5.8 (parallel loading), Story 0.3 (token batching)
8. **Parallel Strategy:** Epic 4/5/6 in parallel with 3-person team after Epic 3 beta test (saves 2-3 weeks)
