import { Editor } from "@tiptap/react";

/**
 * Block types for tracking separator logic
 */
type BlockType = "paragraph" | "heading" | "listItem" | "other";

/**
 * Extracts plain text from TipTap editor with list formatting preserved.
 * - Bullet lists: "• item" (single newline between items)
 * - Numbered lists: "1. item" (single newline between items)
 * - Paragraphs: separated by double newline
 * - Double newline between different block types (e.g., paragraph to list)
 * - HTML tags and formatting markers stripped
 *
 * @param editor - TipTap Editor instance
 * @returns Plain text representation with formatting
 */
export function getPlainTextFromEditor(editor: Editor): string {
  const doc = editor.state.doc;
  const blocks: Array<{ text: string; type: BlockType }> = [];
  let listCounter = 0;
  let currentListType: string | null = null;

  // _pos parameter unused - ProseMirror API requires it but we only need node and parent
  doc.descendants((node, _pos, parent) => {
    if (node.isBlock) {
      const parentType = parent?.type.name;

      if (node.type.name === "listItem") {
        const text = node.textContent.trim();
        if (!text) return false; // Skip empty list items

        if (parentType === "bulletList") {
          blocks.push({ text: `• ${text}`, type: "listItem" });
        } else if (parentType === "orderedList") {
          // Reset counter when entering a new ordered list
          if (currentListType !== "orderedList") {
            listCounter = 0;
            currentListType = "orderedList";
          }
          listCounter++;
          blocks.push({ text: `${listCounter}. ${text}`, type: "listItem" });
        }
        return false; // Don't descend into list item children
      } else if (node.type.name === "paragraph") {
        const text = node.textContent.trim();
        if (text) {
          blocks.push({ text, type: "paragraph" });
        }
        // Reset list tracking when not in a list
        if (parentType !== "orderedList") {
          currentListType = null;
        }
      } else if (node.type.name === "heading") {
        const text = node.textContent.trim();
        if (text) {
          blocks.push({ text, type: "heading" });
        }
        // Reset list tracking
        currentListType = null;
      } else if (node.type.name === "bulletList" || node.type.name === "orderedList") {
        // Reset counter when entering a new ordered list
        if (node.type.name === "orderedList") {
          listCounter = 0;
          currentListType = "orderedList";
        } else {
          currentListType = "bulletList";
        }
      } else {
        // Reset list tracking for other block types
        currentListType = null;
      }
    }
    return true;
  });

  // Join blocks with appropriate separators:
  // - Single newline between consecutive list items
  // - Double newline between paragraphs, headings, or when transitioning block types
  if (blocks.length === 0) return "";

  let result = blocks[0].text;
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];

    // Single newline only when both are list items (consecutive list items)
    const useSingleNewline = prev.type === "listItem" && curr.type === "listItem";
    result += useSingleNewline ? "\n" : "\n\n";
    result += curr.text;
  }

  return result.trim();
}
