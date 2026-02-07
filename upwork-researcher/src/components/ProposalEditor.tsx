import { useEffect } from "react";
import { EditorContent } from "@tiptap/react";
import { useProposalEditor, type SaveStatus } from "../hooks/useProposalEditor";
import EditorToolbar from "./EditorToolbar";
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
}: ProposalEditorProps) {
  const { editor, saveStatus } = useProposalEditor({
    initialContent: content,
    proposalId,
    onContentChange,
  });

  // Notify parent of save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  return (
    <div className="proposal-editor">
      <EditorToolbar editor={editor} />
      <div className="proposal-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
      <div className="proposal-editor-status" aria-live="polite">
        {saveStatus === "saving" && <span className="status-saving">Saving...</span>}
        {saveStatus === "saved" && <span className="status-saved">Saved</span>}
        {saveStatus === "error" && <span className="status-error">Save failed</span>}
      </div>
    </div>
  );
}

export default ProposalEditor;
