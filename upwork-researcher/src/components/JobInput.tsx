import { useState, useEffect } from "react";

interface JobInputProps {
  onJobContentChange?: (content: string) => void;
  value?: string; // Allow parent to control value (Story 1.14 draft recovery)
}

function JobInput({ onJobContentChange, value }: JobInputProps) {
  const [jobContent, setJobContent] = useState("");

  // Sync with parent value when provided (draft recovery)
  useEffect(() => {
    if (value !== undefined && value !== jobContent) {
      setJobContent(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setJobContent(newValue);
    onJobContentChange?.(newValue);
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
    </div>
  );
}

export default JobInput;
