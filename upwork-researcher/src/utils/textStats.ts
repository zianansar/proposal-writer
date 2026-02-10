/**
 * Count characters in text (including spaces and special characters)
 */
export function countCharacters(text: string): number {
  return text.length;
}

/**
 * Count words in text
 * - Splits on whitespace (spaces, tabs, newlines)
 * - Filters empty strings
 * - Handles edge cases (empty, whitespace-only)
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
}
