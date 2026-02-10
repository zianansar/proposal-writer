// Story 5.3: Golden Set Upload UI
// Upload 3-5 past successful proposals for voice calibration

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PrivacyIndicator } from "../../../components/PrivacyIndicator";
import "./GoldenSetUpload.css";

interface GoldenProposal {
  id: number;
  content: string;
  word_count: number;
  source_filename: string | null;
  created_at: string;
}

interface FileContent {
  text: string;
  filename: string;
}

export interface GoldenSetUploadProps {
  /** Callback when user completes upload (3+ proposals) and clicks Continue */
  onComplete: () => void;
}

export function GoldenSetUpload({ onComplete }: GoldenSetUploadProps) {
  const [proposals, setProposals] = useState<GoldenProposal[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // AC-4: Real-time word count
  const wordCount = pasteText.trim() ? pasteText.split(/\s+/).filter(Boolean).length : 0;

  // AC-5: "Continue" enabled only when 3+ proposals
  const canContinue = proposals.length >= 3;

  // Load existing proposals on mount
  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    try {
      const loaded = await invoke<GoldenProposal[]>("get_golden_proposals_command");
      setProposals(loaded);
    } catch (err) {
      console.error("Failed to load proposals:", err);
    }
  };

  // AC-2: File upload handler
  const handleFileUpload = async () => {
    setError(null);
    setIsUploading(true);

    try {
      const fileContent = await invoke<FileContent>("pick_and_read_file");

      // Add proposal from file
      await invoke<number>("add_golden_proposal_command", {
        content: fileContent.text,
        sourceFilename: fileContent.filename,
      });

      // Reload proposals list
      await loadProposals();
      setError(null);
    } catch (err) {
      if (typeof err === "string") {
        setError(err);
      } else {
        setError("Failed to upload file");
      }
    } finally {
      setIsUploading(false);
    }
  };

  // AC-3: Paste handler
  const handleAddPasted = async () => {
    if (wordCount < 200) return;

    setError(null);
    setIsUploading(true);

    try {
      await invoke<number>("add_golden_proposal_command", {
        content: pasteText,
        sourceFilename: null,
      });

      // Clear textarea after successful add (AC-3)
      setPasteText("");

      // Reload proposals list
      await loadProposals();
      setError(null);
    } catch (err) {
      if (typeof err === "string") {
        setError(err);
      } else {
        setError("Failed to add proposal");
      }
    } finally {
      setIsUploading(false);
    }
  };

  // AC-5: Delete handler
  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_golden_proposal_command", { id });
      await loadProposals();
      setError(null);
    } catch (err) {
      setError("Failed to delete proposal");
    }
  };

  const handleContinue = useCallback(() => {
    if (canContinue) {
      onComplete();
    }
  }, [canContinue, onComplete]);

  return (
    <div className="golden-set-upload">
      <h2>Upload Your Best Proposals</h2>
      <p className="instructions">
        Upload 3-5 of your best proposals that got responses
      </p>

      {/* Story 5-6: Privacy indicator prominently at top */}
      <PrivacyIndicator variant="golden-set" />

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {/* AC-1: Upload section */}
      <div className="upload-options">
        <button
          onClick={handleFileUpload}
          disabled={isUploading || proposals.length >= 5}
          className="upload-button"
          aria-label="Upload proposal file (.txt or .pdf)"
        >
          📁 Upload File (.txt, .pdf)
        </button>
        <span className="or-divider">or paste below</span>
      </div>

      {/* AC-3: Paste area */}
      <div className="paste-section">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your proposal text here..."
          disabled={isUploading || proposals.length >= 5}
          className="paste-textarea"
          aria-label="Paste proposal text"
          rows={8}
        />

        {/* AC-4: Word count display */}
        <div className="word-count" aria-live="polite">
          Word count: {wordCount}
          {wordCount > 0 && wordCount < 200 && (
            <span className="word-count-error"> (minimum 200 required)</span>
          )}
        </div>

        <button
          onClick={handleAddPasted}
          disabled={wordCount < 200 || isUploading || proposals.length >= 5}
          className="add-button"
        >
          Add Proposal
        </button>
      </div>

      {/* AC-5: Progress counter */}
      <div className="progress-section">
        <div className="progress-counter" aria-live="polite">
          {proposals.length}/5 proposals uploaded
          {proposals.length < 3 && <span className="progress-note"> (minimum 3 required)</span>}
        </div>

        {/* AC-5: Uploaded list */}
        {proposals.length > 0 && (
          <ul className="proposal-list" aria-label="Uploaded proposals">
            {proposals.map((p) => (
              <li key={p.id} className="proposal-item">
                <div className="proposal-preview">
                  <span className="preview-text">
                    {p.content.slice(0, 50)}...
                  </span>
                  <span className="word-count-badge">
                    {p.word_count} words
                  </span>
                  {p.source_filename && (
                    <span className="filename-badge">{p.source_filename}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="delete-button"
                  aria-label={`Delete proposal: ${p.source_filename || "pasted text"}`}
                  title="Delete this proposal"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AC-5: Continue button */}
      <div className="continue-section">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="continue-button primary"
          aria-disabled={!canContinue}
        >
          Continue to Calibration
        </button>
        {!canContinue && proposals.length > 0 && (
          <p className="continue-note">
            Upload {3 - proposals.length} more proposal{3 - proposals.length !== 1 ? "s" : ""} to continue
          </p>
        )}
      </div>
    </div>
  );
}
