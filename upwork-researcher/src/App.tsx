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
  const { isStreaming, error: streamError, fullText, isSaved, reset, setStreaming, setSaved } = useGenerationStore();
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
