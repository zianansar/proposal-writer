import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getPlainTextFromEditor } from './editorUtils';

describe('getPlainTextFromEditor', () => {
  const createEditor = (content: string) => {
    return new Editor({
      extensions: [StarterKit],
      content,
    });
  };

  it('extracts plain text from single paragraph', () => {
    const editor = createEditor('<p>Hello world</p>');
    expect(getPlainTextFromEditor(editor)).toBe('Hello world');
    editor.destroy();
  });

  it('separates multiple paragraphs with double newline', () => {
    const editor = createEditor('<p>First paragraph</p><p>Second paragraph</p>');
    expect(getPlainTextFromEditor(editor)).toBe('First paragraph\n\nSecond paragraph');
    editor.destroy();
  });

  it('formats bullet list with "• " prefix and single newlines between items', () => {
    const editor = createEditor('<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>');
    expect(getPlainTextFromEditor(editor)).toBe('• Item 1\n• Item 2\n• Item 3');
    editor.destroy();
  });

  it('formats numbered list with "1. 2. 3." prefix and single newlines between items', () => {
    const editor = createEditor('<ol><li>First</li><li>Second</li><li>Third</li></ol>');
    expect(getPlainTextFromEditor(editor)).toBe('1. First\n2. Second\n3. Third');
    editor.destroy();
  });

  it('handles mixed content (paragraphs and lists) with appropriate spacing', () => {
    const editor = createEditor(
      '<p>Introduction</p><ul><li>Point 1</li><li>Point 2</li></ul><p>Conclusion</p>'
    );
    // Double newline between paragraph and list, single newline between list items
    const expected = 'Introduction\n\n• Point 1\n• Point 2\n\nConclusion';
    expect(getPlainTextFromEditor(editor)).toBe(expected);
    editor.destroy();
  });

  it('strips bold and italic formatting markers', () => {
    const editor = createEditor('<p><strong>Bold</strong> and <em>italic</em> text</p>');
    expect(getPlainTextFromEditor(editor)).toBe('Bold and italic text');
    editor.destroy();
  });

  it('returns empty string for empty document', () => {
    const editor = createEditor('');
    expect(getPlainTextFromEditor(editor)).toBe('');
    editor.destroy();
  });

  it('handles whitespace-only document', () => {
    const editor = createEditor('<p>   </p>');
    expect(getPlainTextFromEditor(editor)).toBe('');
    editor.destroy();
  });

  it('handles nested lists (nested content appended to parent item)', () => {
    const editor = createEditor(
      '<ul><li>Item 1<ul><li>Nested item</li></ul></li><li>Item 2</li></ul>'
    );
    // TipTap's textContent concatenates nested content with parent item text
    // This is TipTap's default behavior - nested items are not separated
    const result = getPlainTextFromEditor(editor);
    // Parent item contains its text plus nested content (concatenated)
    expect(result).toContain('• Item 1');
    expect(result).toContain('Item 2');
    // Verify we get at least 2 bullet points (parent items at top level)
    expect(result.match(/• /g)?.length).toBeGreaterThanOrEqual(2);
    editor.destroy();
  });

  it('resets numbered list counter between lists', () => {
    const editor = createEditor(
      '<ol><li>First list item 1</li></ol><p>Separator</p><ol><li>Second list item 1</li></ol>'
    );
    const result = getPlainTextFromEditor(editor);
    // Both lists should start with "1." since counter resets
    expect(result).toContain('1. First list item 1');
    expect(result).toContain('1. Second list item 1');
    // Verify double newlines between different block types
    expect(result).toBe('1. First list item 1\n\nSeparator\n\n1. Second list item 1');
    editor.destroy();
  });

  it('preserves text content from headings', () => {
    const editor = createEditor('<h1>Heading 1</h1><p>Content</p><h2>Heading 2</h2>');
    expect(getPlainTextFromEditor(editor)).toBe('Heading 1\n\nContent\n\nHeading 2');
    editor.destroy();
  });
});
