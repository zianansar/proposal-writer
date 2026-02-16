import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useRef } from "react";

import { useOnboardingStore } from "../../stores/useOnboardingStore";

function ApiKeyStep() {
  const { setCurrentStep } = useOnboardingStore();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount (Task 8: UX polish)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Review Fix #10: Clear input when component mounts
  useEffect(() => {
    setApiKeyInput("");
  }, []);

  const handleNext = async () => {
    setValidationError("");

    // Validate format (sk-ant- prefix)
    if (!apiKeyInput.startsWith("sk-ant-")) {
      setValidationError("Invalid API key format. Key must start with 'sk-ant-'");
      return;
    }

    setIsValidating(true);

    try {
      // Call existing set_api_key Tauri command
      // Review Fix #5: Removed setApiKey(apiKeyInput) - already persisted via Tauri
      await invoke("set_api_key", { apiKey: apiKeyInput });
      setCurrentStep(3);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setIsValidating(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  return (
    <div className="onboarding-step">
      <h2 id="onboarding-title">API Key Setup</h2>
      <p className="onboarding-step__message">
        Enter your Anthropic API key to enable proposal generation.
      </p>

      <div className="onboarding-step__form">
        <label htmlFor="api-key-input" className="onboarding-step__label">
          Anthropic API Key
        </label>
        <input
          id="api-key-input"
          type="password"
          className="onboarding-step__input"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isValidating && apiKeyInput) {
              handleNext();
            }
          }}
          placeholder="sk-ant-..."
          ref={inputRef}
        />
        <p className="onboarding-step__hint">
          Get a key at{" "}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
            console.anthropic.com
          </a>
        </p>
        {validationError && <p className="onboarding-step__error">{validationError}</p>}
      </div>

      <div className="onboarding-step__actions">
        <button className="button button--secondary" onClick={handleBack} disabled={isValidating}>
          Back
        </button>
        <button
          className="button button--primary"
          onClick={handleNext}
          disabled={isValidating || !apiKeyInput}
        >
          {isValidating ? "Validating..." : "Next"}
        </button>
      </div>
    </div>
  );
}

export default ApiKeyStep;
