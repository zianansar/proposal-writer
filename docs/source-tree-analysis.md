# Source Tree Analysis

> Generated: 2026-02-19 | Scan Level: Deep | Project Type: Desktop (Tauri v2)

## Repository Root Structure

```
Upwork Researcher/                        # Repository root
├── .claude/                              # Claude Code settings
├── .github/workflows/                    # CI/CD pipelines (release, e2e)
├── .husky/                               # Git hooks (commit-msg, pre-commit, pre-push)
├── _bmad/                                # BMAD Framework v6.0.0-Beta.4
│   ├── _config/                          #   Agent customization overrides
│   ├── bmm/                              #   Project module (agents, workflows)
│   └── core/                             #   Framework engine (workflow.xml)
├── _bmad-output/                         # Generated planning & implementation artifacts
│   ├── brainstorming/                    #   Ideation session outputs
│   ├── implementation-artifacts/         #   Stories, guides, templates (80+ files)
│   └── planning-artifacts/               #   PRD, architecture, epics, UX spec
├── docs/                                 # Project documentation (this folder)
├── scripts/                              # Build & signing scripts
│   ├── test-version-bump.sh              #   Version bump validation
│   └── windows-sign.ps1                  #   Windows Authenticode signing
├── upwork-researcher/                    # *** APPLICATION ROOT ***
├── AGENTS.md                             # Agent instructions
└── CLAUDE.md                             # Project overview & slash commands
```

## Application Source Tree (`upwork-researcher/`)

### Frontend (React 19 + TypeScript)

```
upwork-researcher/
├── src/                                  # Frontend source root
│   ├── App.tsx                           # ** ENTRY: Main app component (1796 lines)
│   ├── main.tsx                          # ** ENTRY: React DOM mount point
│   ├── vite-env.d.ts                     # Vite type declarations
│   │
│   ├── components/                       # Shared UI components (58 files)
│   │   ├── ui/                           #   Radix-inspired primitives (6)
│   │   │   ├── button.tsx                #     Button variants
│   │   │   ├── card.tsx                  #     Card container
│   │   │   ├── label.tsx                 #     Form label
│   │   │   ├── progress.tsx              #     Progress bar
│   │   │   ├── radio-group.tsx           #     Radio button group
│   │   │   └── skeleton.tsx              #     Loading skeleton
│   │   │
│   │   ├── onboarding/                   #   Onboarding wizard steps (4)
│   │   │   ├── WelcomeStep.tsx           #     Welcome introduction
│   │   │   ├── ApiKeyStep.tsx            #     API key configuration
│   │   │   ├── VoiceCalibrationStep.tsx  #     Voice profile setup
│   │   │   └── ReadyStep.tsx             #     Completion confirmation
│   │   │
│   │   ├── Navigation.tsx                #   Tab-based view switcher (ARIA tablist)
│   │   ├── SkipLink.tsx                  #   Accessibility skip-to-content
│   │   ├── JobInput.tsx                  #   Job post paste input (URL/text detect)
│   │   ├── AnalyzeButton.tsx             #   Trigger job analysis pipeline
│   │   ├── GenerateButton.tsx            #   Trigger proposal generation
│   │   ├── AnalysisProgress.tsx          #   Staged progress indicator
│   │   ├── JobAnalysisPanel.tsx          #   Analysis results display
│   │   ├── ScoringBreakdown.tsx          #   Detailed score visualization
│   │   ├── JobScoreBadge.tsx             #   Overall score badge
│   │   ├── SkillsMatchBadge.tsx          #   Skill match percentage
│   │   ├── ClientQualityBadge.tsx        #   Client quality indicator
│   │   ├── BudgetAlignmentBadge.tsx      #   Budget alignment indicator
│   │   ├── HiddenNeedsDisplay.tsx        #   Extracted hidden needs list
│   │   ├── SkillTags.tsx                 #   Skill tag display
│   │   ├── ProposalOutput.tsx            #   Proposal output container
│   │   ├── ProposalEditor.tsx            #   TipTap rich text editor
│   │   ├── EditorToolbar.tsx             #   Formatting + AI tools
│   │   ├── EditorStatusBar.tsx           #   Word/char count, save status
│   │   ├── CopyButton.tsx               #   Safe copy with AI detection
│   │   ├── ExportButton.tsx              #   Export to JSON
│   │   ├── HookStrategySelector.tsx      #   Strategy picker for generation
│   │   ├── HookStrategyCard.tsx          #   Individual strategy card
│   │   ├── SafetyWarningModal.tsx        #   AI detection warning dialog
│   │   ├── OverrideConfirmDialog.tsx     #   Safety override confirmation
│   │   ├── EncryptionStatusIndicator.tsx #   Encryption status in header
│   │   ├── EncryptionDetailsModal.tsx    #   Encryption details dialog
│   │   ├── PrivacyIndicator.tsx          #   Privacy status display
│   │   ├── PipelineIndicator.tsx         #   Generation pipeline stages
│   │   ├── ThresholdAdjustmentNotification.tsx  # Adaptive learning notice
│   │   ├── AutoUpdateNotification.tsx    #   Update availability notice
│   │   ├── MandatoryUpdateDialog.tsx     #   Critical update enforcement
│   │   ├── ConfigUpdateNotification.tsx  #   Remote config update notice
│   │   ├── OnboardingWizard.tsx          #   Multi-step onboarding flow
│   │   ├── ApiKeySetup.tsx               #   API key form
│   │   ├── SettingsPanel.tsx             #   Main settings view
│   │   ├── UserSkillsConfig.tsx          #   User skills management
│   │   ├── VoiceSettings.tsx             #   Voice profile settings
│   │   ├── RevisionHistoryPanel.tsx      #   Proposal revision history
│   │   ├── DatabaseMigration.tsx         #   SQLite→SQLCipher migration UI
│   │   ├── PreMigrationBackup.tsx        #   Pre-migration backup UI
│   │   ├── MigrationVerification.tsx     #   Post-migration verification
│   │   ├── PassphraseEntry.tsx           #   Initial passphrase setup
│   │   ├── PassphraseUnlock.tsx          #   Database unlock on restart
│   │   ├── RecoveryOptions.tsx           #   Recovery key generation
│   │   ├── DraftRecoveryModal.tsx        #   Unsaved draft recovery
│   │   ├── DeleteConfirmDialog.tsx       #   Deletion confirmation
│   │   ├── RollbackDialog.tsx            #   Update rollback dialog
│   │   ├── RssImportDialog.tsx           #   RSS feed import config
│   │   ├── RssImportProgress.tsx         #   RSS import progress
│   │   ├── HealthCheckModal.tsx          #   Post-update health check
│   │   ├── LiveAnnouncer.tsx             #   ARIA live region (a11y)
│   │   ├── Tooltip.tsx                   #   Reusable tooltip
│   │   ├── HistoryList.tsx               #   [DEPRECATED] Old history list
│   │   └── HistoryItem.tsx               #   [DEPRECATED] Old history card
│   │
│   ├── features/                         # Domain-specific feature modules
│   │   ├── proposal-history/             #   Proposal history & analytics (19 files)
│   │   │   ├── ProposalHistoryList.tsx   #     Virtualized infinite-scroll list
│   │   │   ├── ProposalHistoryCard.tsx   #     Proposal card with outcome
│   │   │   ├── ProposalDetailView.tsx    #     Detailed proposal view
│   │   │   ├── ProposalAnalyticsDashboard.tsx  # Analytics overview
│   │   │   ├── SearchFilterBar.tsx       #     Search + filter controls
│   │   │   ├── OutcomeDropdown.tsx       #     Outcome status selector
│   │   │   ├── OutcomeDistributionChart.tsx  #  Outcomes pie/bar chart
│   │   │   ├── StrategyPerformanceChart.tsx  #  Strategy effectiveness
│   │   │   ├── StrategyEffectivenessTable.tsx # Strategy metrics table
│   │   │   ├── WeeklyActivityChart.tsx   #     Weekly activity chart
│   │   │   ├── DatabaseExportButton.tsx  #     Full DB export
│   │   │   ├── ImportArchiveDialog.tsx   #     Archive import dialog
│   │   │   ├── useProposalHistory.ts     #     Infinite query hook
│   │   │   ├── useProposalDetail.ts      #     Single proposal query
│   │   │   ├── useSearchProposals.ts     #     Filtered search query
│   │   │   ├── useUpdateProposalOutcome.ts  #  Optimistic mutation
│   │   │   ├── useHookStrategies.ts      #     Strategy list query
│   │   │   ├── useProposalAnalytics.ts   #     4 analytics queries
│   │   │   ├── types.ts                  #     TypeScript types
│   │   │   └── index.ts                  #     Barrel export
│   │   │
│   │   ├── job-queue/                    #   Job queue management (10 files)
│   │   │   ├── components/
│   │   │   │   ├── JobQueuePage.tsx       #     Main queue view
│   │   │   │   ├── JobQueueControls.tsx   #     Sort/filter controls
│   │   │   │   ├── VirtualizedJobList.tsx #     Virtualized job list
│   │   │   │   ├── JobCard.tsx            #     Individual job card
│   │   │   │   └── JobScoreBadge.tsx      #     Score badge variant
│   │   │   ├── hooks/
│   │   │   │   ├── useJobQueue.ts         #     Job queue query
│   │   │   │   ├── useInfiniteJobQueue.ts #     Infinite scroll query
│   │   │   │   └── useInfiniteScroll.ts   #     Scroll detection
│   │   │   ├── types.ts                   #     Queue types
│   │   │   └── index.ts                   #     Barrel export
│   │   │
│   │   ├── voice-learning/               #   Voice profile calibration (14 files)
│   │   │   ├── components/
│   │   │   │   └── GoldenSetUpload.tsx    #     Golden set upload
│   │   │   ├── VoiceCalibration.tsx       #     Main calibration UI
│   │   │   ├── VoiceCalibrationOptions.tsx #    Method selection
│   │   │   ├── QuickCalibration.tsx       #     Quick questionnaire
│   │   │   ├── VoiceProfileDisplay.tsx    #     Profile details
│   │   │   ├── VoiceProfileEmpty.tsx      #     Empty state
│   │   │   ├── VoiceLearningProgress.tsx  #     Calibration progress
│   │   │   ├── VoiceLearningTimeline.tsx  #     Learning history
│   │   │   ├── profileMappers.ts          #     Data mappers
│   │   │   ├── quickCalibrationQuestions.ts #   Question bank
│   │   │   ├── useVoiceProfile.ts         #     Profile query hook
│   │   │   ├── useProposalsEditedCount.ts #     Edit count hook
│   │   │   ├── types.ts                   #     Voice types
│   │   │   └── index.ts                   #     Barrel export
│   │   │
│   │   └── scoring-feedback/             #   Score reporting (5 files)
│   │       ├── components/
│   │       │   └── ReportScoreModal.tsx   #     Report incorrect score
│   │       ├── hooks/
│   │       │   ├── useCanReportScore.ts   #     Eligibility check
│   │       │   └── useSubmitScoringFeedback.ts # Submit feedback
│   │       ├── types.ts                   #     Feedback types
│   │       └── index.ts                   #     Barrel export
│   │
│   ├── hooks/                            # Global custom hooks (16 files)
│   │   ├── useGenerationStream.ts        #   Tauri streaming event listener
│   │   ├── useSafeCopy.ts                #   Copy with perplexity analysis
│   │   ├── useRehumanization.ts          #   Escalating AI recovery
│   │   ├── useProposalEditor.ts          #   TipTap editor + auto-save
│   │   ├── useUpdater.ts                 #   Auto-update lifecycle
│   │   ├── useKeyboardShortcuts.ts       #   Global keyboard shortcuts
│   │   ├── useSettings.ts                #   Typed settings wrapper
│   │   ├── useRssImport.ts              #   RSS import progress tracking
│   │   ├── useNotificationQueue.ts       #   Priority notification queue
│   │   ├── useRemoteConfig.ts            #   Remote config listener
│   │   ├── useStrategySyncListener.ts    #   Strategy sync listener
│   │   ├── useAbTestingListener.ts       #   A/B testing event listener
│   │   ├── useNetworkBlockedNotification.ts # Blocked network alert
│   │   ├── useArrowKeyNavigation.ts      #   Roving tabindex (a11y)
│   │   ├── useFocusTrap.ts              #   Modal focus trap (a11y)
│   │   └── usePlatform.ts               #   Platform detection
│   │
│   ├── stores/                           # Zustand state stores (3 files)
│   │   ├── useGenerationStore.ts         #   Proposal generation lifecycle
│   │   ├── useSettingsStore.ts           #   App settings (DB-backed)
│   │   └── useOnboardingStore.ts         #   Onboarding wizard state
│   │
│   ├── lib/                              # Shared libraries
│   │   └── virtualization/               #   Virtual scrolling (5 files)
│   │       ├── VirtualizedList.tsx        #     Reusable virtual list
│   │       ├── VirtualizedListSkeleton.tsx #    Loading skeleton
│   │       ├── useInfiniteScroll.ts       #    Scroll detection hook
│   │       ├── types.ts                   #    Virtualization types
│   │       └── index.ts                   #    Barrel export
│   │
│   ├── styles/                           # CSS stylesheets
│   ├── types/                            # Shared TypeScript types (6 files)
│   │   ├── analytics.ts                  #   Analytics metric types
│   │   ├── hooks.ts                      #   Hook strategy types
│   │   ├── perplexity.ts                 #   AI detection types
│   │   ├── pipeline.ts                   #   Generation pipeline types
│   │   ├── revisions.ts                  #   Revision history types
│   │   └── voice.ts                      #   Voice profile types
│   │
│   ├── utils/                            # Utility functions (4 files)
│   │   ├── dateUtils.ts                  #   Date formatting helpers
│   │   ├── editorUtils.ts                #   TipTap editor utilities
│   │   ├── platform.ts                   #   Platform detection
│   │   └── textStats.ts                  #   Word/char counting
│   │
│   ├── test/                             # Test infrastructure
│   │   ├── setup.ts                      #   Vitest global setup
│   │   └── __mocks__/                    #   Tauri plugin mocks
│   │
│   └── __tests__/                        # App-level integration tests
│       └── App.test.tsx                  #   Main app test suite
```

### Backend (Rust + Tauri v2)

```
upwork-researcher/
├── src-tauri/                            # Rust backend root
│   ├── src/
│   │   ├── main.rs                       # ** ENTRY: Binary entry point
│   │   ├── lib.rs                        # ** ENTRY: Library root (3000+ lines)
│   │   │                                 #   - Tauri app builder
│   │   │                                 #   - ~80+ IPC command registrations
│   │   │                                 #   - App state management (DraftState, CooldownState, VoiceCache)
│   │   │
│   │   ├── commands/                     # IPC command handlers (9 files)
│   │   │   ├── mod.rs                    #   Module exports
│   │   │   ├── proposals.rs              #   Proposal CRUD + generation
│   │   │   ├── export.rs                 #   Archive export
│   │   │   ├── import.rs                 #   Archive import
│   │   │   ├── hooks.rs                  #   Hook strategy commands
│   │   │   ├── job_queue.rs              #   Job queue commands
│   │   │   ├── scoring_feedback.rs       #   Score reporting
│   │   │   ├── system.rs                 #   System health + config
│   │   │   ├── voice.rs                  #   Voice profile commands
│   │   │   └── test_data.rs              #   Test data seeding
│   │   │
│   │   ├── db/                           # Database layer
│   │   │   ├── mod.rs                    #   Database struct + connection management
│   │   │   ├── migrations/               #   Embedded migration runner
│   │   │   └── queries/                  #   Query modules (14 files)
│   │   │       ├── mod.rs                #     Module exports
│   │   │       ├── proposals.rs          #     Proposal CRUD + A/B tracking
│   │   │       ├── job_posts.rs          #     Job post management
│   │   │       ├── job_skills.rs         #     Skill extraction/matching
│   │   │       ├── scoring.rs            #     Score calculation + color flags
│   │   │       ├── user_skills.rs        #     User skill inventory
│   │   │       ├── voice_profile.rs      #     Voice calibration data
│   │   │       ├── golden_set.rs         #     Golden set proposals
│   │   │       ├── hook_strategies.rs    #     Strategy queries + A/B weights
│   │   │       ├── revisions.rs          #     Revision history + restore
│   │   │       ├── safety_overrides.rs   #     Override tracking
│   │   │       ├── rss_imports.rs        #     RSS batch tracking
│   │   │       ├── settings.rs           #     Key-value settings
│   │   │       └── remote_config.rs      #     Remote config cache
│   │   │
│   │   ├── job/                          # Job intelligence (4 files)
│   │   │   ├── mod.rs                    #   Job analysis orchestration
│   │   │   ├── types.rs                  #   Job data types
│   │   │   ├── rss.rs                    #   RSS feed parsing
│   │   │   └── scraper.rs                #   Web scraping fallback
│   │   │
│   │   ├── voice/                        # Voice learning engine (4 files)
│   │   │   ├── mod.rs                    #   Voice module orchestration
│   │   │   ├── analyzer.rs               #   Writing style analysis
│   │   │   ├── profile.rs                #   Profile construction
│   │   │   └── prompt.rs                 #   Voice-aware prompt building
│   │   │
│   │   ├── passphrase/                   # Passphrase management (2 files)
│   │   │   ├── mod.rs                    #   Argon2id key derivation
│   │   │   └── tests.rs                  #   Passphrase tests
│   │   │
│   │   ├── keychain/                     # OS keychain integration (2 files)
│   │   │   ├── mod.rs                    #   Keyring store/retrieve
│   │   │   ├── recovery.rs               #   Recovery key management
│   │   │   └── tests.rs                  #   Keychain tests
│   │   │
│   │   ├── backup/                       # Database backup (2 files)
│   │   │   ├── mod.rs                    #   Backup/restore logic
│   │   │   └── tests.rs                  #   Backup tests
│   │   │
│   │   ├── migration/                    # SQLite→SQLCipher migration (2 files)
│   │   │   ├── mod.rs                    #   Atomic migration with rollback
│   │   │   └── tests.rs                  #   Migration tests
│   │   │
│   │   ├── logs/                         # Logging infrastructure (2 files)
│   │   │   ├── mod.rs                    #   Tracing setup + file rotation
│   │   │   └── redaction.rs              #   PII/secret redaction
│   │   │
│   │   ├── analysis.rs                   # Job post analysis (AI extraction)
│   │   ├── claude.rs                     # Anthropic Claude API client
│   │   ├── humanization.rs               # AI detection evasion engine
│   │   ├── scoring.rs                    # Weighted job scoring algorithm
│   │   ├── sanitization.rs               # Input sanitization (unicode normalization)
│   │   ├── http.rs                       # HTTP client utilities
│   │   ├── network.rs                    # Network security (CSP enforcement)
│   │   ├── events.rs                     # Tauri event emission helpers
│   │   ├── config.rs                     # App configuration
│   │   ├── remote_config.rs              # Remote config fetching + HMAC verify
│   │   ├── ab_testing.rs                 # A/B testing weight selection
│   │   ├── health_check.rs              # Post-update health verification
│   │   ├── archive.rs                    # Archive format utilities
│   │   ├── archive_export.rs             # Compressed archive export
│   │   ├── archive_import.rs             # Archive import with validation
│   │   └── encryption_spike.rs           # Encryption proof-of-concept
│   │
│   ├── migrations/                       # SQL migration files (30 files, V1-V30)
│   ├── capabilities/                     # Tauri v2 capability permissions
│   ├── resources/                        # Bundled resources
│   ├── icons/                            # App icons (all platforms)
│   ├── tests/                            # Rust integration tests
│   ├── .cargo/                           # Cargo build configuration
│   ├── Cargo.toml                        # Rust dependencies manifest
│   └── tauri.conf.json                   # Tauri app + bundle config
```

### Testing & CI

```
upwork-researcher/
├── tests/                                # E2E & performance tests
│   ├── e2e/                              #   Playwright E2E tests
│   │   ├── accessibility/                #     Accessibility tests (axe-core)
│   │   ├── journeys/                     #     User journey tests
│   │   ├── pages/                        #     Page object models
│   │   ├── fixtures/                     #     Test fixtures + sample data
│   │   │   └── sample-proposals/         #     Sample proposal files
│   │   ├── helpers/                      #     E2E test utilities
│   │   └── scripts/                      #     Test runner scripts
│   │
│   └── performance/                      #   Performance benchmarks
│       └── helpers/                      #     Perf test utilities
│
├── .github/workflows/                    #   CI/CD pipelines
│   ├── release.yml                       #     Multi-platform release build
│   └── e2e.yml                           #     Cross-platform E2E testing
│
├── scripts/                              #   Build & test scripts
│   ├── test-reliability.sh               #     Flaky test detection (bash)
│   └── test-reliability.ps1              #     Flaky test detection (PowerShell)
│
├── playwright.config.ts                  #   Playwright configuration
├── vitest.perf.config.ts                 #   Performance test config
├── vite.config.ts                        #   Vite + Vitest config
├── eslint.config.js                      #   ESLint 9 flat config
├── prettier.config.js                    #   Prettier formatting
├── commitlint.config.cjs                 #   Conventional commit rules
└── .versionrc.cjs                        #   Semantic versioning config
```

## Critical Directories Summary

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/` | Frontend React app | `App.tsx` (entry), 58 components, 16 hooks, 3 stores |
| `src/features/` | Domain feature modules | 4 features: proposal-history, job-queue, voice-learning, scoring-feedback |
| `src-tauri/src/` | Rust backend | `lib.rs` (entry), 9 command modules, 14 query modules |
| `src-tauri/src/commands/` | IPC command handlers | ~80+ Tauri invoke commands |
| `src-tauri/src/db/queries/` | Database query layer | 14 modules for 15 tables |
| `src-tauri/migrations/` | SQL migrations | V1-V30 (30 migration files) |
| `tests/e2e/` | Playwright E2E tests | Journey tests, page objects, a11y tests |
| `.github/workflows/` | CI/CD automation | Release, E2E, performance pipelines |

## Entry Points

| Entry Point | File | Purpose |
|------------|------|---------|
| Frontend mount | `src/main.tsx` | ReactDOM.createRoot → App component |
| App component | `src/App.tsx` | View routing, state init, health checks, encryption flow |
| Rust binary | `src-tauri/src/main.rs` | Calls `upwork_research_agent_lib::run()` |
| Rust library | `src-tauri/src/lib.rs` | Tauri builder, IPC handler registration, app state setup |
| HTML shell | `index.html` | WebView entry point loaded by Tauri |

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────┐
│  WebView (React 19)                                 │
│  ┌───────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Components │→│  Hooks   │→│ Zustand Stores   │  │
│  │ (58+17)   │  │ (16+12)  │  │ (3 stores)      │  │
│  └─────┬─────┘  └────┬─────┘  └────────┬────────┘  │
│        │              │                  │           │
│        └──────────────┴──────────────────┘           │
│                       │ invoke() / listen()          │
├───────────────────────┼─────────────────────────────┤
│  Tauri IPC Bridge     │  (~80+ commands)             │
├───────────────────────┼─────────────────────────────┤
│  Rust Backend         │                              │
│  ┌────────────────────┴────────────────────────┐    │
│  │ Commands Layer (src/commands/)               │    │
│  │  proposals, export, import, hooks,           │    │
│  │  job_queue, scoring_feedback, system, voice   │    │
│  └────────┬───────────────────────┬────────────┘    │
│           │                       │                  │
│  ┌────────┴────────┐    ┌────────┴────────┐         │
│  │ Business Logic  │    │ External APIs   │         │
│  │  analysis.rs    │    │  claude.rs      │         │
│  │  scoring.rs     │    │  http.rs        │         │
│  │  humanization   │    │  remote_config  │         │
│  │  voice/*        │    │  job/rss.rs     │         │
│  │  ab_testing.rs  │    │  job/scraper.rs │         │
│  └────────┬────────┘    └─────────────────┘         │
│           │                                          │
│  ┌────────┴────────────────────────────────┐        │
│  │ Data Layer (src/db/)                     │        │
│  │  14 query modules → SQLCipher (15 tables)│        │
│  │  30 migrations (V1-V30), WAL mode        │        │
│  └──────────────────────────────────────────┘        │
│                                                      │
│  ┌──────────────────────────────────────────┐        │
│  │ Security Layer                            │        │
│  │  keychain/ (OS keyring) │ passphrase/     │        │
│  │  network.rs (CSP)       │ logs/redaction  │        │
│  │  encryption_spike.rs    │ sanitization.rs │        │
│  └──────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

## File Counts by Area

| Area | Source Files | Test Files | Total |
|------|-------------|------------|-------|
| Frontend components | 64 | 56 | 120 |
| Frontend features | 48 | 30 | 78 |
| Frontend hooks/stores | 19 | 16 | 35 |
| Frontend utils/types/lib | 15 | 5 | 20 |
| Rust backend | 38 | 5 | 43 |
| SQL migrations | 30 | - | 30 |
| E2E tests | - | 15+ | 15+ |
| CI/CD workflows | 3 | - | 3 |
| **Total** | **~217** | **~127** | **~344** |
