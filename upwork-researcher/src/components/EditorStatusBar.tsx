import "./EditorStatusBar.css";

interface EditorStatusBarProps {
  characterCount: number;
  wordCount: number;
}

const WARNING_LOW = 200;
const WARNING_HIGH = 600;

export function EditorStatusBar({ characterCount, wordCount }: EditorStatusBarProps) {
  const getWarning = (): string | null => {
    if (wordCount < WARNING_LOW) {
      return "Upwork recommends 200-500 words";
    }
    if (wordCount > WARNING_HIGH) {
      return "Long proposals may not be fully read";
    }
    return null;
  };

  const warning = getWarning();

  return (
    <div className="editor-status-bar" role="status" aria-live="polite">
      <span className="status-counts">
        <span className="count-item">{characterCount} characters</span>
        <span className="count-separator" aria-hidden="true">·</span>
        <span className="count-item">{wordCount} words</span>
      </span>
      {warning && (
        <span className="status-warning" role="alert">
          <span className="warning-icon" aria-hidden="true">⚠️</span>
          {warning}
        </span>
      )}
    </div>
  );
}
