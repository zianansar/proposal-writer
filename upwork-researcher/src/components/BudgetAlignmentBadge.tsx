/**
 * Story 4b.4: Budget Alignment Display
 *
 * AC-2: Color-coded badge showing budget alignment percentage
 * - Green (>=100%): #22c55e — Budget meets or exceeds your rate
 * - Yellow (70-99%): #eab308 — Budget slightly below your rate
 * - Red (<70%): #ef4444 — Budget significantly below your rate
 * - Gray (unknown/mismatch): #6b7280 — Cannot calculate alignment
 * NFR-14: Accessible with aria-label, tooltip, keyboard focus
 */

import './BudgetAlignmentBadge.css';

interface BudgetAlignmentBadgeProps {
  percentage: number | null;
  status: 'green' | 'yellow' | 'red' | 'gray' | 'mismatch' | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetType: 'hourly' | 'fixed' | 'unknown';
  userHourlyRate?: number | null;
  userProjectRateMin?: number | null;
}

/** Get human-readable tooltip based on status and values */
function getTooltipText(
  status: string | null,
  budgetType: string,
  budgetMin: number | null,
  budgetMax: number | null,
  userHourlyRate?: number | null,
  userProjectRateMin?: number | null
): string {
  if (status === 'mismatch') {
    if (budgetType === 'hourly') {
      return "Job is hourly but you haven't configured an hourly rate in Settings";
    }
    if (budgetType === 'fixed') {
      return "Job is fixed-price but you haven't configured a project rate in Settings";
    }
    return "Budget type doesn't match your configured rates";
  }

  if (status === 'gray' || budgetType === 'unknown') {
    return 'Budget not mentioned in job post';
  }

  // Format budget display
  const formatBudget = (min: number | null, max: number | null, type: string): string => {
    if (min === null) return 'Unknown';
    const suffix = type === 'hourly' ? '/hr' : ' fixed';
    if (max !== null && max !== min) {
      return `$${min}-$${max}${suffix}`;
    }
    return `$${min}${suffix}`;
  };

  const budgetStr = formatBudget(budgetMin, budgetMax, budgetType);

  if (budgetType === 'hourly' && userHourlyRate) {
    return `Job budget: ${budgetStr}, Your rate: $${userHourlyRate}/hr`;
  }
  if (budgetType === 'fixed' && userProjectRateMin) {
    return `Job budget: ${budgetStr}, Your minimum: $${userProjectRateMin}+ projects`;
  }

  return `Job budget: ${budgetStr}`;
}

/** Get accessibility label */
function getAriaLabel(percentage: number | null, status: string | null): string {
  if (status === 'mismatch') {
    return 'Budget alignment: Type mismatch';
  }
  if (status === 'gray' || percentage === null) {
    return 'Budget alignment: Unknown';
  }

  const qualityDesc = status === 'green'
    ? 'meets your rate expectations'
    : status === 'yellow'
    ? 'slightly below your rate'
    : 'significantly below your rate';

  return `Budget alignment: ${percentage} percent, ${qualityDesc}`;
}

export default function BudgetAlignmentBadge({
  percentage,
  status,
  budgetMin,
  budgetMax,
  budgetType,
  userHourlyRate,
  userProjectRateMin,
}: BudgetAlignmentBadgeProps) {
  // No rates configured - show message
  if (!userHourlyRate && !userProjectRateMin && budgetType !== 'unknown') {
    return (
      <div
        className="budget-alignment budget-alignment--no-config"
        data-testid="budget-alignment-badge"
        aria-label="Budget alignment: Configure rates in Settings to see alignment"
      >
        <span className="budget-alignment__message">
          Configure rates in Settings
        </span>
      </div>
    );
  }

  // Unknown budget or null status
  if (status === null || status === 'gray' || budgetType === 'unknown') {
    return (
      <div
        className="budget-alignment budget-alignment--gray"
        data-testid="budget-alignment-badge"
        aria-label="Budget alignment: Unknown"
        title="Budget not mentioned in job post"
        tabIndex={0}
        role="status"
      >
        <span className="budget-alignment__label">Budget:</span>
        <span className="budget-alignment__value">Unknown</span>
      </div>
    );
  }

  // Type mismatch
  if (status === 'mismatch') {
    return (
      <div
        className="budget-alignment budget-alignment--gray"
        data-testid="budget-alignment-badge"
        aria-label="Budget alignment: Type mismatch"
        title={getTooltipText(status, budgetType, budgetMin, budgetMax, userHourlyRate, userProjectRateMin)}
        tabIndex={0}
        role="status"
      >
        <span className="budget-alignment__label">Budget:</span>
        <span className="budget-alignment__value">Type Mismatch</span>
      </div>
    );
  }

  // Normal case - show percentage with color
  const colorClass = `budget-alignment--${status}`;
  const tooltip = getTooltipText(status, budgetType, budgetMin, budgetMax, userHourlyRate, userProjectRateMin);
  const ariaLabel = getAriaLabel(percentage, status);

  return (
    <div
      className={`budget-alignment ${colorClass}`}
      data-testid="budget-alignment-badge"
      aria-label={ariaLabel}
      title={tooltip}
      tabIndex={0}
      role="status"
    >
      <span className="budget-alignment__label">Budget Alignment:</span>
      <span className="budget-alignment__value">{percentage}%</span>
      {status === 'red' && (
        <span className="budget-alignment__warning" aria-label="Low budget">
          Below rate
        </span>
      )}
    </div>
  );
}
