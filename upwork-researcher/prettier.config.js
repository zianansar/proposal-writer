/**
 * Prettier configuration
 *
 * Note: Using double quotes (singleQuote: false) to match existing codebase style
 * Architecture spec mentioned single quotes, but all existing code uses double quotes
 */
export default {
  // Indentation
  tabWidth: 2,
  useTabs: false,

  // Quotes - IMPORTANT: match existing code (double quotes)
  singleQuote: false,

  // Trailing commas
  trailingComma: "all",

  // Semicolons
  semi: true,

  // Line width
  printWidth: 100,

  // End of line
  endOfLine: "lf",
};
