import { useState, useEffect } from "react";

// Story 4a.1: Input type detection result
export interface InputTypeResult {
  type: "url" | "text" | null;
  url: string | null;
}

// Story 4a.1: Detect if content is a URL or raw text
// Returns URL type only if entire trimmed content is a single URL (no newlines)
export function detectInputType(content: string): InputTypeResult {
  if (!content || content.trim() === "") {
    return { type: null, url: null };
  }

  const trimmed = content.trim();

  // Check if it's a single-line URL (no newlines)
  if (trimmed.includes("\n")) {
    return { type: "text", url: null };
  }

  // Check if starts with http:// or https://
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { type: "url", url: trimmed };
  }

  return { type: "text", url: null };
}

interface JobInputProps {
  onJobContentChange?: (content: string) => void;
  onInputTypeChange?: (type: "url" | "text" | null, detectedUrl: string | null) => void;
  value?: string; // Allow parent to control value (Story 1.14 draft recovery)
}

function JobInput({ onJobContentChange, onInputTypeChange, value }: JobInputProps) {
  const [jobContent, setJobContent] = useState("");
  const [inputType, setInputType] = useState<"url" | "text" | null>(null);

  // Sync with parent value when provided (draft recovery)
  useEffect(() => {
    if (value !== undefined && value !== jobContent) {
      setJobContent(value);
      // Also update input type when value changes externally
      const result = detectInputType(value);
      setInputType(result.type);
      onInputTypeChange?.(result.type, result.url);
    }
  }, [value, jobContent, onInputTypeChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setJobContent(newValue);
    onJobContentChange?.(newValue);

    // Story 4a.1: Detect input type on each change
    const result = detectInputType(newValue);
    setInputType(result.type);
    onInputTypeChange?.(result.type, result.url);
  };

  return (
    <div className="job-input">
      <label htmlFor="job-content">Job Post</label>
      <textarea
        id="job-content"
        value={jobContent}
        onChange={handleChange}
        placeholder="Paste a job post URL or the full job description text here..."
        rows={12}
      />
      {/* Story 4a.1: Visual indicator for detected input type */}
      {inputType === "url" && (
        <span className="input-type-indicator input-type-url" role="status" aria-live="polite">
          🔗 Job URL detected
        </span>
      )}
      {inputType === "text" && (
        <span className="input-type-indicator input-type-text" role="status" aria-live="polite">
          📝 Raw job text detected
        </span>
      )}
    </div>
  );
}

export default JobInput;
