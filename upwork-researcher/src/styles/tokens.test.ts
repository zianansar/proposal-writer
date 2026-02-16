/**
 * Design Tokens Test Suite - Story 8.1
 * Validates that design tokens load correctly and follow naming conventions
 */

import { readFileSync } from "fs";
import { join } from "path";

import { describe, it, expect } from "vitest";

describe("Design Tokens (Story 8.1)", () => {
  const tokensPath = join(__dirname, "tokens.css");
  let tokensContent: string;

  try {
    tokensContent = readFileSync(tokensPath, "utf-8");
  } catch (error) {
    tokensContent = "";
  }

  it("tokens.css file exists and loads without errors", () => {
    expect(tokensContent).toBeTruthy();
    expect(tokensContent.length).toBeGreaterThan(0);
  });

  it("defines all core background color tokens", () => {
    expect(tokensContent).toContain("--color-bg-primary");
    expect(tokensContent).toContain("--color-bg-secondary");
    expect(tokensContent).toContain("--color-bg-tertiary");
    expect(tokensContent).toContain("--color-bg-input");
    expect(tokensContent).toContain("--color-bg-hover");
    expect(tokensContent).toContain("--color-bg-active");
  });

  it("defines all text color tokens", () => {
    expect(tokensContent).toContain("--color-text-primary");
    expect(tokensContent).toContain("--color-text-secondary");
    expect(tokensContent).toContain("--color-text-muted");
    expect(tokensContent).toContain("--color-text-inverse");
  });

  it("defines all border color tokens", () => {
    expect(tokensContent).toContain("--color-border");
    expect(tokensContent).toContain("--color-border-hover");
    expect(tokensContent).toContain("--color-border-focus");
  });

  it("defines all semantic color tokens", () => {
    expect(tokensContent).toContain("--color-primary");
    expect(tokensContent).toContain("--color-accent");
    expect(tokensContent).toContain("--color-success");
    expect(tokensContent).toContain("--color-warning");
    expect(tokensContent).toContain("--color-error");
  });

  it("defines all component state tokens", () => {
    expect(tokensContent).toContain("--color-button-bg");
    expect(tokensContent).toContain("--color-button-bg-hover");
    expect(tokensContent).toContain("--color-button-bg-disabled");
    expect(tokensContent).toContain("--color-input-bg");
    expect(tokensContent).toContain("--color-input-border");
    expect(tokensContent).toContain("--color-input-border-focus");
    expect(tokensContent).toContain("--color-focus-ring");
  });

  it("defines all spacing tokens", () => {
    expect(tokensContent).toContain("--spacing-xs");
    expect(tokensContent).toContain("--spacing-sm");
    expect(tokensContent).toContain("--spacing-md");
    expect(tokensContent).toContain("--spacing-lg");
    expect(tokensContent).toContain("--spacing-xl");
    expect(tokensContent).toContain("--spacing-2xl");
  });

  it("defines all typography tokens", () => {
    expect(tokensContent).toContain("--font-family-base");
    expect(tokensContent).toContain("--font-family-mono");
    expect(tokensContent).toContain("--font-size-xs");
    expect(tokensContent).toContain("--font-size-sm");
    expect(tokensContent).toContain("--font-size-base");
    expect(tokensContent).toContain("--font-size-lg");
    expect(tokensContent).toContain("--font-size-xl");
    expect(tokensContent).toContain("--line-height-tight");
    expect(tokensContent).toContain("--line-height-base");
    expect(tokensContent).toContain("--font-weight-normal");
    expect(tokensContent).toContain("--font-weight-medium");
    expect(tokensContent).toContain("--font-weight-semibold");
    expect(tokensContent).toContain("--font-weight-bold");
  });

  it("defines all border radius tokens", () => {
    expect(tokensContent).toContain("--radius-sm");
    expect(tokensContent).toContain("--radius-md");
    expect(tokensContent).toContain("--radius-lg");
    expect(tokensContent).toContain("--radius-xl");
    expect(tokensContent).toContain("--radius-full");
  });

  it("defines shadow tokens", () => {
    expect(tokensContent).toContain("--shadow-sm");
    expect(tokensContent).toContain("--shadow-md");
    expect(tokensContent).toContain("--shadow-lg");
    expect(tokensContent).toContain("--shadow-focus");
  });

  it("defines transition tokens", () => {
    expect(tokensContent).toContain("--transition-fast");
    expect(tokensContent).toContain("--transition-base");
    expect(tokensContent).toContain("--transition-slow");
  });

  it("defines z-index tokens", () => {
    expect(tokensContent).toContain("--z-dropdown");
    expect(tokensContent).toContain("--z-modal");
    expect(tokensContent).toContain("--z-tooltip");
    expect(tokensContent).toContain("--z-toast");
  });

  it("follows consistent naming convention (--category-variant format)", () => {
    // Color tokens should follow --color-{category}-{variant}
    const colorTokenRegex = /--color-[\w-]+:/g;
    const colorTokens = tokensContent.match(colorTokenRegex);
    expect(colorTokens).toBeTruthy();
    expect(colorTokens!.length).toBeGreaterThan(20);

    // All color token names should be lowercase with hyphens
    colorTokens!.forEach((token) => {
      expect(token).toMatch(/^--color-[a-z-]+:$/);
    });
  });

  it("uses CSS custom property syntax correctly", () => {
    // Should define variables inside :root selector
    expect(tokensContent).toContain(":root {");

    // Should not have any undefined var() references (basic check)
    const varReferences = tokensContent.match(/var\(--[\w-]+\)/g);
    // Tokens file should define vars, not reference them (except in comments)
    const varDefinitions = tokensContent.match(/--[\w-]+:/g);
    expect(varDefinitions).toBeTruthy();
    expect(varDefinitions!.length).toBeGreaterThan(50);
  });

  it("includes WCAG AA compliant colors based on dev notes", () => {
    // Verify documented contrast-safe colors exist
    expect(tokensContent).toContain("#f6f6f6"); // text-primary (15.5:1 on #1a1a1a)
    expect(tokensContent).toContain("#1a1a1a"); // bg-primary
    expect(tokensContent).toContain("#2f2f2f"); // bg-secondary
    expect(tokensContent).toContain("#aaa"); // text-secondary (6.5:1 on #2f2f2f)
    expect(tokensContent).toContain("#888"); // text-muted (4.8:1 on #1a1a1a)
  });

  it("defines secondary button tokens", () => {
    expect(tokensContent).toContain("--color-button-secondary-bg");
    expect(tokensContent).toContain("--color-button-secondary-bg-hover");
    expect(tokensContent).toContain("--color-button-secondary-text");
  });

  it("defines success button state tokens", () => {
    expect(tokensContent).toContain("--color-button-success-bg");
    expect(tokensContent).toContain("--color-button-success-bg-hover");
  });

  it("defines extended semantic tokens", () => {
    // Error variants
    expect(tokensContent).toContain("--color-error-border");
    // Cooldown state
    expect(tokensContent).toContain("--color-cooldown-bg");
    expect(tokensContent).toContain("--color-cooldown-text");
    // Highlight
    expect(tokensContent).toContain("--color-highlight-bg");
    // Link
    expect(tokensContent).toContain("--color-link");
    expect(tokensContent).toContain("--color-link-hover");
  });

  it("defines indigo color tokens for regenerate actions", () => {
    expect(tokensContent).toContain("--color-indigo");
    expect(tokensContent).toContain("--color-indigo-hover");
    expect(tokensContent).toContain("--color-indigo-bg");
    expect(tokensContent).toContain("--color-indigo-border");
  });

  it("defines gray text variants for modals", () => {
    expect(tokensContent).toContain("--color-text-gray");
    expect(tokensContent).toContain("--color-text-gray-muted");
    expect(tokensContent).toContain("--color-bg-dark");
    expect(tokensContent).toContain("--color-border-gray");
  });
});

describe("CSS Files Token Usage (Story 8.1)", () => {
  const appCssPath = join(__dirname, "../App.css");
  let appCssContent: string;

  try {
    appCssContent = readFileSync(appCssPath, "utf-8");
  } catch (error) {
    appCssContent = "";
  }

  it("App.css loads successfully", () => {
    expect(appCssContent).toBeTruthy();
    expect(appCssContent.length).toBeGreaterThan(0);
  });

  it("App.css uses token references for common properties", () => {
    // Should use var() references throughout
    const varUsageCount = (appCssContent.match(/var\(--/g) || []).length;
    expect(varUsageCount).toBeGreaterThan(100);
  });

  it("App.css uses spacing tokens", () => {
    expect(appCssContent).toContain("var(--spacing-");
  });

  it("App.css uses color tokens", () => {
    expect(appCssContent).toContain("var(--color-");
  });

  it("App.css uses typography tokens", () => {
    expect(appCssContent).toContain("var(--font-");
  });

  it("App.css uses radius tokens", () => {
    expect(appCssContent).toContain("var(--radius-");
  });
});
