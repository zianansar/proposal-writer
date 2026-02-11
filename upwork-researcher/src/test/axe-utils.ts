import { axe, type AxeResults } from "vitest-axe";
import type { Result, RunOptions } from "axe-core";

/**
 * Axe-core configuration for WCAG AA compliance testing
 *
 * Uses tag-based filtering which automatically includes all rules for
 * WCAG 2.0 Level A, WCAG 2.0 Level AA, WCAG 2.1 Level A, and WCAG 2.1 Level AA
 * -- covering 80+ rules instead of an explicit subset.
 */
export const WCAG_AA_CONFIG: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
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
