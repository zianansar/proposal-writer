import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ApiKeySetupProps {
  onComplete: () => void;
  existingKey?: string | null;
}

function ApiKeySetup({ onComplete, existingKey }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validateFormat = useCallback((key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      setValidationError(null);
      return;
    }
    if (!trimmed.startsWith("sk-ant-")) {
      setValidationError("API key must start with 'sk-ant-'");
      return;
    }
    if (trimmed.length < 20) {
      setValidationError("API key appears too short");
      return;
    }
    setValidationError(null);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setApiKey(value);
      setError(null);
      validateFormat(value);
    },
    [validateFormat]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!apiKey.trim()) {
        setError("Please enter your API key");
        return;
      }

      if (validationError) {
        setError(validationError);
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await invoke("set_api_key", { apiKey: apiKey.trim() });
        onComplete();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [apiKey, validationError, onComplete]
  );

  const isValid = apiKey.trim().length > 0 && !validationError;

  return (
    <div className="api-key-setup">
      <h2>{existingKey ? "Update API Key" : "Welcome! Let's get started"}</h2>
      <p className="api-key-setup__description">
        Enter your Anthropic API key to start generating proposals.
        {!existingKey && " You can get one from "}
        {!existingKey && (
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            console.anthropic.com
          </a>
        )}
      </p>

      {existingKey && (
        <p className="api-key-setup__current">
          Current key: <code>{existingKey}</code>
        </p>
      )}

      <form onSubmit={handleSubmit} className="api-key-setup__form">
        <div className="api-key-setup__field">
          <label htmlFor="api-key">Anthropic API Key</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={handleChange}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
            aria-required="true"
            aria-invalid={!!validationError}
            aria-describedby={validationError ? "api-key-error api-key-hint" : "api-key-hint"}
          />
          {validationError && (
            <span id="api-key-error" className="api-key-setup__validation-error" role="alert">
              {validationError}
            </span>
          )}
        </div>

        {error && <p className="api-key-setup__error" role="alert">{error}</p>}

        <div id="api-key-hint" className="api-key-setup__warning">
          <strong>Note:</strong> Your API key will be stored locally on your
          computer. Encrypted storage will be added in a future update.
        </div>

        <button
          type="submit"
          className="api-key-setup__submit"
          disabled={saving || !isValid}
        >
          {saving ? "Saving..." : existingKey ? "Update Key" : "Save & Continue"}
        </button>
      </form>
    </div>
  );
}

export default ApiKeySetup;
