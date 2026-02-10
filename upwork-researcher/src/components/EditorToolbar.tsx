import type { Editor } from "@tiptap/react";
import { Tooltip } from "./Tooltip";
import { SHORTCUTS } from "../utils/platform";

interface EditorToolbarProps {
  editor: Editor | null;
  /** Callback to open revision history panel (Story 6.3) */
  onViewHistory?: () => void;
}

/**
 * Formatting toolbar for TipTap editor (Story 6.1)
 * Provides: Bold, Italic, Bullet List, Numbered List, Clear Formatting, Undo, Redo, View History
 * Story 6.5: Platform-aware keyboard shortcuts in tooltips
 */
function EditorToolbar({ editor, onViewHistory }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <Tooltip content={`Bold (${SHORTCUTS.BOLD})`}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`toolbar-button ${editor.isActive("bold") ? "toolbar-button--active" : ""}`}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          <strong>B</strong>
        </button>
      </Tooltip>

      <Tooltip content={`Italic (${SHORTCUTS.ITALIC})`}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`toolbar-button ${editor.isActive("italic") ? "toolbar-button--active" : ""}`}
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
        >
          <em>I</em>
        </button>
      </Tooltip>

      <span className="toolbar-divider" aria-hidden="true" />

      <Tooltip content="Bullet List">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          className={`toolbar-button ${editor.isActive("bulletList") ? "toolbar-button--active" : ""}`}
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
        >
          •
        </button>
      </Tooltip>

      <Tooltip content="Numbered List">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          className={`toolbar-button ${editor.isActive("orderedList") ? "toolbar-button--active" : ""}`}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          1.
        </button>
      </Tooltip>

      <span className="toolbar-divider" aria-hidden="true" />

      <Tooltip content="Clear Formatting">
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="toolbar-button"
          aria-label="Clear formatting"
        >
          ⊘
        </button>
      </Tooltip>

      <span className="toolbar-divider" aria-hidden="true" />

      <Tooltip content={`Undo (${SHORTCUTS.UNDO})`}>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="toolbar-button"
          aria-label="Undo"
        >
          ↶
        </button>
      </Tooltip>

      <Tooltip content={`Redo (${SHORTCUTS.REDO})`}>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="toolbar-button"
          aria-label="Redo"
        >
          ↷
        </button>
      </Tooltip>

      {onViewHistory && (
        <>
          <span className="toolbar-divider" aria-hidden="true" />
          <Tooltip content="View History">
            <button
              type="button"
              onClick={onViewHistory}
              className="toolbar-button"
              aria-label="View revision history"
            >
              📋
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}

export default EditorToolbar;
