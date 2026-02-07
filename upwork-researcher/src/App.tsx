import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import JobInput from "./components/JobInput";
import GenerateButton from "./components/GenerateButton";
import ProposalOutput from "./components/ProposalOutput";
import Navigation from "./components/Navigation";
import HistoryList from "./components/HistoryList";
import ApiKeySetup from "./components/ApiKeySetup";
import ExportButton from "./components/ExportButton";
import DraftRecoveryModal from "./components/DraftRecoveryModal";
import OnboardingWizard from "./components/OnboardingWizard";
import SettingsPanel from "./components/SettingsPanel";
import PassphraseEntry from "./components/PassphraseEntry";
import { PreMigrationBackup } from "./components/PreMigrationBackup";
import { DatabaseMigration } from "./components/DatabaseMigration";
import { MigrationVerification } from "./components/MigrationVerification";
import SafetyWarningModal from "./components/SafetyWarningModal";
import EncryptionStatusIndicator from "./components/EncryptionStatusIndicator";
import type { EncryptionStatus } from "./components/EncryptionStatusIndicator";
import EncryptionDetailsModal from "./components/EncryptionDetailsModal";
import RecoveryOptions from "./components/RecoveryOptions";
import { useGenerationStore, getStreamedText } from "./stores/useGenerationStore";
import { useSettingsStore, getHumanizationIntensity } from "./stores/useSettingsStore";
import { useOnboardingStore } from "./stores/useOnboardingStore";
import { useGenerationStream } from "./hooks/useGenerationStream";
import { useRehumanization } from "./hooks/useRehumanization";
import type { PerplexityAnalysis } from "./types/perplexity";
import "./App.css";

type View = "generate" | "history" | "settings";
type MigrationPhase = "idle" | "recovery-options" | "backup" | "migration" | "verification" | "complete" | "failed";

function App() {
  const [activeView, setActiveView] = useState<View>("generate");
  const [jobContent, setJobContent] = useState("");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [checkingApiKey, setCheckingApiKey] = useState(true);
  const [needsPassphrase, setNeedsPassphrase] = useState<boolean>(false);
  const [passphraseSetupComplete, setPassphraseSetupComplete] = useState(false);
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

  // Perplexity analysis state (Stories 3.1 + 3.2 integration)
  const [perplexityAnalysis, setPerplexityAnalysis] = useState<PerplexityAnalysis | null>(null);
  // Track which fullText was already analyzed to prevent re-analysis after modal dismissal
  const analyzedTextRef = useRef<string | null>(null);

  // Streaming state from Zustand store
  const {
    isStreaming,
    error: streamError,
    fullText,
    isSaved,
    retryCount,
    draftRecovery,
    reset,
    setStreaming,
    setSaved,
    incrementRetry,
    setDraftRecovery,
  } = useGenerationStore();
  const streamedText = useGenerationStore(getStreamedText);

  // Local error for input validation
  const [inputError, setInputError] = useState<string | null>(null);

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
  const {
    attemptCount,
    previousScore,
    isRegenerating,
    handleRegenerate,
    resetAttempts,
  } = useRehumanization(jobContent, humanizationIntensity, perplexityAnalysis?.score, {
    onSuccess: (text) => {
      // Regeneration succeeded - score is now passing
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

      // Wait for all to complete
      await Promise.all([settingsPromise, apiKeyPromise, draftPromise, encryptionPromise]);
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
  }, [loadSettings, setDraftRecovery, setShowOnboarding]);

  // Handler for when API key setup is complete
  const handleApiKeySetupComplete = useCallback(() => {
    setHasApiKey(true);
    setActiveView("generate");
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
      console.log(`[Migration] Complete: ${metadata.proposalsMigrated} proposals, ${metadata.settingsMigrated} settings, ${metadata.jobPostsMigrated} job posts migrated in ${metadata.durationMs}ms`);
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
    }
  }, [fullText, streamError]);

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
        });

        // Mark this text as analyzed so we don't re-run after modal dismissal
        analyzedTextRef.current = fullText;

        // Only show modal if score exceeds threshold
        const THRESHOLD = 180;
        if (analysis.score >= THRESHOLD) {
          setPerplexityAnalysis(analysis);
        }
        // If score is passing, no modal needed - user can copy directly
      } catch (error) {
        console.error("Perplexity analysis failed:", error);
        // Non-blocking - user can still copy proposal even if analysis fails
      }
    };

    runPerplexityAnalysis();
  }, [fullText, isStreaming, streamError, isRegenerating]);

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
    resetAttempts();

    try {
      // Ensure event listeners are registered before invoking
      await ensureListenersReady();

      // Use streaming command - tokens will arrive via events
      await invoke<string>("generate_proposal_streaming", {
        jobContent: jobContent,
      });
    } catch (err) {
      // Error will be set via event, but catch invoke errors too
      const errorMessage = err instanceof Error ? err.message : String(err);
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

  // Story 1.13: Save job for later when API fails
  const handleSaveForLater = async () => {
    if (!jobContentRef.current) {
      return;
    }

    try {
      const result = await invoke<{ id: number; saved: boolean }>("save_job_post", {
        jobContent: jobContentRef.current,
        url: null, // User pasted text, no URL
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

  // Combine errors for display
  const displayError = inputError || streamError;

  // Show streamed text while streaming, or full text when complete
  const displayText = isStreaming ? streamedText : (fullText || streamedText);

  // Show loading while checking API key
  if (checkingApiKey) {
    return (
      <main className="container">
        <h1>Upwork Research Agent</h1>
        <div className="api-key-setup__loading">Loading...</div>
      </main>
    );
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
        <p style={{ textAlign: "center", color: "#a0a0a0" }}>
          Migrating to encrypted database...
        </p>
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
      <MigrationVerification
        onDeleteDatabase={handleDeleteDatabase}
        onKeepBoth={handleKeepBoth}
      />
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
    <main className="container">
      <div className="app-header">
        <h1>Upwork Research Agent</h1>
        {encryptionStatus && encryptionStatus.databaseEncrypted && (
          <EncryptionStatusIndicator
            status={encryptionStatus}
            onOpenDetails={handleOpenEncryptionDetails}
          />
        )}
      </div>
      <Navigation activeView={activeView} onViewChange={setActiveView} />

      {activeView === "generate" && (
        <>
          <JobInput onJobContentChange={setJobContent} value={jobContent} />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!jobContent.trim()}
            loading={isStreaming}
          />
          <ProposalOutput
            proposal={displayText || null}
            loading={isStreaming}
            error={displayError}
            isSaved={isSaved}
            onRetry={handleRetry}
            onSaveForLater={handleSaveForLater}
            retryCount={retryCount}
          />
        </>
      )}

      {activeView === "history" && <HistoryList />}

      {activeView === "settings" && (
        <>
          <SettingsPanel />
          <ApiKeySetup
            onComplete={() => setActiveView("generate")}
            existingKey={null}
          />
          <div className="settings-section">
            <h3>Data Export</h3>
            <p className="settings-description">
              Export your proposals to a JSON file for backup before database migration.
            </p>
            <ExportButton />
          </div>
        </>
      )}

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

      {/* Safety Warning Modal (Stories 3.1 + 3.2 + 3.4 integration) */}
      {perplexityAnalysis && perplexityAnalysis.score >= 180 && (
        <SafetyWarningModal
          score={perplexityAnalysis.score}
          threshold={180}
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
            // User chooses to proceed despite warning (Story 3.6)
            setPerplexityAnalysis(null);
            resetAttempts();
          }}
        />
      )}
    </main>
  );
}

export default App;
