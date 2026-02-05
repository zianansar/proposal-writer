---
status: ready-for-dev
epic: 2
story: 9
dependencies:
  - 2-1-passphrase-entry-ui
  - 2-3-sqlite-to-sqlcipher-database-migration
relates_to:
  - 2-4-migration-verification-and-user-confirmation
  - 2-5-migration-failure-recovery
---

# Story 2.9: Passphrase Recovery Options

## Story

As a freelancer,
I want a way to recover my data if I forget my passphrase,
So that I don't permanently lose all my proposals.

## Acceptance Criteria

### AC1: Recovery Options Presented During Setup

**Given** I'm setting up encryption for the first time (Story 2.1)
**When** I successfully create and confirm my passphrase
**Then** The system presents recovery options screen with:
- Clear heading: "Protect Your Data - Set Up Recovery"
- Warning text: "If you forget your passphrase AND lose your recovery key, your data CANNOT be recovered"
- Two recovery options (detailed below)
- "Skip Recovery Setup" button with warning icon

**And** The UI blocks navigation forward until user selects an option or explicitly skips

### AC2: Option 1 - Recovery Key Generation

**Given** I'm on the recovery options screen
**When** I select "Generate Recovery Key"
**Then** The system:
- Generates a cryptographically secure 32-character recovery key
- Displays the key in monospace font with copy button
- Shows instructions: "Print or write this down and store it securely offline"
- Provides "Print Recovery Key" button that opens print dialog
- Requires checkbox confirmation: "I have saved my recovery key in a secure location"
- Stores encrypted recovery key in database (encrypted with derived key from passphrase)

**And** The recovery key can be used to decrypt the database if passphrase is forgotten

### AC3: Option 2 - Export Unencrypted Backup

**Given** I'm on the recovery options screen
**When** I select "Export Unencrypted Backup"
**Then** The system:
- Shows file picker dialog to select backup location
- Exports complete database as JSON file (unencrypted)
- Includes metadata: export_date, app_version, backup_type: "pre-encryption"
- Shows success message: "Backup saved to [location]. Store this file securely."
- Warns: "This backup is NOT encrypted. Keep it in a secure location."

**And** The backup can be used to restore data if passphrase is forgotten

### AC4: Skip Recovery Setup

**Given** I'm on the recovery options screen
**When** I click "Skip Recovery Setup"
**Then** A confirmation modal appears:
- Title: "Skip Recovery Setup?"
- Warning: "Without a recovery option, forgotten passphrases CANNOT be recovered. You will lose all your data."
- Two buttons: "Go Back and Set Up Recovery" (primary), "Skip Anyway" (destructive)

**And** If I confirm skip, the system proceeds to next step without recovery configured

### AC5: Recovery Key Storage

**Given** I generated a recovery key
**When** The system stores it
**Then** The recovery key is:
- Encrypted using PBKDF2 with user's passphrase
- Stored in `encryption_metadata` table with field `recovery_key_encrypted`
- Never logged or transmitted
- Only decryptable with the original passphrase

### AC6: Recovery Key Usage

**Given** I forgot my passphrase but have my recovery key
**When** I attempt to open the encrypted database
**Then** The passphrase entry screen shows "Use Recovery Key" link
**And** Clicking it shows recovery key input field (32 chars)
**And** Valid recovery key unlocks the database and prompts for new passphrase
**And** Invalid recovery key shows error: "Invalid recovery key"

## Tasks and Subtasks

### Task 1: Implement Recovery Key Generation
- [ ] 1.1: Create `keychain/recovery.rs` module
  - [ ] Generate 32-char recovery key using `rand::thread_rng()` with alphanumeric charset
  - [ ] Implement `encrypt_recovery_key(key: &str, passphrase: &str) -> Result<String>`
  - [ ] Implement `decrypt_recovery_key(encrypted: &str, passphrase: &str) -> Result<String>`
- [ ] 1.2: Add recovery key storage to database schema
  - [ ] Extend `encryption_metadata` table with `recovery_key_encrypted TEXT` column (nullable)
  - [ ] Add migration for existing encrypted databases
- [ ] 1.3: Create Tauri command `generate_recovery_key`
  - [ ] Input: passphrase (String)
  - [ ] Output: `RecoveryKeyData { key: String, encrypted: String }`
  - [ ] Store encrypted key in database

### Task 2: Build Recovery Options UI Component
- [ ] 2.1: Create `RecoveryOptions.tsx` component
  - [ ] Import from PassphraseEntry after passphrase confirmation
  - [ ] State management: selectedOption (none | recovery-key | backup | skipped)
  - [ ] Render three-column layout with option cards
- [ ] 2.2: Implement "Generate Recovery Key" option
  - [ ] Card with icon, title, description
  - [ ] "Generate Key" button triggers `generate_recovery_key` command
  - [ ] Display generated key in monospace with copy button
  - [ ] "Print Recovery Key" button opens print dialog (window.print())
  - [ ] Checkbox: "I have saved my recovery key"
  - [ ] Disabled "Continue" until checkbox confirmed
- [ ] 2.3: Implement "Export Unencrypted Backup" option
  - [ ] Card with icon, title, warning badge
  - [ ] "Export Backup" button triggers file picker
  - [ ] Call `export_unencrypted_backup` command with selected path
  - [ ] Show success notification with file path
- [ ] 2.4: Implement "Skip Recovery Setup" flow
  - [ ] "Skip" button with warning icon
  - [ ] Confirmation modal with destructive action styling
  - [ ] "Go Back" primary button, "Skip Anyway" destructive button
- [ ] 2.5: Add CSS styling (`RecoveryOptions.css`)
  - [ ] Responsive three-column grid for option cards
  - [ ] Print-optimized styles for recovery key page
  - [ ] Warning/danger color schemes for skip flow

### Task 3: Implement Backup Export Functionality
- [ ] 3.1: Create `backup/export.rs` module
  - [ ] Implement `export_unencrypted_backup(db: &Connection, path: &str) -> Result<()>`
  - [ ] Query all tables: job_posts, proposals, settings, voice_profile
  - [ ] Serialize to JSON with metadata (app_version, export_date)
  - [ ] Write to file with proper error handling
- [ ] 3.2: Create Tauri command `export_unencrypted_backup`
  - [ ] Input: file_path (String)
  - [ ] Validate path writability
  - [ ] Call export function
  - [ ] Return success/error

### Task 4: Implement Recovery Key Usage Flow
- [ ] 4.1: Modify `PassphraseEntry.tsx` to show "Use Recovery Key" option
  - [ ] Add toggle link: "Forgot passphrase? Use recovery key"
  - [ ] Switch input field to 32-char recovery key format
  - [ ] Add input validation (32 alphanumeric chars)
- [ ] 4.2: Create Tauri command `unlock_with_recovery_key`
  - [ ] Input: recovery_key (String)
  - [ ] Decrypt stored recovery key from database
  - [ ] Use recovery key to derive encryption key
  - [ ] Attempt to open database
  - [ ] Return success + prompt for new passphrase, or error
- [ ] 4.3: Implement new passphrase setup after recovery
  - [ ] After successful recovery key unlock, show PassphraseEntry again
  - [ ] Label: "Set New Passphrase"
  - [ ] Update passphrase in keychain
  - [ ] Re-encrypt recovery key with new passphrase

### Task 5: Integration with Migration Flow
- [ ] 5.1: Add recovery options step to migration flow
  - [ ] After Story 2.1 passphrase entry and before Story 2.3 migration
  - [ ] Pass passphrase from 2.1 to recovery options component
- [ ] 5.2: Update `DatabaseMigration.tsx` orchestration
  - [ ] Add recoveryOptionsComplete state
  - [ ] Conditionally render RecoveryOptions component
  - [ ] Block migration until recovery setup or skip confirmed
- [ ] 5.3: Handle pre-migration backup in Story 2.2 context
  - [ ] If user selected "Export Backup" in recovery options, mark Story 2.2 complete
  - [ ] Otherwise, proceed with Story 2.2 automated backup

### Task 6: Testing
- [ ] 6.1: Unit tests for recovery key generation
  - [ ] Test key generation randomness (100 samples, all unique)
  - [ ] Test encryption/decryption round-trip
  - [ ] Test invalid passphrase fails decryption
- [ ] 6.2: Unit tests for backup export
  - [ ] Test JSON structure matches schema
  - [ ] Test metadata fields present
  - [ ] Test all tables exported
- [ ] 6.3: Integration tests for recovery flow
  - [ ] Test full flow: generate key → forget passphrase → recover with key
  - [ ] Test recovery key unlocks database
  - [ ] Test new passphrase setup after recovery
- [ ] 6.4: UI component tests
  - [ ] Test RecoveryOptions renders all options
  - [ ] Test checkbox validation for recovery key
  - [ ] Test skip confirmation modal
  - [ ] Test print dialog triggered

### Task 7: Documentation and Error Handling
- [ ] 7.1: Add recovery documentation to user guide
  - [ ] Document recovery options in setup flow
  - [ ] Best practices for recovery key storage
  - [ ] Recovery procedure steps
- [ ] 7.2: Error handling
  - [ ] Handle recovery key generation failures
  - [ ] Handle backup export file write errors
  - [ ] Handle invalid recovery key gracefully
  - [ ] User-friendly error messages for all failure modes
- [ ] 7.3: Logging (Story 1.16)
  - [ ] Log recovery key generation (not the key itself)
  - [ ] Log backup export path (not contents)
  - [ ] Log recovery key usage attempts
  - [ ] Never log passphrase or recovery key values

## Technical Notes

### Architecture Requirements
- **AR-10**: SQLCipher encryption with PBKDF2 passphrase derivation
- **AR-15**: Comprehensive error handling with user feedback
- **AR-16**: Secure logging (no sensitive data in logs)

### Security Considerations
- **NFR-11**: Recovery key generation uses cryptographically secure RNG
- **NFR-12**: Recovery key encrypted at rest, never stored plaintext
- **NFR-13**: Unencrypted backup export warns user about security implications
- From Round 5 Security Audit: Balance security (no password reset) with usability (recovery option)

### Implementation Details

**Recovery Key Algorithm:**
1. Generate 32-char random string: `[A-Za-z0-9]{32}`
2. Derive encryption key from passphrase using PBKDF2 (SHA-256, 100k iterations)
3. Encrypt recovery key using AES-256-GCM with derived key
4. Store encrypted recovery key in `encryption_metadata` table

**Backup Export Format:**
```json
{
  "metadata": {
    "app_version": "1.0.0",
    "export_date": "2026-02-05T10:30:00Z",
    "backup_type": "pre-encryption"
  },
  "job_posts": [...],
  "proposals": [...],
  "settings": [...],
  "voice_profile": {...}
}
```

**Print Stylesheet:**
- Include CSS media query `@media print` in RecoveryOptions.css
- Show only recovery key and instructions when printing
- Hide application chrome, buttons, navigation

### Dependencies
- **Story 2.1**: Passphrase entry UI provides passphrase to recovery options
- **Story 2.3**: Migration flow integrates recovery options step
- Relates to **Story 2.2**: Pre-migration backup (user export can substitute automated backup)
- Relates to **Story 2.5**: Migration failure recovery (recovery key enables recovery)

### Cross-References
- Recovery key usage integrated with encrypted database access (Story 2.7)
- Recovery flow should be accessible from encryption status indicator (Story 2.8)

### NFR Targets
- **NFR-7**: Recovery key generation completes in <500ms
- **NFR-9**: Backup export completes in <2s for typical database size (<10MB)
- **NFR-11**: Recovery key uses cryptographically secure randomness (CSPRNG)

## Acceptance Criteria Validation Checklist

- [ ] AC1: Recovery options screen displays after passphrase confirmation
- [ ] AC1: Screen blocks forward navigation until option selected or skipped
- [ ] AC2: Recovery key generated is 32 characters, cryptographically random
- [ ] AC2: Recovery key displayed in copyable, printable format
- [ ] AC2: Checkbox confirmation required before continuing
- [ ] AC2: Recovery key stored encrypted in database
- [ ] AC3: Backup export opens file picker
- [ ] AC3: Exported JSON contains all data and metadata
- [ ] AC3: Warning shown about unencrypted nature of backup
- [ ] AC4: Skip button shows destructive confirmation modal
- [ ] AC4: "Go Back" option returns to recovery options screen
- [ ] AC5: Recovery key encrypted with passphrase using PBKDF2
- [ ] AC5: Recovery key never logged or transmitted
- [ ] AC6: "Use Recovery Key" link visible on passphrase entry screen
- [ ] AC6: Valid recovery key unlocks database and prompts new passphrase
- [ ] AC6: Invalid recovery key shows clear error message

## Definition of Done
- [ ] All tasks completed and checked off
- [ ] All acceptance criteria validated
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests for recovery flow passing
- [ ] UI components tested (snapshot + interaction tests)
- [ ] Error handling tested for all failure modes
- [ ] Code review completed (Story 1.11 criteria)
- [ ] Documentation updated (recovery options in user guide)
- [ ] No sensitive data logged (passphrase, recovery key)
- [ ] Print stylesheet tested across browsers
