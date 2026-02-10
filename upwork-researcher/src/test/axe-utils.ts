import { axe, type AxeResults } from "vitest-axe";
import type { Result } from "axe-core";

/**
 * Axe-core configuration for WCAG AA compliance testing
 */
export const WCAG_AA_CONFIG = {
  rules: {
    // WCAG 2.1 Level AA - Color contrast
    "color-contrast": { enabled: true },
    // WCAG 2.1 Level A - Images must have alt text
    "image-alt": { enabled: true },
    // WCAG 2.1 Level A - Form elements must have labels
    label: { enabled: true },
    // WCAG 2.1 Level A - ARIA attributes
    "aria-allowed-attr": { enabled: true },
    "aria-required-attr": { enabled: true },
    "aria-valid-attr": { enabled: true },
    "aria-valid-attr-value": { enabled: true },
    // WCAG 2.1 Level A - Buttons must have accessible names
    "button-name": { enabled: true },
    // WCAG 2.1 Level A - Headings
    "empty-heading": { enabled: true },
    "heading-order": { enabled: true },
    // WCAG 2.1 Level A - Links must have accessible names
    "link-name": { enabled: true },
    // WCAG 2.1 Level A - List structure
    list: { enabled: true },
    listitem: { enabled: true },
    // WCAG 2.1 Level A - Landmark regions
    region: { enabled: true },
    // WCAG 2.1 Level A - Page must have a title
    "document-title": { enabled: true },
    // WCAG 2.1 Level A - HTML lang attribute
    "html-has-lang": { enabled: true },
  },
};

/**
 * Run axe accessibility audit with WCAG AA configuration
 */
export async function runAxeAudit(
  container: Element,
  config = WCAG_AA_CONFIG
): Promise<AxeResults> {
  return axe(container, config);
}

/**
 * Assert that there are no accessibility violations
 * Throws error with violation details if violations found
 */
export function assertNoViolations(results: AxeResults): void {
  if (results.violations.length > 0) {
    const violationSummary = formatViolations(results.violations);
    throw new Error(
      `Accessibility violations found:\n\n${violationSummary}`
    );
  }
}

/**
 * Format axe violations for readable error messages
 */
export function formatViolations(violations: Result[]): string {
  return violations
    .map(
      (violation) => `
Rule: ${violation.id} (${violation.impact})
Description: ${violation.description}
Help: ${violation.help}
Affected elements (${violation.nodes.length}):
${violation.nodes.map((node) => `  - ${node.html}`).join("\n")}
`
    )
    .join("\n" + "=".repeat(80) + "\n");
}

/**
 * Filter violations by impact level
 */
export function filterViolationsByImpact(
  results: AxeResults,
  impacts: Array<"critical" | "serious" | "moderate" | "minor">
): Result[] {
  return results.violations.filter((v) =>
    impacts.includes(v.impact as "critical" | "serious" | "moderate" | "minor")
  );
}

/**
 * Get violation counts by severity
 */
export function getViolationCounts(results: AxeResults): {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
} {
  const counts = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    total: results.violations.length,
  };

  results.violations.forEach((v) => {
    const impact = v.impact as "critical" | "serious" | "moderate" | "minor";
    if (impact in counts) {
      counts[impact]++;
    }
  });

  return counts;
}

/**
 * Generate an audit report summary
 */
export function generateAuditReport(results: AxeResults): string {
  const counts = getViolationCounts(results);

  return `
Accessibility Audit Report
${"=".repeat(80)}

Total Violations: ${counts.total}
- Critical: ${counts.critical}
- Serious: ${counts.serious}
- Moderate: ${counts.moderate}
- Minor: ${counts.minor}

Passes: ${results.passes.length}
Incomplete: ${results.incomplete.length}
Inapplicable: ${results.inapplicable.length}

${counts.total > 0 ? `\nViolations:\n${formatViolations(results.violations)}` : "✅ No violations found"}
`;
}
