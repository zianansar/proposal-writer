import type { Editor } from "@tiptap/react";

interface EditorToolbarProps {
  editor: Editor | null;
}

/**
 * Formatting toolbar for TipTap editor (Story 6.1)
 * Provides: Bold, Italic, Bullet List, Numbered List, Clear Formatting, Undo, Redo
 */
function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`toolbar-button ${editor.isActive("bold") ? "toolbar-button--active" : ""}`}
        aria-label="Bold"
        aria-pressed={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`toolbar-button ${editor.isActive("italic") ? "toolbar-button--active" : ""}`}
        aria-label="Italic"
        aria-pressed={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>

      <span className="toolbar-divider" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        disabled={!editor.can().chain().focus().toggleBulletList().run()}
        className={`toolbar-button ${editor.isActive("bulletList") ? "toolbar-button--active" : ""}`}
        aria-label="Bullet list"
        aria-pressed={editor.isActive("bulletList")}
        title="Bullet List"
      >
        •
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        className={`toolbar-button ${editor.isActive("orderedList") ? "toolbar-button--active" : ""}`}
        aria-label="Numbered list"
        aria-pressed={editor.isActive("orderedList")}
        title="Numbered List"
      >
        1.
      </button>

      <span className="toolbar-divider" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        className="toolbar-button"
        aria-label="Clear formatting"
        title="Clear Formatting"
      >
        ⊘
      </button>

      <span className="toolbar-divider" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="toolbar-button"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        ↶
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="toolbar-button"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        ↷
      </button>
    </div>
  );
}

export default EditorToolbar;
