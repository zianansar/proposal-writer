import { useState, useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

interface CopyButtonProps {
  text: string;
  disabled?: boolean;
}

/**
 * Button that copies text to the system clipboard.
 * Shows "Copied!" confirmation for 2 seconds after successful copy.
 */
function CopyButton({ text, disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (disabled || !text) return;

    try {
      await writeText(text);
      setCopied(true);
      setError(null);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
      console.error("Clipboard write failed:", err);
    }
  }, [text, disabled]);

  return (
    <div className="copy-button-container">
      <button
        type="button"
        className={`copy-button ${copied ? "copy-button--copied" : ""}`}
        onClick={handleCopy}
        disabled={disabled || !text}
        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      >
        {copied ? (
          <>
            <span className="copy-icon" aria-hidden="true">✓</span>
            Copied!
          </>
        ) : (
          <>
            <span className="copy-icon" aria-hidden="true">📋</span>
            Copy to Clipboard
          </>
        )}
      </button>
      {error && <span className="copy-error" role="alert">{error}</span>}
    </div>
  );
}

export default CopyButton;
