import { useState } from "react";

interface JobInputProps {
  onJobContentChange?: (content: string) => void;
}

function JobInput({ onJobContentChange }: JobInputProps) {
  const [jobContent, setJobContent] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setJobContent(value);
    onJobContentChange?.(value);
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
