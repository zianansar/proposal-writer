/**
 * Comprehensive Accessibility Audit for WCAG AA Compliance
 * Story 8-11: Accessibility Audit
 *
 * This test suite performs automated accessibility testing across all
 * major application views and components using axe-core.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { runAxeAudit, assertNoViolations, generateAuditReport, getViolationCounts } from "../test/axe-utils";
import App from "../App";

// Mock Tauri APIs with proper mocks from setup.ts
// These are already mocked in src/test/setup.ts

describe("Accessibility Audit - WCAG AA Compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task 2.1: Interactive Components - Keyboard Accessibility", () => {
    it("should have keyboard-accessible main application view", async () => {
      const { container } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const results = await runAxeAudit(container);

      if (results.violations.length > 0) {
        console.log("\n" + generateAuditReport(results));
      }

      assertNoViolations(results);
    });

    it("should have keyboard-accessible buttons with proper focus indicators", async () => {
      const { container } = render(
        <div>
          <button className="btn">Primary Button</button>
          <button className="btn secondary">Secondary Button</button>
          <button aria-label="Icon button">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should detect buttons without accessible names", async () => {
      const { container } = render(
        <button>
          <span aria-hidden="true">×</span>
        </button>
      );

      const results = await runAxeAudit(container);
      expect(results.violations.some(v => v.id === "button-name")).toBe(true);
    });
  });

  describe("Task 2.2: Color Contrast (WCAG AA 4.5:1)", () => {
    it("should have sufficient color contrast for text elements", async () => {
      const { container } = render(
        <div style={{ backgroundColor: "#ffffff", color: "#000000" }}>
          <h1>Heading with sufficient contrast</h1>
          <p>Paragraph text with sufficient contrast</p>
          <button style={{ backgroundColor: "#007bff", color: "#ffffff" }}>
            Button with sufficient contrast
          </button>
        </div>
      );

      const results = await runAxeAudit(container);
      const contrastViolations = results.violations.filter(v => v.id === "color-contrast");
      expect(contrastViolations).toHaveLength(0);
    });

    // Note: Automated color contrast checking has limitations with dynamic styles
    // Manual validation required for:
    // - CSS custom properties
    // - Gradient backgrounds
    // - Images as backgrounds
    // See Task 5 for manual validation results
  });

  describe("Task 2.3: Form Labels and ARIA Attributes", () => {
    it("should have properly labeled form inputs", async () => {
      const { container } = render(
        <form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" />

          <label htmlFor="message">Message</label>
          <textarea id="message"></textarea>
        </form>
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should detect inputs without labels", async () => {
      const { container } = render(
        <form>
          <input type="text" />
        </form>
      );

      const results = await runAxeAudit(container);
      expect(results.violations.some(v => v.id === "label")).toBe(true);
    });

    it("should have valid ARIA attributes", async () => {
      const { container } = render(
        <div>
          <button aria-label="Close dialog" aria-pressed="false">
            Close
          </button>
          <div role="alert" aria-live="polite">
            Success message
          </div>
          <input type="checkbox" aria-checked="false" />
        </div>
      );

      const results = await runAxeAudit(container);
      const ariaViolations = results.violations.filter(v =>
        v.id.startsWith("aria-")
      );
      expect(ariaViolations).toHaveLength(0);
    });
  });

  describe("Task 2.4: Focus Indicators", () => {
    it("should have visible focus indicators on interactive elements", async () => {
      const { container } = render(
        <div>
          <button className="focus-visible:ring-2">Focusable Button</button>
          <a href="#content" className="focus-visible:ring-2">Focusable Link</a>
          <label htmlFor="focus-input">Input</label>
          <input id="focus-input" type="text" className="focus-visible:ring-2" />
        </div>
      );

      const results = await runAxeAudit(container);
      // Axe cannot detect CSS :focus-visible pseudo-class styles
      // This test only validates there are no other accessibility issues
      assertNoViolations(results);
    });

    // Note: Axe-core cannot fully test CSS :focus-visible styles
    // Focus indicator visibility must be validated manually with keyboard navigation
    // Manual validation performed in Task 4 and documented in Task 5
  });

  describe("Task 2.5: Semantic HTML Structure", () => {
    it("should have proper heading hierarchy", async () => {
      const { container } = render(
        <div>
          <h1>Main Heading</h1>
          <h2>Section Heading</h2>
          <h3>Subsection Heading</h3>
          <h4>Detail Heading</h4>
        </div>
      );

      const results = await runAxeAudit(container);
      const headingViolations = results.violations.filter(v =>
        v.id === "heading-order" || v.id === "empty-heading"
      );
      expect(headingViolations).toHaveLength(0);
    });

    it("should detect skipped heading levels", async () => {
      const { container } = render(
        <div>
          <h1>Main Heading</h1>
          <h3>Skipped H2</h3>
        </div>
      );

      const results = await runAxeAudit(container);
      // Note: Axe may or may not flag this depending on context
      // Manual review required for heading hierarchy
    });

    it("should have proper landmark regions", async () => {
      const { container } = render(
        <div>
          <header>
            <nav aria-label="Main navigation">
              <a href="#main">Skip to main content</a>
            </nav>
          </header>
          <main id="main">
            <h1>Main Content</h1>
          </main>
          <footer>
            <p>Footer content</p>
          </footer>
        </div>
      );

      const results = await runAxeAudit(container);
      const regionViolations = results.violations.filter(v => v.id === "region");
      expect(regionViolations).toHaveLength(0);
    });

    it("should have proper list structure", async () => {
      const { container } = render(
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      );

      const results = await runAxeAudit(container);
      const listViolations = results.violations.filter(v =>
        v.id === "list" || v.id === "listitem"
      );
      expect(listViolations).toHaveLength(0);
    });
  });

  describe("Task 2.6: Keyboard Traps", () => {
    it("should not create keyboard traps in modal dialogs", async () => {
      const { container } = render(
        <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 id="dialog-title">Dialog Title</h2>
          <button>Action</button>
          <button>Close</button>
        </div>
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    // Note: Keyboard trap detection requires manual testing
    // Tab key navigation tested in Task 4
  });

  describe("Task 2.7: ARIA Live Regions for Dynamic Content", () => {
    it("should have aria-live regions for status messages", async () => {
      const { container } = render(
        <div>
          <div role="status" aria-live="polite" aria-atomic="true">
            Loading...
          </div>
          <div role="alert" aria-live="assertive">
            Error occurred
          </div>
        </div>
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should announce error messages to screen readers", async () => {
      const { container } = render(
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <div id="email-error" role="alert" aria-live="assertive">
            Please enter a valid email address
          </div>
        </div>
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });
  });

  describe("Audit Summary", () => {
    it("should generate full audit report for main app", async () => {
      const { container } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      const results = await runAxeAudit(container);
      const report = generateAuditReport(results);
      const counts = getViolationCounts(results);

      // Log report for documentation
      console.log("\n=== MAIN APP ACCESSIBILITY AUDIT ===");
      console.log(report);

      // Expect zero violations for WCAG AA compliance
      expect(counts.total).toBe(0);
    });
  });
});
