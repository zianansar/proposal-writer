import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event"; // Story 2-7b
import { useState, useEffect, useRef, useCallback } from "react";

import AnalysisProgress from "./components/AnalysisProgress"; // Story 4a.6
import type { AnalysisStage } from "./components/AnalysisProgress"; // Story 4a.6
import AnalyzeButton from "./components/AnalyzeButton";
// TODO: Old HistoryList replaced by ProposalHistoryList (Story 7.4 AC-7)
// import HistoryList from "./components/HistoryList";
import ApiKeySetup from "./components/ApiKeySetup";
import { AutoUpdateNotification } from "./components/AutoUpdateNotification"; // Story 9.7
import { DatabaseMigration } from "./components/DatabaseMigration";
import DraftRecoveryModal from "./components/DraftRecoveryModal";
import EncryptionDetailsModal from "./components/EncryptionDetailsModal";
import EncryptionStatusIndicator from "./components/EncryptionStatusIndicator";
import type { EncryptionStatus } from "./components/EncryptionStatusIndicator";
import ExportButton from "./components/ExportButton";
import GenerateButton from "./components/GenerateButton";
import HookStrategySelector from "./components/HookStrategySelector"; // Story 5.2
import JobAnalysisPanel from "./components/JobAnalysisPanel"; // Story 4a.7
import JobInput from "./components/JobInput";
import { LiveAnnouncerProvider, useAnnounce } from "./components/LiveAnnouncer"; // Story 8.3
import { MandatoryUpdateDialog } from "./components/MandatoryUpdateDialog"; // Story 9.8
import { MigrationVerification } from "./components/MigrationVerification";
import Navigation from "./components/Navigation";
import OnboardingWizard from "./components/OnboardingWizard";
import OverrideConfirmDialog from "./components/OverrideConfirmDialog";
import PassphraseEntry from "./components/PassphraseEntry";
import PassphraseUnlock from "./components/PassphraseUnlock"; // Story 2-7b
import { PreMigrationBackup } from "./components/PreMigrationBackup";
import ProposalOutput from "./components/ProposalOutput";
import RecoveryOptions from "./components/RecoveryOptions";
import SafetyWarningModal from "./components/SafetyWarningModal";
import SettingsPanel from "./components/SettingsPanel";
import SkipLink from "./components/SkipLink"; // Story 8.2
import ThresholdAdjustmentNotification, {
  ThresholdSuggestion,
} from "./components/ThresholdAdjustmentNotification";
import {
  ProposalHistoryList,
  ProposalDetailView,
  ProposalAnalyticsDashboard,
} from "./features/proposal-history";
import { useGenerationStream } from "./hooks/useGenerationStream";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNetworkBlockedNotification } from "./hooks/useNetworkBlockedNotification"; // Story 8.13 Task 4.3
import { useRehumanization } from "./hooks/useRehumanization";
import { useSafeCopy } from "./hooks/useSafeCopy";
import { useUpdater } from "./hooks/useUpdater"; // Story 9.8
import { useGenerationStore, getStreamedText } from "./stores/useGenerationStore";
import { useOnboardingStore } from "./stores/useOnboardingStore";
import {
  useSettingsStore,
  getHumanizationIntensity,
  getAutoUpdateEnabled, // Story 9.7
  getSkippedVersion, // Story 9.7
} from "./stores/useSettingsStore";
import type { PerplexityAnalysis } from "./types/perplexity";
import { DEFAULT_PERPLEXITY_THRESHOLD } from "./types/perplexity";
import "./styles/tokens.css";
import "./App.css";

type View = "generate" | "history" | "settings" | "proposal-detail" | "analytics";
type MigrationPhase =
  | "idle"
  | "recovery-options"
  | "backup"
  | "migration"
  | "verification"
  | "complete"
  | "failed";

function AppContent() {
  // Story 8.3 AC3: Live region announcements for status updates
  const announce = useAnnounce();

  const [activeView, setActiveView] = useState<View>("generate");
  // Story 7.4: Track selected proposal for detail view
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [jobContent, setJobContent] = useState("");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [checkingApiKey, setCheckingApiKey] = useState(true);
  const [needsPassphrase, setNeedsPassphrase] = useState<boolean>(false);
  const [passphraseSetupComplete, setPassphraseSetupComplete] = useState(false);
  // Story 2-7b: Unlock state for encrypted database on restart
  const [needsUnlock, setNeedsUnlock] = useState<boolean>(false);
  const [migrationPhase, setMigrationPhase] = useState<MigrationPhase>("idle");
  const [backupFilePath, setBackupFilePath] = useState<string | null>(null);
  const [migrationPassphrase, setMigrationPassphrase] = useState<string | null>(null);

  // Encryption status indicator state (Story 2.8)
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus | null>(null);
  const [showEncryptionDetails, setShowEncryptionDetails] = useState(false);

  // Story 2.8: Memoized handlers for encryption indicator (Review Fix M4)
  const handleOpenEncryptionDetails = useCallback(() => {
    setShowEncryptionDetails(true);
  }, []);

  const handleCloseEncryptionDetails = useCallback(() => {
    setShowEncryptionDetails(false);
  }, []);

  // Threshold adjustment notification state (Story 3.7)
  const [thresholdSuggestion, setThresholdSuggestion] = useState<ThresholdSuggestion | null>(null);

  // Story 9.7: Auto-update settings
  const autoUpdateEnabled = useSettingsStore(getAutoUpdateEnabled);
  const skippedVersion = useSettingsStore(getSkippedVersion);
  // CR R1 H-4 + M-4: Store setter for settings persistence (avoids direct invoke)
  const storeSetting = useSettingsStore((state) => state.setSetting);

  // Perplexity analysis state (Stories 3.1 + 3.2 integration)
  const [perplexityAnalysis, setPerplexityAnalysis] = useState<PerplexityAnalysis | null>(null);
  // Track which fullText was already analyzed to prevent re-analysis after modal dismissal
  const analyzedTextRef = useRef<string | null>(null);
  // M3 fix (Review 3): Track when analysis failed so user knows safety check was skipped
  const [analysisSkipped, setAnalysisSkipped] = useState(false);

  // Story 6.6 CR fix: Ref to get plain text from editor for keyboard shortcuts
  const getPlainTextRef = useRef<(() => string) | null>(null);

  // Story 8.13 Task 4.3: Network blocked notification
  const networkBlockedToast = useNetworkBlockedNotification();

  // Story 9.9 Task 5.5: Rollback notification toast
  const [rollbackToast, setRollbackToast] = useState<string | null>(null);

  // CR R1 M-4: Persist lastUpdateCheck timestamp on background checks
  const handleBackgroundCheckComplete = useCallback(() => {
    storeSetting("last_update_check", new Date().toISOString()).catch(() => {});
  }, [storeSetting]);

  // Story 9.8: Mandatory critical update enforcement
  // Story 9.7 & 9.8: Auto-updater with UI notification support
  const {
    pendingCriticalUpdate, // Story 9.8
    updateInfo,
    checkForUpdate, // CR R1 H-1: Passed to SettingsPanel as prop
    isChecking, // CR R1 H-1: Passed to SettingsPanel as prop
    downloadAndInstall,
    retryDownload, // Story 9.8
    relaunchApp,
    isDownloading,
    error: updaterError,
    updateAvailable, // Story 9.7
    downloadProgress, // Story 9.7
    isDownloaded, // Story 9.7
    clearError, // Story 9.7
    cancelDownload, // Story 9.7
  } = useUpdater({
    autoCheckEnabled: autoUpdateEnabled,
    skippedVersion,
    onCheckComplete: handleBackgroundCheckComplete, // CR R1 M-4
  });

  // Story 9.7: Auto-update notification handlers
  const handleUpdateNow = useCallback(async () => {
    try {
      await downloadAndInstall();
    } catch (err) {
      console.error("Failed to download update:", err);
    }
  }, [downloadAndInstall]);

  const handleUpdateLater = useCallback(() => {
    // User dismissed the toast - notification will auto-dismiss
  }, []);

  const handleSkipVersion = useCallback(async () => {
    if (updateInfo) {
      try {
        // CR R1 H-4: Use store setter to keep state in sync
        await storeSetting("skipped_version", updateInfo.version);
      } catch (err) {
        console.error("Failed to skip version:", err);
      }
    }
  }, [updateInfo, storeSetting]);

  const handleRestart = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (err) {
      console.error("Failed to restart app:", err);
    }
  }, [relaunchApp]);

  const handleRemindLater = useCallback(() => {
    // User dismissed restart dialog - will be prompted again later
  }, []);

  const handleCancelDownload = useCallback(() => {
    cancelDownload();
    clearError();
  }, [cancelDownload, clearError]);

  // Streaming state from Zustand store
  const {
    isStreaming,
    error: streamError,
    fullText,
    isSaved,
    savedId, // Story 3.7: Proposal ID for override tracking
    retryCount,
    draftRecovery,
    cooldownRemaining, // Story 3.8: Rate limiting
    generationWasTruncated, // Story 4a.9 H3: Truncation during generation
    reset,
    setStreaming,
    setSaved,
    incrementRetry,
    setDraftRecovery,
    setCooldown, // Story 3.8
    clearCooldown, // Story 3.8
    tickCooldown, // Story 3.8
  } = useGenerationStore();
  const streamedText = useGenerationStore(getStreamedText);

  // Local error for input validation
  const [inputError, setInputError] = useState<string | null>(null);

  // Job analysis state (Story 4a.2 + 4a.3 + 4a.4 + 4a.6 + 4a.9 + 4b.6)
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle"); // Story 4a.6
  const [jobPostId, setJobPostId] = useState<number | null>(null); // Story 4b.6: For scoring breakdown
  const [clientName, setClientName] = useState<string | null>(null);
  const [keySkills, setKeySkills] = useState<string[]>([]); // Story 4a.3
  const [hiddenNeeds, setHiddenNeeds] = useState<Array<{ need: string; evidence: string }>>([]); // Story 4a.4
  const [hasAnalyzed, setHasAnalyzed] = useState(false); // Story 4a.3: AC-5 - track if analysis ran
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [wasTruncated, setWasTruncated] = useState(false); // Story 4a.9: AC-3 - input truncation warning

  // Story 4b.2: Skills match percentage state
  const [skillsMatchPercentage, setSkillsMatchPercentage] = useState<number | null>(null);
  const [skillsMatchReason, setSkillsMatchReason] = useState<
    "no-user-skills" | "no-job-skills" | null
  >(null);

  // Story 4b.3: Client quality score state
  const [clientQualityScore, setClientQualityScore] = useState<number | null>(null);

  // Story 5.2: Hook strategy selection state (AC-4)
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);

  // Story 4a.6: Timer refs for analysis progress stages
  const extractingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // M2 Code Review Fix: Separate ref for auto-dismiss timer to prevent overwrite
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Story 4a.6: Cleanup timers on unmount
  // M2 Code Review Fix: Include autoDismissTimerRef in cleanup
  useEffect(() => {
    return () => {
      if (extractingTimerRef.current) {
        clearTimeout(extractingTimerRef.current);
      }
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, []);

  // Code Review M5: Reset analysis state when job content changes
  // This prevents showing stale results from previous job post
  useEffect(() => {
    // Only reset if we've previously analyzed (avoid resetting on initial mount)
    if (hasAnalyzed) {
      setClientName(null);
      setKeySkills([]);
      setHiddenNeeds([]);
      setHasAnalyzed(false);
      setAnalysisError(null);
      setAnalysisStage("idle");
      setWasTruncated(false); // Story 4a.9: Clear truncation warning on new input
      setClientQualityScore(null); // Story 4b.3: Clear client quality score on new input
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobContent]); // Only depend on jobContent, not analysis state vars

  // Story 4a.6: Derived loading state for button (backwards compat)
  const analyzingJob = analysisStage === "analyzing" || analysisStage === "extracting";

  // Story 4a.1: Detected URL from job input
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  // Track job content at generation time for saving
  const jobContentRef = useRef<string>("");

  // Set up event listeners for streaming
  const { ensureListenersReady } = useGenerationStream();

  // Settings store
  const { loadSettings } = useSettingsStore();
  const humanizationIntensity = useSettingsStore(getHumanizationIntensity);

  // Onboarding store
  const { setShowOnboarding } = useOnboardingStore();

  // Re-humanization hook (Story 3.4)
  const { attemptCount, previousScore, isRegenerating, handleRegenerate, resetAttempts } =
    useRehumanization(jobContent, humanizationIntensity, perplexityAnalysis?.score, {
      // L1 fix (Review 3): Second param `analysis` unused - we only need the text since
      // score is now passing (< threshold), so we close modal rather than display analysis
      onSuccess: (text) => {
        setPerplexityAnalysis(null);
        useGenerationStore.getState().setComplete(text);
      },
      onAnalysisComplete: (analysis) => {
        // Regeneration done but still failing - update modal with new score
        setPerplexityAnalysis(analysis);
      },
      onFailure: (error) => {
        console.error("Regeneration failed:", error);
        useGenerationStore.getState().setError(error);
      },
    });

  // Story 3.9: Safe copy hook for keyboard shortcut-triggered copies
  const { state: safeCopyState, actions: safeCopyActions } = useSafeCopy();

  // Load settings and check for API key on startup
  useEffect(() => {
    const initializeApp = async () => {
      // Load settings first (parallel with API key check)
      const settingsPromise = loadSettings().catch((err) => {
        console.error("Failed to load settings:", err);
        // Non-blocking - app can work without settings
      });

      const apiKeyPromise = invoke<boolean>("has_api_key")
        .then((result) => {
          setHasApiKey(result);
        })
        .catch((err) => {
          console.error("Failed to check API key:", err);
          setHasApiKey(false);
        });

      // Check for draft from previous session (Story 1.14)
      const draftPromise = invoke<{
        id: number;
        jobContent: string;
        generatedText: string;
        createdAt: string;
        status: string;
      } | null>("check_for_draft")
        .then((draft) => {
          if (draft) {
            setDraftRecovery({
              id: draft.id,
              jobContent: draft.jobContent,
              generatedText: draft.generatedText,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to check for draft:", err);
          // Non-blocking - app can work without draft recovery
        });

      // Story 2.8: Fetch encryption status (non-blocking)
      const encryptionPromise = invoke<EncryptionStatus>("get_encryption_status")
        .then((status) => {
          setEncryptionStatus(status);
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error("Failed to get encryption status:", err);
          }
        });

      // Story 3.8: Sync cooldown state from backend on startup (AC4)
      const cooldownPromise = invoke<number>("get_cooldown_remaining")
        .then((remaining) => {
          if (remaining > 0) {
            setCooldown(remaining * 1000); // Convert seconds to ms
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error("Failed to get cooldown status:", err);
          }
          // Non-blocking - app works without cooldown sync
        });

      // Story 3.7: Check for threshold learning opportunity on startup
      const learningPromise = invoke<ThresholdSuggestion | null>("check_threshold_learning")
        .then((suggestion) => {
          if (suggestion) {
            setThresholdSuggestion(suggestion);
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error("Failed to check threshold learning:", err);
          }
          // Non-blocking - learning is optional enhancement
        });

      // Story 9.9 Task 5.5: Check if a rollback occurred on previous launch
      const rollbackPromise = invoke<string | null>("check_and_clear_rollback_command")
        .then((failedVersion) => {
          if (failedVersion) {
            setRollbackToast(failedVersion);
            // Auto-dismiss after 8 seconds
            setTimeout(() => setRollbackToast(null), 8000);
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error("Failed to check rollback status:", err);
          }
        });

      // Story 3.7: Also check for downward adjustment on startup (AC8)
      const decreasePromise = invoke<ThresholdSuggestion | null>("check_threshold_decrease")
        .then((suggestion) => {
          if (suggestion) {
            // Only set if no increase suggestion already exists
            setThresholdSuggestion((prev) => prev || suggestion);
          }
        })
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.error("Failed to check threshold decrease:", err);
          }
          // Non-blocking
        });

      // Wait for all to complete
      await Promise.all([
        settingsPromise,
        apiKeyPromise,
        draftPromise,
        encryptionPromise,
        cooldownPromise,
        learningPromise,
        decreasePromise,
        rollbackPromise,
      ]);
      setCheckingApiKey(false);

      // Check for first launch ONLY if API key is configured (Review Fix: #1, #2, #8)
      // Must check result directly from apiKeyPromise, not hasApiKey state
      const apiKeyConfigured = await invoke<boolean>("has_api_key").catch(() => false);
      if (apiKeyConfigured) {
        try {
          const completed = await invoke<string | null>("get_setting", {
            key: "onboarding_completed",
          });

          // Show onboarding if flag is missing or false
          if (!completed || completed === "false") {
            setShowOnboarding(true);
          }
        } catch (err) {
          // Review Fix #12: Sanitize error logging - don't expose implementation details
          if (import.meta.env.DEV) {
            console.error("Failed to check onboarding status:", err);
          }
          // On error, assume onboarding not completed
          setShowOnboarding(true);
        }
      }
    };

    initializeApp();
  }, [loadSettings, setDraftRecovery, setShowOnboarding, setCooldown]);

  // Story 2-7b: Listen for passphrase-required event from backend
  useEffect(() => {
    const unlisten = listen("passphrase-required", () => {
      setNeedsUnlock(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Story 2-7b: Handler for successful database unlock
  // M1+M3 fix (Review 2): Re-run DB-dependent initialization that failed while DB was locked.
  // The initial initializeApp() runs before unlock — queries like check_for_draft,
  // get_cooldown_remaining, and check_threshold_learning silently fail when DB is locked.
  const handleDatabaseUnlocked = useCallback(() => {
    setNeedsUnlock(false);

    // Re-fetch encryption status
    invoke<EncryptionStatus>("get_encryption_status")
      .then((status) => setEncryptionStatus(status))
      .catch(() => {});

    // Re-check for draft recovery (Story 1.14)
    invoke<{
      id: number;
      jobContent: string;
      generatedText: string;
      createdAt: string;
      status: string;
    } | null>("check_for_draft")
      .then((draft) => {
        if (draft) {
          setDraftRecovery({
            id: draft.id,
            jobContent: draft.jobContent,
            generatedText: draft.generatedText,
          });
        }
      })
      .catch(() => {});

    // Re-sync cooldown state (Story 3.8)
    invoke<number>("get_cooldown_remaining")
      .then((remaining) => {
        if (remaining > 0) {
          setCooldown(remaining * 1000);
        }
      })
      .catch(() => {});

    // Re-check threshold learning (Story 3.7)
    invoke<ThresholdSuggestion | null>("check_threshold_learning")
      .then((suggestion) => {
        if (suggestion) {
          setThresholdSuggestion(suggestion);
        }
      })
      .catch(() => {});

    invoke<ThresholdSuggestion | null>("check_threshold_decrease")
      .then((suggestion) => {
        if (suggestion) {
          setThresholdSuggestion((prev) => prev || suggestion);
        }
      })
      .catch(() => {});
  }, [setDraftRecovery, setCooldown]);

  // Handler for when API key setup is complete
  const handleApiKeySetupComplete = useCallback(() => {
    setHasApiKey(true);
    setActiveView("generate");
  }, []);

  // Story 7.4 CR R2 M-1: Stable callback for detail view back navigation
  // Prevents Escape-key useEffect in ProposalDetailView from re-registering on every App render
  const handleBackFromDetail = useCallback(() => {
    setActiveView("history");
    setSelectedProposalId(null);
  }, []);

  // Story 3.7: Threshold adjustment handlers (AC5, AC6)
  const handleThresholdAccept = useCallback((newThreshold: number) => {
    setThresholdSuggestion(null);
    // Toast notification will be shown by future enhancement
    if (import.meta.env.DEV) {
      console.log(`[Learning] Threshold adjusted to ${newThreshold}`);
    }
  }, []);

  const handleThresholdReject = useCallback(() => {
    setThresholdSuggestion(null);
    if (import.meta.env.DEV) {
      console.log("[Learning] Threshold suggestion rejected");
    }
  }, []);

  const handleThresholdRemindLater = useCallback(() => {
    setThresholdSuggestion(null);
    // Suggestion will reappear on next trigger (counter preserved in backend)
    if (import.meta.env.DEV) {
      console.log("[Learning] Threshold suggestion deferred");
    }
  }, []);

  // Handler for passphrase setup completion (Story 2.1)
  const handlePassphraseComplete = useCallback((passphrase: string) => {
    console.log("Passphrase set successfully");
    setPassphraseSetupComplete(true);
    setNeedsPassphrase(false);
    setMigrationPassphrase(passphrase); // Store for migration (Story 2.3)

    // Story 2.9: After passphrase is set, show recovery options before migration
    // Migration sequence:
    // 1. Recovery Options (Story 2.9) — NEW
    // 2. Backup (Story 2.2)
    // 3. Migration (Story 2.3)
    // 4. Verification (Story 2.4)
    setMigrationPhase("recovery-options");
  }, []);

  // Handler for recovery options completion (Story 2.9, Task 5.1)
  const handleRecoveryComplete = useCallback(() => {
    // Recovery option chosen (key generated or backup exported) — proceed to migration backup
    setMigrationPhase("backup");
  }, []);

  // Handler for recovery options skip (Story 2.9, AC4)
  const handleRecoverySkip = useCallback(() => {
    // User explicitly skipped recovery — proceed to migration backup
    setMigrationPhase("backup");
  }, []);

  // Handler for backup completion (Story 2.2, Subtask 6.1, 6.3)
  const handleBackupComplete = useCallback((filePath: string) => {
    if (import.meta.env.DEV) {
      console.log(`[Backup] Complete: ${filePath}`);
    }
    setBackupFilePath(filePath);

    // Story 2.3: Proceed to SQLite → SQLCipher migration (Subtask 10.1, 10.2)
    if (import.meta.env.DEV) {
      console.log("[Migration] Starting database migration...");
    }
    setMigrationPhase("migration");
  }, []);

  // Handler for backup failure (Story 2.2, Subtask 6.2)
  const handleBackupFailed = useCallback((error: string) => {
    console.error(`[Backup] Failed: ${error}`);

    // Block migration - do not proceed to Story 2.3
    setMigrationPhase("failed");
  }, []);

  // Handler for migration completion (Story 2.3, Subtask 10.4)
  const handleMigrationComplete = useCallback((metadata: any) => {
    if (import.meta.env.DEV) {
      console.log(
        `[Migration] Complete: ${metadata.proposalsMigrated} proposals, ${metadata.settingsMigrated} settings, ${metadata.jobPostsMigrated} job posts migrated in ${metadata.durationMs}ms`,
      );
    }
    // Story 2.4, Subtask 7.2: Proceed to verification UI
    setMigrationPhase("verification");
  }, []);

  // Handler for deletion after verification (Story 2.4, Subtask 7.4)
  const handleDeleteDatabase = useCallback(() => {
    console.log("[Verification] User chose to delete old database");
    setMigrationPhase("complete");
  }, []);

  // Handler for keeping both databases (Story 2.4, Subtask 7.4)
  const handleKeepBoth = useCallback(() => {
    console.log("[Verification] User chose to keep both databases");
    setMigrationPhase("complete");
  }, []);

  // Handler for migration failure (Story 2.3, Subtask 10.3)
  const handleMigrationFailed = useCallback((error: string) => {
    console.error(`[Migration] Failed: ${error}`);
    setMigrationPhase("failed");
  }, []);

  // Handler for migration retry (Story 2.3, Subtask 10.3)
  const handleMigrationRetry = useCallback(() => {
    // Reset to backup phase to re-run backup + migration
    setMigrationPhase("backup");
  }, []);

  // Handler for continuing with a recovered draft (Story 1.14)
  const handleContinueDraft = useCallback((jobContent: string, generatedText: string) => {
    // Populate the job input
    setJobContent(jobContent);

    // Set the generated text in the store
    useGenerationStore.getState().setComplete(generatedText);

    // Mark as saved (draft already exists in DB)
    // Note: We don't have the draft ID here, but isSaved just controls UI display
    // The actual save happens on next generation

    // Ensure we're on the generate view
    setActiveView("generate");
  }, []);

  // Auto-save when generation completes
  useEffect(() => {
    if (fullText && !isSaved && jobContentRef.current) {
      const saveProposal = async () => {
        try {
          const result = await invoke<{ id: number; saved: boolean }>("save_proposal", {
            jobContent: jobContentRef.current,
            generatedText: fullText,
            strategyId: selectedStrategyId, // Story 7.1 AC-2: Hook strategy used
            jobPostId: jobPostId, // Story 7.1 AC-3: Originating job post
          });
          if (result.saved) {
            setSaved(result.id);
          }
        } catch (err) {
          console.error("Failed to save proposal:", err);
          // Don't show error to user - save failure shouldn't block usage
        }
      };
      saveProposal();
    }
  }, [fullText, isSaved, setSaved]);

  // Reset retry count on successful generation (Story 1.13 Code Review Fix)
  useEffect(() => {
    if (fullText && !streamError) {
      // Success: reset retry count for next generation
      const state = useGenerationStore.getState();
      if (state.retryCount > 0) {
        state.reset();
      }

      // Story 8.3 AC3: Announce successful generation
      if (!isStreaming) {
        announce("Proposal generated successfully");
      }
    }
  }, [fullText, streamError, isStreaming, announce]);

  // Story 8.3 AC3: Announce errors assertively
  useEffect(() => {
    if (streamError) {
      announce(`Error: ${streamError}`, "assertive");
    }
  }, [streamError, announce]);

  // Story 8.3 AC7: Announce job analysis status updates
  useEffect(() => {
    if (analysisStage === "complete") {
      announce("Job analysis complete");
    } else if (analysisStage === "error" && analysisError) {
      announce(`Analysis error: ${analysisError}`, "assertive");
    }
  }, [analysisStage, analysisError, announce]);

  // Run perplexity analysis after generation completes (Stories 3.1 + 3.2 integration)
  useEffect(() => {
    const runPerplexityAnalysis = async () => {
      // Only analyze when generation is complete and we have text
      if (!fullText || isStreaming || streamError) {
        return;
      }

      // Skip if already analyzed this text (prevent re-running after modal dismissal)
      if (analyzedTextRef.current === fullText) {
        return;
      }

      // H2 fix: Skip when regeneration is in progress — useRehumanization hook
      // handles its own perplexity analysis after regeneration completes
      if (isRegenerating) {
        return;
      }

      try {
        const analysis = await invoke<PerplexityAnalysis>("analyze_perplexity", {
          text: fullText,
          threshold: DEFAULT_PERPLEXITY_THRESHOLD,
        });

        // Mark this text as analyzed so we don't re-run after modal dismissal
        analyzedTextRef.current = fullText;

        // Only show modal if score exceeds threshold
        if (analysis.score >= DEFAULT_PERPLEXITY_THRESHOLD) {
          setPerplexityAnalysis(analysis);
        }
        // If score is passing, no modal needed - user can copy directly
      } catch (error) {
        console.error("Perplexity analysis failed:", error);
        // M3 fix (Review 3): Inform user that safety check was skipped
        setAnalysisSkipped(true);
      }
    };

    runPerplexityAnalysis();
  }, [fullText, isStreaming, streamError, isRegenerating]);

  // Story 3.8: Start cooldown timer after successful generation (AC1)
  useEffect(() => {
    if (fullText && !streamError && !isStreaming) {
      setCooldown(120_000); // 2 minutes in ms (FR-12)
    }
  }, [fullText, streamError, isStreaming, setCooldown]);

  // Story 3.8: Countdown timer effect (AC1)
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      tickCooldown();
      const remaining = useGenerationStore.getState().cooldownRemaining;
      if (remaining <= 0) {
        clearCooldown();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownRemaining, tickCooldown, clearCooldown]);

  // Story 4a.2 + 4a.6 + 4a.8: Analyze job post with staged progress indicator + atomic save
  const handleAnalyze = async () => {
    if (!jobContent.trim()) {
      setInputError("Please paste a job post first.");
      return;
    }

    // Story 4a.6: Clear any existing timers
    // M2 Code Review Fix: Clear all three timer refs
    if (extractingTimerRef.current) {
      clearTimeout(extractingTimerRef.current);
      extractingTimerRef.current = null;
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    // Story 4a.6 AC-2: Stage 1 - "Analyzing job post..." immediately
    setAnalysisStage("analyzing");
    setAnalysisError(null);

    // Story 4a.6 AC-2: Start 1.5s timer for Stage 2 transition
    extractingTimerRef.current = setTimeout(() => {
      setAnalysisStage("extracting");
    }, 1500);

    try {
      // Story 4a.8: Save job post first to get ID for analysis
      const saveResult = await invoke<{ id: number; saved: boolean }>("save_job_post", {
        jobContent: jobContent,
        url: detectedUrl,
        clientName: null, // Will be updated by analysis
      });

      const jobPostId = saveResult.id;
      setJobPostId(jobPostId); // Story 4b.6: Store for scoring breakdown

      // Story 4a.8: Analyze with job_post_id for atomic save
      // Story 4b.3: Extended to include clientQualityScore
      const result = await invoke<{
        clientName: string | null;
        keySkills: string[];
        hiddenNeeds: Array<{ need: string; evidence: string }>;
        wasTruncated: boolean; // Story 4a.9: AC-3 - truncation flag
        clientQualityScore: number | null; // Story 4b.3: Client quality score
      }>("analyze_job_post", {
        rawContent: jobContent,
        jobPostId: jobPostId, // Story 4a.8: Pass ID for atomic save
      });

      // Story 4a.6 AC-3: Clear extracting timer (may not have fired yet for fast responses)
      if (extractingTimerRef.current) {
        clearTimeout(extractingTimerRef.current);
        extractingTimerRef.current = null;
      }

      setClientName(result.clientName);
      setKeySkills(result.keySkills || []); // Story 4a.3: Set extracted skills
      setHiddenNeeds(result.hiddenNeeds || []); // Story 4a.4: Set extracted hidden needs
      setHasAnalyzed(true); // Story 4a.3: AC-5 - mark analysis complete for "No skills detected" display
      setWasTruncated(result.wasTruncated || false); // Story 4a.9: AC-3 - Set truncation flag
      setClientQualityScore(result.clientQualityScore ?? null); // Story 4b.3: Set client quality score

      // Story 4b.2: Calculate skills match after analysis completes
      try {
        const matchResult = await invoke<number | null>("calculate_and_store_skills_match", {
          jobPostId: jobPostId,
        });
        setSkillsMatchPercentage(matchResult);
        // Determine reason for null: check if user has skills configured
        if (matchResult === null) {
          const userSkills = await invoke<Array<{ id: number; skill: string }>>("get_user_skills");
          if (userSkills.length === 0) {
            setSkillsMatchReason("no-user-skills");
          } else if ((result.keySkills || []).length === 0) {
            setSkillsMatchReason("no-job-skills");
          } else {
            setSkillsMatchReason(null);
          }
        } else {
          setSkillsMatchReason(null);
        }
      } catch {
        // Skills match is non-critical; don't block analysis display
        setSkillsMatchPercentage(null);
        setSkillsMatchReason(null);
      }

      // Story 4a.6 AC-2: Stage 3 - "Complete ✓"
      setAnalysisStage("complete");

      // Story 4a.8 AC-4: Show "Saved" indicator after successful save
      // M2 Code Review Fix: Use separate refs to avoid timer overwrite issue
      dismissTimerRef.current = setTimeout(() => {
        setAnalysisStage("saved");

        // Auto-dismiss "Saved" after 2s (Story 4a.8 AC-4)
        autoDismissTimerRef.current = setTimeout(() => {
          setAnalysisStage("idle");
        }, 2000);
      }, 500); // Show "Complete" for 500ms before transitioning to "Saved"
    } catch (err) {
      // Story 4a.6 AC-6: Clear timers and show error
      if (extractingTimerRef.current) {
        clearTimeout(extractingTimerRef.current);
        extractingTimerRef.current = null;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);

      // Story 4a.8 AC-5: On save failure, show error but keep analysis results
      setAnalysisError(errorMessage);
      setAnalysisStage("error");
      // AC-6: Preserve previously extracted data on error (don't clear)
      console.error("Job analysis failed:", errorMessage);
    }
  };

  const handleGenerate = async () => {
    if (!jobContent.trim()) {
      setInputError("Please paste a job post first.");
      return;
    }

    // Store job content for saving later
    jobContentRef.current = jobContent;

    // Reset store and clear errors
    reset();
    setInputError(null);
    setStreaming(true);
    // Clear previous perplexity analysis for new generation
    setPerplexityAnalysis(null);
    analyzedTextRef.current = null;
    setAnalysisSkipped(false);
    resetAttempts();

    // Story 8.3 AC3: Announce generation start
    announce("Generating proposal...");

    try {
      // Ensure event listeners are registered before invoking
      await ensureListenersReady();

      // Use streaming command - tokens will arrive via events
      // Story 5.2: Pass selected strategy ID to backend (AC-4, Subtask 5.5)
      await invoke<string>("generate_proposal_streaming", {
        jobContent: jobContent,
        strategyId: selectedStrategyId,
      });
    } catch (err) {
      // Error will be set via event, but catch invoke errors too
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Story 3.8: Handle RATE_LIMITED error from backend (AC2)
      if (errorMessage.startsWith("RATE_LIMITED:")) {
        const remaining = parseInt(errorMessage.split(":")[1], 10);
        if (!isNaN(remaining) && remaining > 0) {
          setCooldown(remaining * 1000);
          // Clear streaming state - rate limit is not an error to display
          setStreaming(false);
          return;
        }
      }

      useGenerationStore.getState().setError(errorMessage);
    }
  };

  // Story 1.13: Retry with exponential backoff
  const handleRetry = async () => {
    const BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
    const delay = BACKOFF_DELAYS[retryCount] || 4000;

    // Wait for backoff delay before incrementing (so UI shows correct count during delay)
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Increment retry count AFTER delay
    incrementRetry();

    // Retry generation
    await handleGenerate();
  };

  // Story 4a.1: Handle input type detection
  const handleInputTypeChange = useCallback((_type: "url" | "text" | null, url: string | null) => {
    setDetectedUrl(url);
  }, []);

  // Story 1.13: Save job for later when API fails
  const handleSaveForLater = async () => {
    if (!jobContentRef.current) {
      return;
    }

    try {
      // Story 4a.1: Pass detected URL instead of hardcoded null
      // Story 4a.2: AC-3 - Pass extracted client name for DB persistence
      const result = await invoke<{ id: number; saved: boolean }>("save_job_post", {
        jobContent: jobContentRef.current,
        url: detectedUrl,
        clientName: clientName,
      });

      if (result.saved) {
        alert("Job saved! You can generate a proposal for it later.");
        setJobContent("");
        reset();
      }
    } catch (err) {
      console.error("Failed to save job:", err);
      alert("Failed to save job. Please try copying the job text manually.");
    }
  };

  // Story 3.9: Keyboard shortcuts
  // Compute whether actions are allowed
  const canGenerate =
    activeView === "generate" && jobContent.trim() !== "" && !isStreaming && cooldownRemaining <= 0;

  const canCopy = !!fullText && !isStreaming && !safeCopyState.analyzing;

  useKeyboardShortcuts({
    onGenerate: handleGenerate,
    onCopy: () => {
      // Story 6.6 CR fix: Use plain text from editor ref if available, otherwise use fullText
      const contentToCopy = getPlainTextRef.current ? getPlainTextRef.current() : fullText;
      if (contentToCopy) {
        safeCopyActions.triggerCopy(contentToCopy);
      }
    },
    canGenerate,
    canCopy,
  });

  // Combine errors for display
  const displayError = inputError || streamError;

  // Show streamed text while streaming, or full text when complete
  const displayText = isStreaming ? streamedText : fullText || streamedText;

  // Story 4a.7: Derived state for panel visibility
  const hasAnalysisResults =
    clientName !== null ||
    keySkills.length > 0 ||
    hiddenNeeds.length > 0 ||
    clientQualityScore !== null;

  // Show loading while checking API key
  if (checkingApiKey) {
    return (
      <main className="container">
        <h1>Upwork Research Agent</h1>
        <div className="api-key-setup__loading">Loading...</div>
      </main>
    );
  }

  // Story 9.8 AC-3: Block all app functionality for critical updates
  // This must be checked FIRST, before any other UI renders
  if (pendingCriticalUpdate && updateInfo) {
    const handleUpdateNow = async () => {
      try {
        await downloadAndInstall();
        // AC-2: Automatic restart after download completes
        await relaunchApp();
      } catch (_error) {
        // Error is tracked in updaterError state, retry button will appear
        // Silent catch - error displayed in UI
      }
    };

    const handleRetry = async () => {
      try {
        await retryDownload();
        await relaunchApp();
      } catch (_error) {
        // Error is tracked in updaterError state
        // Silent catch - error displayed in UI
      }
    };

    return (
      <MandatoryUpdateDialog
        updateInfo={updateInfo}
        onUpdateNow={handleUpdateNow}
        onRetry={handleRetry}
        downloadProgress={null} // Detailed progress not exposed by hook, use isDownloading instead
        downloadError={updaterError}
        isDownloading={isDownloading}
      />
    );
  }

  // Story 2-7b: Show unlock modal for encrypted database on restart
  if (needsUnlock) {
    return <PassphraseUnlock onUnlocked={handleDatabaseUnlocked} />;
  }

  // Show passphrase entry if needed (Story 2.1 - Epic 2)
  // TODO: Check if salt file exists to determine if passphrase already set
  if (needsPassphrase && !passphraseSetupComplete) {
    return <PassphraseEntry onComplete={handlePassphraseComplete} />;
  }

  // Show recovery options (Story 2.9)
  // This runs AFTER passphrase setup, BEFORE backup/migration
  if (migrationPhase === "recovery-options" && migrationPassphrase) {
    return (
      <RecoveryOptions
        passphrase={migrationPassphrase}
        onComplete={handleRecoveryComplete}
        onSkip={handleRecoverySkip}
      />
    );
  }

  // Show pre-migration backup (Story 2.2)
  // This runs BEFORE Story 2.3 migration
  if (migrationPhase === "backup") {
    return (
      <div className="container">
        <h1>Database Migration</h1>
        <p style={{ textAlign: "center", color: "#a0a0a0" }}>
          Preparing to encrypt your database...
        </p>
        <PreMigrationBackup
          onBackupComplete={handleBackupComplete}
          onBackupFailed={handleBackupFailed}
        />
      </div>
    );
  }

  // Show database migration (Story 2.3, Subtask 10.1)
  // This runs AFTER backup is complete
  if (migrationPhase === "migration" && backupFilePath && migrationPassphrase) {
    return (
      <div className="container">
        <h1>Database Migration</h1>
        <p style={{ textAlign: "center", color: "#a0a0a0" }}>Migrating to encrypted database...</p>
        <DatabaseMigration
          passphrase={migrationPassphrase}
          backupPath={backupFilePath}
          onMigrationComplete={handleMigrationComplete}
          onMigrationFailed={handleMigrationFailed}
          onRetry={handleMigrationRetry}
        />
      </div>
    );
  }

  // Show migration verification (Story 2.4, Subtask 7.1-7.3)
  // This runs AFTER migration is complete
  if (migrationPhase === "verification") {
    return (
      <MigrationVerification onDeleteDatabase={handleDeleteDatabase} onKeepBoth={handleKeepBoth} />
    );
  }

  // Show setup screen if no API key configured
  if (!hasApiKey) {
    return (
      <main className="container">
        <h1>Upwork Research Agent</h1>
        <ApiKeySetup onComplete={handleApiKeySetupComplete} />
      </main>
    );
  }

  return (
    <>
      {/* Story 8.2: Skip link for keyboard navigation */}
      <SkipLink />
      {/* Story 9.7: Auto-update notification UI */}
      <AutoUpdateNotification
        updateAvailable={updateAvailable && !pendingCriticalUpdate}
        updateInfo={updateInfo}
        downloadProgress={downloadProgress}
        isDownloading={isDownloading}
        isDownloaded={isDownloaded}
        onUpdateNow={handleUpdateNow}
        onLater={handleUpdateLater}
        onSkip={handleSkipVersion}
        onRestart={handleRestart}
        onRemindLater={handleRemindLater}
        onCancel={handleCancelDownload}
      />
      {/* Story 9.9 Task 5.5: Rollback notification toast */}
      {rollbackToast && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: "70px",
            right: "20px",
            backgroundColor: "#f59e0b",
            color: "#1a1a1a",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            zIndex: 9998,
            maxWidth: "400px",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          <strong>Update Rolled Back</strong>
          <div style={{ marginTop: "8px" }}>
            Update v{rollbackToast} was rolled back. This version has been skipped.
          </div>
        </div>
      )}
      {/* Story 8.13 Task 4.3: Network blocked notification toast */}
      {networkBlockedToast && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            backgroundColor: "#dc3545",
            color: "white",
            padding: "16px 24px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            zIndex: 9999,
            maxWidth: "400px",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          <strong>⚠️ Blocked Network Request</strong>
          <div style={{ marginTop: "8px" }}>
            Unauthorized domain:{" "}
            <code
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {networkBlockedToast.domain}
            </code>
          </div>
          <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.9 }}>
            Only requests to api.anthropic.com are allowed for security.
          </div>
        </div>
      )}
      <div className="container">
        {/* Story 8.3: Semantic header landmark (AC5) */}
        <header role="banner">
          <h1>Upwork Research Agent</h1>
          {encryptionStatus && encryptionStatus.databaseEncrypted && (
            <EncryptionStatusIndicator
              status={encryptionStatus}
              onOpenDetails={handleOpenEncryptionDetails}
            />
          )}
        </header>
        <Navigation activeView={activeView} onViewChange={setActiveView} />

        {/* Story 8.3: Semantic main landmark (AC5) */}
        <main role="main" id="main-content">
          {/* Story 8.3: Tabpanel for generate view */}
          <div
            id="generate-panel"
            role="tabpanel"
            aria-labelledby="generate-tab"
            hidden={activeView !== "generate"}
          >
            {activeView === "generate" && (
              <>
                <h2 className="sr-only">Generate Proposal</h2>
                <JobInput
                  onJobContentChange={setJobContent}
                  onInputTypeChange={handleInputTypeChange}
                  value={jobContent}
                  error={inputError}
                />
                <AnalyzeButton
                  onClick={handleAnalyze}
                  disabled={!jobContent.trim()}
                  loading={analyzingJob}
                />
                {/* Story 4a.6: Progress indicator below Analyze button */}
                <AnalysisProgress stage={analysisStage} errorMessage={analysisError || undefined} />
                {/* Story 4a.9: AC-3 - Truncation warning */}
                {wasTruncated && hasAnalysisResults && (
                  <div
                    style={{
                      padding: "8px 12px",
                      marginTop: "8px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fbbf24",
                      borderRadius: "4px",
                      color: "#92400e",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    ⚠️ Job post too long. Content was trimmed to fit analysis limits. Consider
                    summarizing the post manually.
                  </div>
                )}
                {/* Story 4a.7: Unified job analysis panel */}
                <JobAnalysisPanel
                  jobPostId={jobPostId}
                  clientName={clientName}
                  keySkills={keySkills}
                  hiddenNeeds={hiddenNeeds}
                  onGenerateClick={handleGenerate}
                  visible={hasAnalysisResults}
                  isGenerating={isStreaming}
                  skillsMatchPercentage={skillsMatchPercentage}
                  skillsMatchReason={skillsMatchReason}
                  clientQualityScore={clientQualityScore}
                />
                {/* Story 5.2: Hook Strategy Selection UI (AC-1, AC-4) */}
                {hasAnalysisResults && (
                  <HookStrategySelector onSelectionChange={setSelectedStrategyId} />
                )}
                <GenerateButton
                  onClick={handleGenerate}
                  disabled={!jobContent.trim()}
                  loading={isStreaming}
                  cooldownSeconds={cooldownRemaining}
                />
                <ProposalOutput
                  proposal={displayText || null}
                  loading={isStreaming}
                  error={displayError}
                  isSaved={isSaved}
                  proposalId={savedId}
                  onRetry={handleRetry}
                  onSaveForLater={handleSaveForLater}
                  getPlainTextRef={getPlainTextRef}
                  retryCount={retryCount}
                  enableEditor={true}
                />
                {/* Story 4a.9 H3: Show truncation warning when generation input was truncated */}
                {generationWasTruncated && fullText && !isStreaming && (
                  <div
                    style={{
                      padding: "8px 12px",
                      marginTop: "8px",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fbbf24",
                      borderRadius: "4px",
                      color: "#92400e",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                    role="alert"
                  >
                    ⚠️ Job post too long. Content was trimmed to fit generation limits. The proposal
                    may not address all details from the original post.
                  </div>
                )}
                {/* M3 fix (Review 3): Show subtle warning when safety analysis was skipped */}
                {analysisSkipped && fullText && !isStreaming && (
                  <div className="analysis-skipped-warning" role="alert">
                    ⚠️ AI detection check was skipped due to an error. Review your proposal before
                    submitting.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Story 8.3: Tabpanel for history view */}
          {/* Story 7.4 AC-7: ProposalHistoryList replaces old HistoryList */}
          {/* H-1 CR fix: Panel stays mounted during detail view to preserve scroll position and filter state (AC-2) */}
          <div
            id="history-panel"
            role="tabpanel"
            aria-labelledby="history-tab"
            hidden={activeView !== "history"}
          >
            <h2 className="sr-only">Proposal History</h2>
            {(activeView === "history" || activeView === "proposal-detail") && (
              <ProposalHistoryList
                onProposalSelect={(id) => {
                  setSelectedProposalId(id);
                  setActiveView("proposal-detail");
                }}
              />
            )}
          </div>

          {/* Story 7.4: Proposal detail view (sub-view of history) */}
          {activeView === "proposal-detail" && selectedProposalId != null && (
            <ProposalDetailView proposalId={selectedProposalId} onBack={handleBackFromDetail} />
          )}

          {/* Story 7.5: Analytics dashboard view */}
          <div
            id="analytics-panel"
            role="tabpanel"
            aria-labelledby="analytics-tab"
            hidden={activeView !== "analytics"}
          >
            <h2 className="sr-only">Proposal Analytics</h2>
            {activeView === "analytics" && <ProposalAnalyticsDashboard />}
          </div>

          {/* Story 8.3: Tabpanel for settings view */}
          <div
            id="settings-panel"
            role="tabpanel"
            aria-labelledby="settings-tab"
            hidden={activeView !== "settings"}
          >
            {activeView === "settings" && (
              <>
                <SettingsPanel checkForUpdate={checkForUpdate} isChecking={isChecking} />
                <ApiKeySetup onComplete={() => setActiveView("generate")} existingKey={null} />
                <div className="settings-section">
                  <h3>Data Export</h3>
                  <p className="settings-description">
                    Export your proposals to a JSON file for backup before database migration.
                  </p>
                  <ExportButton />
                </div>
              </>
            )}
          </div>

          {/* Draft Recovery Modal (Story 1.14) */}
          {draftRecovery && <DraftRecoveryModal onContinue={handleContinueDraft} />}

          {/* Onboarding Wizard (Story 1.15) */}
          <OnboardingWizard />

          {/* Encryption Details Modal (Story 2.8) */}
          {showEncryptionDetails && encryptionStatus && (
            <EncryptionDetailsModal
              status={encryptionStatus}
              onClose={handleCloseEncryptionDetails}
            />
          )}

          {/* Threshold Adjustment Notification (Story 3.7) */}
          {thresholdSuggestion && (
            <ThresholdAdjustmentNotification
              suggestion={thresholdSuggestion}
              onAccept={handleThresholdAccept}
              onReject={handleThresholdReject}
              onRemindLater={handleThresholdRemindLater}
            />
          )}

          {/* Safety Warning Modal (Stories 3.1 + 3.2 + 3.4 integration) */}
          {perplexityAnalysis && perplexityAnalysis.score >= DEFAULT_PERPLEXITY_THRESHOLD && (
            <SafetyWarningModal
              score={perplexityAnalysis.score}
              threshold={DEFAULT_PERPLEXITY_THRESHOLD}
              flaggedSentences={perplexityAnalysis.flaggedSentences}
              humanizationIntensity={humanizationIntensity}
              onRegenerate={handleRegenerate}
              attemptCount={attemptCount}
              previousScore={previousScore}
              isRegenerating={isRegenerating}
              onEdit={() => {
                // Close modal and let user edit proposal
                setPerplexityAnalysis(null);
                resetAttempts();
              }}
              onOverride={() => {
                // User chooses to proceed despite warning (Story 3.6 + 3.7)
                // Record override for adaptive learning if proposal is saved
                if (savedId && perplexityAnalysis) {
                  invoke("record_safety_override", {
                    proposalId: savedId,
                    aiScore: perplexityAnalysis.score,
                    threshold: perplexityAnalysis.threshold,
                  }).catch((err) => {
                    if (import.meta.env.DEV) {
                      console.warn("Override recording failed:", err);
                    }
                  });
                }
                setPerplexityAnalysis(null);
                resetAttempts();
              }}
            />
          )}

          {/* Story 3.9: Safety Warning Modal for keyboard shortcut-triggered copies */}
          {safeCopyState.showWarningModal && safeCopyState.analysisResult && (
            <SafetyWarningModal
              score={safeCopyState.analysisResult.score}
              threshold={safeCopyState.analysisResult.threshold}
              flaggedSentences={safeCopyState.analysisResult.flaggedSentences}
              onEdit={() => safeCopyActions.dismissWarning()}
              onOverride={() => safeCopyActions.showOverrideDialog()}
            />
          )}

          {/* Story 3.9: Override Confirmation Dialog for keyboard shortcut-triggered copies */}
          {safeCopyState.showOverrideConfirm && (
            <OverrideConfirmDialog
              onCancel={() => safeCopyActions.cancelOverride()}
              onConfirm={() => {
                if (fullText) {
                  safeCopyActions.confirmOverride(fullText, savedId);
                }
              }}
            />
          )}
        </main>
      </div>
    </>
  );
}

// Main App wrapper with LiveAnnouncerProvider
function App() {
  return (
    <LiveAnnouncerProvider>
      <AppContent />
    </LiveAnnouncerProvider>
  );
}

export default App;
