# Development Guide

> Generated: 2026-02-19 | Upwork Research Agent v0.1.1

## Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| **Node.js** | v20+ | LTS recommended |
| **npm** | v10+ | Comes with Node.js |
| **Rust** | stable (2021 edition) | Install via [rustup](https://rustup.rs/) |
| **Tauri CLI** | v2 | Installed as devDependency |
| **VS Code** | Latest | Recommended IDE |

### Required VS Code Extensions

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) - Tauri development support
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) - Rust language server

### Platform-Specific Requirements

**Windows:**
- Visual Studio Build Tools (C++ workload)
- WebView2 runtime (usually pre-installed on Windows 11)
- vcpkg with OpenSSL (for CI builds)

**macOS:**
- Xcode Command Line Tools (`xcode-select --install`)
- Minimum macOS 12.0 (Monterey) for builds

## Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd "Upwork Researcher"

# Install frontend dependencies
cd upwork-researcher
npm install

# Verify Rust toolchain
rustup update stable
cd src-tauri && cargo check
```

The `npm install` command also configures Git hooks via Husky (`prepare` script sets `core.hooksPath` to `.husky/`).

## Running the Application

### Development Mode (Hot Reload)

```bash
cd upwork-researcher
npm run tauri dev
```

This starts:
1. Vite dev server on port 1420 (frontend)
2. Tauri development build with Rust backend
3. Opens the app window with hot-reload enabled

### Production Build

```bash
cd upwork-researcher
npm run tauri build
```

Outputs platform-specific installers to `src-tauri/target/release/bundle/`.

For unsigned development builds:
```bash
npm run tauri build -- --no-sign
```

## Available Commands

### Frontend

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | ESLint check (no auto-fix) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run lint:types` | TypeScript type check (`tsc --noEmit`) |
| `npm run format:check` | Prettier formatting check |
| `npm run format:fix` | Prettier auto-format |

### Testing

| Command | Purpose |
|---------|---------|
| `npm run test` | Run Vitest (single pass, 1824 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:perf` | Performance benchmarks |
| `npm run test:perf:report` | Generate performance report |
| `npm run test:e2e` | Playwright E2E tests (requires built app) |
| `npm run test:e2e:ui` | Playwright with interactive UI |
| `npm run test:e2e:debug` | Playwright in debug mode |

### Rust Backend

```bash
cd upwork-researcher/src-tauri

cargo test --lib          # Unit tests (822+ tests)
cargo fmt --check         # Format check
cargo clippy              # Lint check
cargo build               # Debug build
cargo build --release     # Release build
```

### Versioning

| Command | Purpose |
|---------|---------|
| `npm run version:bump` | Auto-bump version + generate CHANGELOG + create git tag |
| `npm run version:bump:minor` | Force minor version bump |
| `npm run version:bump:major` | Force major version bump |
| `npm run version:bump:dry` | Preview version bump (no changes) |
| `npm run changelog` | Generate CHANGELOG without bumping version |

## Testing Strategy

### Unit Tests (Vitest)

- **Location:** Co-located `*.test.tsx` / `*.test.ts` files next to source
- **Framework:** Vitest 4.0.18 + React Testing Library + jsdom
- **Count:** 1824 tests across 135 files
- **Config:** `vite.config.ts` (test section)
- **Setup:** `src/test/setup.ts` (global test configuration)

Key patterns:
- Use `vi.useFakeTimers({ shouldAdvanceTime: true })` with `waitFor` to prevent timeouts
- Always mock `get_setting("onboarding_completed")` → `"true"` in Tauri invoke mocks
- Wrap components using React Query in `QueryClientProvider`
- E2E Playwright specs in `tests/e2e/` are excluded from Vitest

### Rust Tests

- **Location:** Inline `#[cfg(test)]` modules + `src-tauri/tests/`
- **Framework:** Built-in Rust test framework
- **Count:** 822+ tests
- **Windows note:** `build.rs` embeds comctl32 v6 manifest for test binaries (required for Tauri's `TaskDialogIndirect`)

### E2E Tests (Playwright)

- **Location:** `tests/e2e/`
- **Framework:** Playwright 1.58.2 with axe-core for accessibility
- **Requires:** Built Tauri application (`npm run tauri build`)
- **Config:** `playwright.config.ts`
- **Structure:** Page objects in `pages/`, journey tests in `journeys/`, a11y tests in `accessibility/`

### Performance Tests

- **Location:** `tests/performance/`
- **Config:** `vitest.perf.config.ts`
- **Baseline:** `tests/performance/baseline.json` (10% regression tolerance)
- **CI:** Results posted as PR comments via GitHub Actions

## Code Quality

### Git Hooks (Husky)

**pre-commit:**
1. `lint-staged` — ESLint + Prettier on staged TS/TSX/JSON/CSS/MD files
2. `verify-command-registration.mjs` — Ensures all `#[tauri::command]` functions are registered in the Tauri invoke handler
3. `cargo fmt --check` — Blocks commit if Rust code is unformatted
4. `cargo clippy` — Rust linting (warnings only, not blocking yet)

**commit-msg:**
- Validates conventional commit format via commitlint
- Required format: `type(scope): subject`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### ESLint Configuration

- ESLint 9 flat config with `typescript-eslint` strict preset
- `no-console: warn` — No console.log in production code
- `@typescript-eslint/no-explicit-any: warn` — Prefer proper types
- `import-x/order: warn` — Enforce import grouping and alphabetical order
- `react/forbid-component-props` — No inline `style` except on Recharts components
- `react-hooks/rules-of-hooks: error` — Must follow hooks rules (runtime crash prevention)
- Test files (`*.test.*`, `**/tests/**`) have relaxed rules (any allowed, console allowed)

### TypeScript Configuration

- `strict: true` — All strict checks enabled
- `noUnusedLocals: true` + `noUnusedParameters: true`
- `ES2020` target, `bundler` module resolution
- Path alias: `@/*` → `./src/*`

## Architecture Overview

### IPC Communication

Frontend communicates with Rust backend via Tauri's `invoke()` function:

```typescript
// Frontend: Call Rust command
const result = await invoke("analyze_job", { jobContent: text });

// Backend: Command handler
#[tauri::command]
async fn analyze_job(job_content: String, db: State<Database>) -> Result<JobAnalysis, String> {
    // ... implementation
}
```

~80+ IPC commands are registered in `src-tauri/src/lib.rs` via `.invoke_handler(tauri::generate_handler![...])`.

### State Management

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Global app state | Zustand (3 stores) | Generation lifecycle, settings, onboarding |
| Server/cached state | React Query (12 hooks) | Proposals, jobs, analytics with auto-caching |
| Domain logic | Custom hooks (16) | Tauri events, safety, editor, updates |
| Accessibility | React Context (1) | Screen reader announcements |

### Database

- **Engine:** SQLCipher (AES-256 encrypted SQLite)
- **Tables:** 15 tables across 30 migrations (V1-V30)
- **Migration framework:** Refinery (Rust)
- **Mode:** WAL (Write-Ahead Logging) for concurrent access
- **Key derivation:** Argon2id with 12-char minimum passphrase

## Environment Variables

### Development (Local)

No environment variables required for local development. The app uses OS keychain for API key storage.

### CI/CD (GitHub Actions)

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Update signature signing | Release builds |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing key password | Release builds |
| `GITHUB_TOKEN` | Release creation | Release builds |
| `APPLE_CERTIFICATE` | Base64 .p12 cert | macOS signing |
| `APPLE_CERTIFICATE_PASSWORD` | Cert export password | macOS signing |
| `APPLE_SIGNING_IDENTITY` | Developer ID identity | macOS signing |
| `APPLE_ID` | Apple Developer email | macOS notarization |
| `APPLE_PASSWORD` | App-specific password | macOS notarization |
| `APPLE_TEAM_ID` | 10-char team ID | macOS notarization |
| `KEYCHAIN_PASSWORD` | Temp CI keychain | macOS signing |
| `WINDOWS_CERTIFICATE` | Base64 PFX cert | Windows signing |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password | Windows signing |

## Release Process

1. Ensure working directory is clean
2. Run `npm run version:bump` (auto-detects patch/minor from commits)
3. Push tag: `git push origin v<version>`
4. GitHub Actions builds for macOS (ARM64 + Intel) and Windows (x64)
5. Draft release created — review and publish manually
6. App auto-updater checks `latest.json` from GitHub releases

For critical security updates, add `[CRITICAL]` to the tag name. See `CONVENTIONS.md` for details.

## BMAD Framework

The repository also contains the BMAD framework (`_bmad/`) used for project planning:

| Command | Purpose |
|---------|---------|
| `/bmad-agent-bmm-dev` | Developer agent (story execution) |
| `/bmad-agent-bmm-pm` | Product Manager (planning) |
| `/bmad-agent-bmm-architect` | Architect (design decisions) |
| `/bmad-bmm-dev-story` | Execute a story |
| `/bmad-bmm-code-review` | Adversarial code review |
| `/bmad-bmm-sprint-status` | Sprint status overview |

Planning artifacts are in `_bmad-output/planning-artifacts/` (PRD, architecture, epics, UX spec).
Implementation stories are in `_bmad-output/implementation-artifacts/` (87 stories across 14 epics, all complete).
