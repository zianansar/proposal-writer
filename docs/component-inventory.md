# Component Inventory

> Generated: 2026-02-19 | 75+ React components | ~90% test coverage

## Summary

| Location | Count | Purpose |
|----------|-------|---------|
| `src/components/` | 58 | Shared UI components |
| `src/components/ui/` | 6 | Radix-inspired primitives |
| `src/components/onboarding/` | 4 | Onboarding wizard steps |
| `src/features/proposal-history/` | 19 | History, analytics, outcomes |
| `src/features/job-queue/` | 10 | Job queue management |
| `src/features/voice-learning/` | 14 | Voice calibration |
| `src/features/scoring-feedback/` | 5 | Score reporting |
| `src/lib/virtualization/` | 5 | Virtual scrolling |
| `src/hooks/` | 16 | Global custom hooks |
| `src/stores/` | 3 | Zustand state stores |

## UI Primitives (`src/components/ui/`)

Radix-inspired foundational components used throughout the app.

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | Button with variants (default, outline, ghost, etc.) |
| Card | `card.tsx` | Card container with header, content, footer slots |
| Label | `label.tsx` | Accessible form label |
| Progress | `progress.tsx` | Progress bar indicator |
| RadioGroup | `radio-group.tsx` | Radio button group with keyboard nav |
| Skeleton | `skeleton.tsx` | Loading placeholder animation |

## Core Components (`src/components/`)

### Navigation & Layout

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| Navigation | `Navigation.tsx` | Yes | Tab-based view switcher (Generate/History/Analytics/Settings), ARIA tablist |
| SkipLink | `SkipLink.tsx` | Yes | Accessibility skip-to-content link |

### Job Analysis

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| JobInput | `JobInput.tsx` | Yes | Job post paste input (auto-detects URL vs text) |
| AnalyzeButton | `AnalyzeButton.tsx` | Yes | Triggers job analysis pipeline |
| AnalysisProgress | `AnalysisProgress.tsx` | Yes | Staged progress (analyzing → extracting → complete) |
| JobAnalysisPanel | `JobAnalysisPanel.tsx` | Yes | Analysis results with badges and hidden needs |
| ScoringBreakdown | `ScoringBreakdown.tsx` | Yes | Detailed score breakdown visualization |
| JobScoreBadge | `JobScoreBadge.tsx` | Yes | Overall score badge (color-coded) |
| SkillsMatchBadge | `SkillsMatchBadge.tsx` | Yes | Skill match percentage display |
| ClientQualityBadge | `ClientQualityBadge.tsx` | Yes | Client quality indicator |
| BudgetAlignmentBadge | `BudgetAlignmentBadge.tsx` | Yes | Budget alignment status |
| HiddenNeedsDisplay | `HiddenNeedsDisplay.tsx` | Yes | Extracted hidden needs list |
| SkillTags | `SkillTags.tsx` | Yes | Extracted skill tag display |

### Proposal Generation & Editing

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| GenerateButton | `GenerateButton.tsx` | Yes | Triggers generation with rate limit display |
| ProposalOutput | `ProposalOutput.tsx` | Yes | Proposal output container |
| ProposalEditor | `ProposalEditor.tsx` | Yes | TipTap rich text editor |
| EditorToolbar | `EditorToolbar.tsx` | Yes | Formatting tools + rehumanize action |
| EditorStatusBar | `EditorStatusBar.tsx` | Yes | Word count, char count, save status |
| CopyButton | `CopyButton.tsx` | Yes | Safe copy with pre-flight AI detection |
| ExportButton | `ExportButton.tsx` | Yes | Export proposals to JSON |
| PipelineIndicator | `PipelineIndicator.tsx` | Yes | Generation pipeline stage display |
| RevisionHistoryPanel | `RevisionHistoryPanel.tsx` | Yes | Proposal revision list with restore |

### Strategy Selection

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| HookStrategySelector | `HookStrategySelector.tsx` | Yes | Strategy picker for proposal generation |
| HookStrategyCard | `HookStrategyCard.tsx` | Yes | Individual strategy card |

### Safety & Security

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| SafetyWarningModal | `SafetyWarningModal.tsx` | Yes | AI detection warning with options |
| OverrideConfirmDialog | `OverrideConfirmDialog.tsx` | Yes | Safety override confirmation |
| EncryptionStatusIndicator | `EncryptionStatusIndicator.tsx` | Yes | Encryption status in header |
| EncryptionDetailsModal | `EncryptionDetailsModal.tsx` | Yes | Encryption details dialog |
| PrivacyIndicator | `PrivacyIndicator.tsx` | Yes | Privacy status display |
| ThresholdAdjustmentNotification | `ThresholdAdjustmentNotification.tsx` | Yes | Adaptive threshold learning notice |

### Onboarding & Setup

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| OnboardingWizard | `OnboardingWizard.tsx` | Yes | Multi-step onboarding flow |
| WelcomeStep | `onboarding/WelcomeStep.tsx` | Yes | Welcome introduction |
| ApiKeyStep | `onboarding/ApiKeyStep.tsx` | Yes | API key configuration |
| VoiceCalibrationStep | `onboarding/VoiceCalibrationStep.tsx` | Yes | Voice profile setup |
| ReadyStep | `onboarding/ReadyStep.tsx` | Yes | Completion confirmation |
| ApiKeySetup | `ApiKeySetup.tsx` | Yes | Standalone API key form |

### Settings & Configuration

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| SettingsPanel | `SettingsPanel.tsx` | Yes | Main settings view |
| UserSkillsConfig | `UserSkillsConfig.tsx` | Yes | User skill inventory management |
| VoiceSettings | `VoiceSettings.tsx` | Yes | Voice profile settings |

### Database & Migration

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| DatabaseMigration | `DatabaseMigration.tsx` | No | SQLite → SQLCipher migration UI |
| PreMigrationBackup | `PreMigrationBackup.tsx` | Yes | Backup before migration |
| MigrationVerification | `MigrationVerification.tsx` | Yes | Post-migration verification |

### Encryption & Auth

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| PassphraseEntry | `PassphraseEntry.tsx` | No | Initial passphrase creation |
| PassphraseUnlock | `PassphraseUnlock.tsx` | Yes | Database unlock on restart |
| RecoveryOptions | `RecoveryOptions.tsx` | Yes | Recovery key generation/backup |

### Notifications & Updates

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| AutoUpdateNotification | `AutoUpdateNotification.tsx` | Yes | Update availability notice |
| MandatoryUpdateDialog | `MandatoryUpdateDialog.tsx` | Yes | Critical update enforcement |
| ConfigUpdateNotification | `ConfigUpdateNotification.tsx` | Yes | Remote config update notice |

### Dialogs & Modals

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| DeleteConfirmDialog | `DeleteConfirmDialog.tsx` | Yes | Deletion confirmation |
| DraftRecoveryModal | `DraftRecoveryModal.tsx` | No | Unsaved draft recovery |
| RollbackDialog | `RollbackDialog.tsx` | No | Update rollback dialog |
| RssImportDialog | `RssImportDialog.tsx` | No | RSS feed import config |
| RssImportProgress | `RssImportProgress.tsx` | Yes | RSS import progress |
| HealthCheckModal | `HealthCheckModal.tsx` | Yes | Post-update health check |

### Utilities

| Component | File | Test | Purpose |
|-----------|------|------|---------|
| LiveAnnouncer | `LiveAnnouncer.tsx` | Yes | ARIA live region for screen readers |
| Tooltip | `Tooltip.tsx` | Yes | Reusable tooltip |

### Deprecated

| Component | File | Replaced By |
|-----------|------|-------------|
| HistoryList | `HistoryList.tsx` | `features/proposal-history/ProposalHistoryList.tsx` |
| HistoryItem | `HistoryItem.tsx` | `features/proposal-history/ProposalHistoryCard.tsx` |

## Feature Modules (`src/features/`)

### Proposal History (`src/features/proposal-history/`)

| Component/Hook | Type | Purpose |
|---------------|------|---------|
| ProposalHistoryList | Component | Virtualized infinite-scroll proposal list |
| ProposalHistoryCard | Component | Individual card with outcome dropdown |
| ProposalDetailView | Component | Full proposal detail view |
| ProposalAnalyticsDashboard | Component | Analytics overview with charts |
| SearchFilterBar | Component | Text search + outcome/strategy/date filters |
| OutcomeDropdown | Component | Outcome status selector |
| OutcomeDistributionChart | Component | Outcomes pie/bar chart (Recharts) |
| StrategyPerformanceChart | Component | Strategy effectiveness chart |
| StrategyEffectivenessTable | Component | Strategy metrics table |
| WeeklyActivityChart | Component | Weekly submission activity |
| DatabaseExportButton | Component | Full database export |
| ImportArchiveDialog | Component | Archive import dialog |
| useProposalHistory | Hook | Infinite query (page size 50, stale 30s) |
| useProposalDetail | Hook | Single proposal query |
| useSearchProposals | Hook | Filtered search with cache sharing |
| useUpdateProposalOutcome | Hook | Optimistic mutation with rollback |
| useHookStrategies | Hook | Strategy list for filter dropdown |
| useProposalAnalytics | Hook | 4 analytics queries (summary, outcomes, strategies, weekly) |

### Job Queue (`src/features/job-queue/`)

| Component/Hook | Type | Purpose |
|---------------|------|---------|
| JobQueuePage | Component | Main queue view with sort/filter |
| JobQueueControls | Component | Sort field + score filter controls |
| VirtualizedJobList | Component | Virtual scrolling job list |
| JobCard | Component | Individual job card with scores |
| JobScoreBadge | Component | Score badge variant for queue |
| useJobQueue | Hook | Paginated query (limit 50) |
| useInfiniteJobQueue | Hook | Infinite scroll variant |
| useInfiniteScroll | Hook | Scroll detection utility |

### Voice Learning (`src/features/voice-learning/`)

| Component/Hook | Type | Purpose |
|---------------|------|---------|
| VoiceCalibration | Component | Main calibration UI |
| VoiceCalibrationOptions | Component | Method selection (golden set vs quick) |
| QuickCalibration | Component | Quick questionnaire flow |
| VoiceProfileDisplay | Component | Calibrated profile details |
| VoiceProfileEmpty | Component | Empty state with CTA |
| VoiceLearningProgress | Component | Calibration progress indicator |
| VoiceLearningTimeline | Component | Historical learning timeline |
| GoldenSetUpload | Component | Upload 3-5 best proposals |
| useVoiceProfile | Hook | Voice profile query |
| useProposalsEditedCount | Hook | Edit count for implicit learning |

### Scoring Feedback (`src/features/scoring-feedback/`)

| Component/Hook | Type | Purpose |
|---------------|------|---------|
| ReportScoreModal | Component | Report incorrect job score |
| useCanReportScore | Hook | Check reporting eligibility |
| useSubmitScoringFeedback | Hook | Submit feedback mutation |

## Global Hooks (`src/hooks/`)

| Hook | Category | Purpose |
|------|----------|---------|
| useGenerationStream | Tauri Events | Listen for streaming tokens, completion, errors, stages |
| useSafeCopy | Safety | Copy with pre-flight perplexity analysis |
| useRehumanization | Safety | Escalating AI recovery (light → medium → heavy, max 3) |
| useProposalEditor | Editor | TipTap instance + auto-save (2s debounce) + retry |
| useUpdater | Updates | Auto-update lifecycle with download progress |
| useKeyboardShortcuts | Input | Global shortcuts (Cmd/Ctrl+Enter, Cmd/Ctrl+Shift+C) |
| useSettings | State | Typed wrapper around useSettingsStore |
| useRssImport | Tauri Events | RSS import progress/completion tracking |
| useNotificationQueue | State | Priority queue for update/config notifications |
| useRemoteConfig | Tauri Events | Listen for remote config strategy updates |
| useStrategySyncListener | Tauri Events | Strategy sync event listener |
| useAbTestingListener | Tauri Events | A/B testing weight events |
| useNetworkBlockedNotification | Tauri Events | Blocked network request alerts |
| useArrowKeyNavigation | Accessibility | Roving tabindex for list navigation |
| useFocusTrap | Accessibility | Modal focus containment |
| usePlatform | Utility | Platform detection (Mac vs Windows) |

## Zustand Stores (`src/stores/`)

| Store | State Shape | Purpose |
|-------|------------|---------|
| useGenerationStore | tokens, isStreaming, error, fullText, cooldown, stages | Proposal generation lifecycle |
| useSettingsStore | settings map, isLoading, isInitialized | App settings (DB-backed) |
| useOnboardingStore | currentStep, showOnboarding | Onboarding wizard UI state |
