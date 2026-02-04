---
status: done
assignedTo: "dev-agent"
tasksCompleted: 5
totalTasks: 5
testsWritten: true
fileList:
  - upwork-researcher/src-tauri/src/config.rs
  - upwork-researcher/src-tauri/src/claude.rs
  - upwork-researcher/src-tauri/src/lib.rs
  - upwork-researcher/src/components/ApiKeySetup.tsx
  - upwork-researcher/src/components/ApiKeySetup.test.tsx
  - upwork-researcher/src/components/Navigation.tsx
  - upwork-researcher/src/components/Navigation.test.tsx
  - upwork-researcher/src/App.tsx
  - upwork-researcher/src/App.css
  - upwork-researcher/src/App.test.tsx
  - upwork-researcher/src/test/setup.ts
---

# Story 1.7: API Key Configuration UI

## Story

As a freelancer,
I want to enter my Anthropic API key in the app,
So that I can use my own account for proposal generation.

## Acceptance Criteria

**AC-1:** Given the app starts for the first time (no API key configured), When I see the setup screen, Then I can enter my Anthropic API key in a text field.

**AC-2:** Given I enter an API key, When I save it, Then the key is saved to a plaintext config file (will move to keychain in Epic 2).

**AC-3:** Given I enter an API key, When validating, Then I see validation that the key format is correct (starts with "sk-ant-").

**AC-4:** Given an API key is saved, When I restart the app, Then it uses the saved key.

## Technical Notes

### Architecture Requirements

From epics-stories.md:
- Simple config file for now
- Warning: "Your API key will be encrypted in a future update"
- Basic format validation only (starts with "sk-ant-")

### Implementation Approach

1. Create Rust config module to read/write JSON config file
2. Add Tauri commands: `get_api_key`, `set_api_key`, `has_api_key`
3. Update claude.rs to use config file if env var not set
4. Create frontend Settings view with API key input
5. Show setup prompt if no API key configured

### Config File Location

Use Tauri's app data directory:
- macOS: `~/Library/Application Support/com.upwork-research-agent/config.json`
- Windows: `%APPDATA%\com.upwork-research-agent\config.json`

### Config File Format

```json
{
  "api_key": "sk-ant-..."
}
```

### File Structure

```
upwork-researcher/
├── src-tauri/
│   ├── src/
│   │   ├── config.rs           # NEW: Config file management
│   │   ├── claude.rs           # Update to use config
│   │   ├── lib.rs              # Add config commands
├── src/
│   ├── components/
│   │   ├── ApiKeySetup.tsx     # NEW: API key input form
│   │   ├── Settings.tsx        # NEW: Settings panel (optional)
│   ├── App.tsx                 # Check for API key on startup
```

## Tasks/Subtasks

- [x] Task 1: Create Rust config module (AC: 2, 4)
  - [x] Subtask 1.1: Create `config.rs` with Config struct
  - [x] Subtask 1.2: Implement `load_config` and `save_config` functions
  - [x] Subtask 1.3: Add config state to Tauri app

- [x] Task 2: Add Tauri commands (AC: 1, 2, 3)
  - [x] Subtask 2.1: Add `has_api_key` command
  - [x] Subtask 2.2: Add `set_api_key` command with format validation
  - [x] Subtask 2.3: Add `get_api_key_masked` command (show last 4 chars only)

- [x] Task 3: Update claude.rs to use config (AC: 4)
  - [x] Subtask 3.1: Read API key from config if env var not set
  - [x] Subtask 3.2: Return clear error if no key configured

- [x] Task 4: Create API key setup UI (AC: 1, 3)
  - [x] Subtask 4.1: Create ApiKeySetup.tsx component
  - [x] Subtask 4.2: Add format validation feedback
  - [x] Subtask 4.3: Add warning about future encryption
  - [x] Subtask 4.4: Update App.tsx to check for API key on startup

- [x] Task 5: Write tests (AC: all)
  - [x] Subtask 5.1: Test config load/save in Rust
  - [x] Subtask 5.2: Test format validation
  - [x] Subtask 5.3: Test ApiKeySetup component

## Dev Notes

### NFR Targets

| NFR | Target | Validation Method |
|:----|:-------|:------------------|
| Security | Plaintext for now, keychain in Epic 2 | Note in UI |

### Scope Boundaries

**In scope:**
- API key entry and storage in config file
- Format validation (sk-ant- prefix)
- Setup screen on first run

**Out of scope:**
- Encrypted storage (Epic 2)
- API key rotation
- Multiple API keys

## References

- [Source: epics-stories.md#Story 1.7: API Key Configuration UI]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log
- Created config.rs with ConfigState struct for managing JSON config file
- Added validate_api_key_format() and mask_api_key() utility functions
- Added 10 unit tests for config module
- Added 5 Tauri commands: has_api_key, set_api_key, get_api_key_masked, validate_api_key, clear_api_key
- Updated claude.rs with resolve_api_key() function to check config before env var
- Added generate_proposal_with_key and generate_proposal_streaming_with_key variants
- Created ApiKeySetup.tsx component with format validation and warnings
- Added Settings tab to Navigation component
- Updated App.tsx to check for API key on startup and show setup if needed
- Added 13 tests for ApiKeySetup component
- Updated App.test.tsx to handle async API key check

### Completion Notes
- 24 Rust tests passing (10 new for config module)
- 106 frontend tests passing (21 new tests)
- Frontend build passes
- Setup screen appears on first run when no API key is configured
- Format validation enforces sk-ant- prefix and minimum length
- API key stored in JSON file in app data directory
- Settings tab allows updating API key after initial setup
- Warning displayed about future encrypted storage

### Implementation Summary
**Rust Backend:**
- `config.rs`: NEW - Config struct, ConfigState with load/save, validation and masking utilities
- `claude.rs`: Updated to accept API key parameter, falls back to env var
- `lib.rs`: Added 5 new Tauri commands for API key management

**Frontend:**
- `ApiKeySetup.tsx`: NEW - Setup/update form with validation
- `Navigation.tsx`: Added Settings tab
- `App.tsx`: Checks for API key on startup, shows setup screen if missing
- `App.css`: Added styles for API key setup (dark and light mode)

## File List
- `upwork-researcher/src-tauri/src/config.rs` — NEW: Config module
- `upwork-researcher/src-tauri/src/claude.rs` — API key resolution
- `upwork-researcher/src-tauri/src/lib.rs` — API key commands
- `upwork-researcher/src/components/ApiKeySetup.tsx` — NEW: Setup form
- `upwork-researcher/src/components/ApiKeySetup.test.tsx` — NEW: 13 tests
- `upwork-researcher/src/components/Navigation.tsx` — Settings tab
- `upwork-researcher/src/components/Navigation.test.tsx` — Updated tests
- `upwork-researcher/src/App.tsx` — API key check on startup
- `upwork-researcher/src/App.css` — Setup form styles
- `upwork-researcher/src/App.test.tsx` — Async wait for API key
- `upwork-researcher/src/test/setup.ts` — API key mocks

## Change Log
- 2026-02-04: Story created
- 2026-02-04: Implementation complete — API key config UI with validation, 24 Rust + 106 frontend tests
