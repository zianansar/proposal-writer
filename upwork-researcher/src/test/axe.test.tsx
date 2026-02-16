import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  runAxeAudit,
  assertNoViolations,
  getViolationCounts,
  formatViolations,
  filterViolationsByImpact,
  generateAuditReport,
} from "./axe-utils";

describe("Axe Setup and Utilities", () => {
  describe("Basic axe functionality", () => {
    it("should detect accessibility violations", async () => {
      // Deliberately create an inaccessible component to verify axe is working
      const { container } = render(
        <div>
          {/* Button without accessible name - should fail */}
          <button></button>
          {/* Image without alt text - should fail */}
          <img src="test.jpg" />
        </div>,
      );

      const results = await runAxeAudit(container);

      // We EXPECT violations here (button-name, image-alt)
      expect(results.violations.length).toBeGreaterThan(0);
      expect(results.violations.some((v) => v.id === "button-name")).toBe(true);
      expect(results.violations.some((v) => v.id === "image-alt")).toBe(true);
    });

    it("should pass when component is accessible", async () => {
      const { container } = render(
        <div>
          <button aria-label="Test button">Click me</button>
          <img src="test.jpg" alt="Test image" />
        </div>,
      );

      const results = await runAxeAudit(container);
      assertNoViolations(results);
    });

    it("should validate fully accessible component", async () => {
      const { container } = render(
        <main>
          <h1>Accessible Page</h1>
          <button>Has text content</button>
          <label htmlFor="input">Name</label>
          <input id="input" type="text" />
        </main>,
      );

      const results = await runAxeAudit(container);
      expect(results.violations).toHaveLength(0);
      assertNoViolations(results);
    });
  });

  describe("Utility functions", () => {
    it("should count violations by severity", async () => {
      const { container } = render(
        <div>
          <button></button> {/* serious */}
          <img src="test.jpg" /> {/* critical/serious */}
        </div>,
      );

      const results = await runAxeAudit(container);
      const counts = getViolationCounts(results);

      expect(counts.total).toBeGreaterThan(0);
      expect(counts.critical + counts.serious).toBeGreaterThan(0);
    });

    it("should filter violations by impact", async () => {
      const { container } = render(
        <div>
          <button></button>
          <img src="test.jpg" />
        </div>,
      );

      const results = await runAxeAudit(container);
      const criticalAndSerious = filterViolationsByImpact(results, ["critical", "serious"]);

      expect(criticalAndSerious.length).toBeGreaterThan(0);
    });

    it("should format violations for error messages", async () => {
      const { container } = render(<button></button>);

      const results = await runAxeAudit(container);
      const formatted = formatViolations(results.violations);

      expect(formatted).toContain("button-name");
      expect(formatted).toContain("Affected elements");
    });

    it("should generate audit report", async () => {
      const { container } = render(
        <div>
          <button aria-label="Accessible">Click</button>
        </div>,
      );

      const results = await runAxeAudit(container);
      const report = generateAuditReport(results);

      expect(report).toContain("Accessibility Audit Report");
      expect(report).toContain("Total Violations: 0");
      expect(report).toContain("✅ No violations found");
    });

    it("should throw error on violations when using assertNoViolations", async () => {
      const { container } = render(<button></button>);

      const results = await runAxeAudit(container);

      expect(() => assertNoViolations(results)).toThrow(/Accessibility violations found/);
    });
  });
});
