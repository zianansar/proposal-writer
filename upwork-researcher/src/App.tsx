import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import JobInput from "./components/JobInput";
import GenerateButton from "./components/GenerateButton";
import ProposalOutput from "./components/ProposalOutput";
import Navigation from "./components/Navigation";
import HistoryList from "./components/HistoryList";
import ApiKeySetup from "./components/ApiKeySetup";
import ExportButton from "./components/ExportButton";
import { useGenerationStore, getStreamedText } from "./stores/useGenerationStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useGenerationStream } from "./hooks/useGenerationStream";
import "./App.css";

type View = "generate" | "history" | "settings";

function App() {
  const [activeView, setActiveView] = useState<View>("generate");
  const [jobContent, setJobContent] = useState("");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [checkingApiKey, setCheckingApiKey] = useState(true);

  // Streaming state from Zustand store
  const {
    isStreaming,
    error: streamError,
    fullText,
    isSaved,
    retryCount,
    reset,
    setStreaming,
    setSaved,
    incrementRetry,
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

      // Wait for both to complete
      await Promise.all([settingsPromise, apiKeyPromise]);
      setCheckingApiKey(false);
    };

    initializeApp();
  }, [loadSettings]);

  // Handler for when API key setup is complete
  const handleApiKeySetupComplete = useCallback(() => {
    setHasApiKey(true);
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
      <h1>Upwork Research Agent</h1>
      <Navigation activeView={activeView} onViewChange={setActiveView} />

      {activeView === "generate" && (
        <>
          <JobInput onJobContentChange={setJobContent} />
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
    </main>
  );
}

export default App;
