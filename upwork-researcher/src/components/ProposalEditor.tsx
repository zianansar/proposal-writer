import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useState, useCallback } from "react";

import { useProposalEditor, type SaveStatus } from "../hooks/useProposalEditor";
import { countCharacters, countWords } from "../utils/textStats";

import { EditorStatusBar } from "./EditorStatusBar";
import EditorToolbar from "./EditorToolbar";
import { RevisionHistoryPanel } from "./RevisionHistoryPanel";
import "./ProposalEditor.css";

interface ProposalEditorProps {
  /** Initial content to load into editor */
  content: string;
  /** Proposal ID for auto-save (required for database updates) */
  proposalId: number | null;
  /** Callback when content changes (for parent state sync) */
  onContentChange?: (content: string) => void;
  /** Callback when save status changes */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** Callback when editor is ready (Story 6.6) - provides editor instance */
  onEditorReady?: (editor: Editor | null) => void;
}

/**
 * TipTap rich text editor for proposal editing (Story 6.1)
 *
 * Features:
 * - Bold, Italic, Bullet/Numbered lists, Clear formatting, Undo/Redo
 * - Auto-save every 2 seconds after changes
 * - Persistent editor instance (content swap via setContent)
 * - Transaction history cleared on new proposal load
 */
function ProposalEditor({
  content,
  proposalId,
  onContentChange,
  onSaveStatusChange,
  onEditorReady,
}: ProposalEditorProps) {
  const { editor, saveStatus } = useProposalEditor({
    initialContent: content,
    proposalId,
    onContentChange,
  });

  // State for revision history panel (Story 6.3)
  const [showHistory, setShowHistory] = useState(false);

  // Story 6.6: Notify parent when editor is ready
  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  // State for character and word counts (Story 6.4)
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  // Notify parent of save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Update character and word counts (Story 6.4)
  useEffect(() => {
    if (!editor) return;

    // Calculate initial counts
    const updateCounts = () => {
      const text = editor.getText();
      setCharCount(countCharacters(text));
      setWordCount(countWords(text));
    };

    // Initial count
    updateCounts();

    // Listen to content changes
    editor.on("update", updateCounts);

    return () => {
      editor.off("update", updateCounts);
    };
  }, [editor]);

  // Handle revision restore (Story 6.3)
  const handleRestore = useCallback(
    (restoredContent: string) => {
      if (editor) {
        editor.commands.setContent(restoredContent);
        onContentChange?.(restoredContent);
      }
    },
    [editor, onContentChange],
  );

  // Return focus to editor after history panel closes (AC-7)
  const handleFocusEditor = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  return (
    <div className="proposal-editor">
      <EditorToolbar editor={editor} onViewHistory={() => setShowHistory(true)} />
      <div className="proposal-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
      {/* Character and word count status bar (Story 6.4) */}
      <EditorStatusBar characterCount={charCount} wordCount={wordCount} />
      <div className="proposal-editor-status" aria-live="polite">
        {saveStatus === "saving" && <span className="status-saving">Saving...</span>}
        {saveStatus === "saved" && <span className="status-saved">Saved</span>}
        {saveStatus === "error" && <span className="status-error">Save failed</span>}
      </div>

      {/* Revision History Panel (Story 6.3) */}
      {showHistory && proposalId && (
        <RevisionHistoryPanel
          proposalId={proposalId}
          onRestore={handleRestore}
          onClose={() => setShowHistory(false)}
          onFocusEditor={handleFocusEditor}
        />
      )}
    </div>
  );
}

export default ProposalEditor;
