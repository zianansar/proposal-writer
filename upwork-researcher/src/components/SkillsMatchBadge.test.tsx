/**
 * SkillsMatchBadge Component Tests (Story 4b.2: Task 6)
 * Tests color coding, edge case messages, accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SkillsMatchBadge from './SkillsMatchBadge';

describe('SkillsMatchBadge', () => {
  // ==========================================
  // Subtask 6.11: Green color for >=75%
  // ==========================================
  it('displays green color class for percentage >= 75% (AC-2)', () => {
    render(<SkillsMatchBadge percentage={75} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--green');
    expect(badge).toHaveTextContent('75%');
  });

  it('displays green for 100%', () => {
    render(<SkillsMatchBadge percentage={100} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--green');
    expect(badge).toHaveTextContent('100%');
  });

  // ==========================================
  // Subtask 6.12: Yellow color for 50-74%
  // ==========================================
  it('displays yellow color class for percentage 50-74% (AC-2)', () => {
    render(<SkillsMatchBadge percentage={67} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--yellow');
    expect(badge).toHaveTextContent('67%');
  });

  it('displays yellow for exactly 50%', () => {
    render(<SkillsMatchBadge percentage={50} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--yellow');
  });

  it('displays yellow for 74%', () => {
    render(<SkillsMatchBadge percentage={74} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--yellow');
  });

  // ==========================================
  // Subtask 6.13: Red color for <50%
  // ==========================================
  it('displays red color class for percentage < 50% (AC-2)', () => {
    render(<SkillsMatchBadge percentage={25} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--red');
    expect(badge).toHaveTextContent('25%');
  });

  it('displays red for 0%', () => {
    render(<SkillsMatchBadge percentage={0} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--red');
    expect(badge).toHaveTextContent('0%');
  });

  it('displays red for 49%', () => {
    render(<SkillsMatchBadge percentage={49} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--red');
  });

  // ==========================================
  // Subtask 6.14: "Configure skills" message
  // ==========================================
  it('displays "Configure skills" message when reason is no-user-skills (AC-3)', () => {
    render(<SkillsMatchBadge percentage={null} reason="no-user-skills" />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--null');
    expect(badge).toHaveTextContent('Configure your skills in Settings to see match percentage');
  });

  // ==========================================
  // Subtask 6.15: "No skills detected" message
  // ==========================================
  it('displays "No skills detected" message when reason is no-job-skills (AC-3)', () => {
    render(<SkillsMatchBadge percentage={null} reason="no-job-skills" />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveClass('skills-match--null');
    expect(badge).toHaveTextContent('No skills detected in job post');
  });

  // ==========================================
  // Null percentage with no reason renders nothing
  // ==========================================
  it('renders nothing when percentage is null and no reason', () => {
    const { container } = render(<SkillsMatchBadge percentage={null} />);

    expect(container.firstChild).toBeNull();
  });

  // ==========================================
  // Accessibility: aria-label (NFR-14)
  // ==========================================
  it('has correct aria-label with percentage and fit level (NFR-14)', () => {
    render(<SkillsMatchBadge percentage={67} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Skills match percentage: 67%, moderate fit'
    );
  });

  it('has "strong fit" aria-label for >= 75%', () => {
    render(<SkillsMatchBadge percentage={80} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Skills match percentage: 80%, strong fit'
    );
  });

  it('has "weak fit" aria-label for < 50%', () => {
    render(<SkillsMatchBadge percentage={30} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Skills match percentage: 30%, weak fit'
    );
  });

  // ==========================================
  // Tooltip with matched/total counts
  // ==========================================
  it('shows tooltip with matched skill counts when provided', () => {
    render(
      <SkillsMatchBadge
        percentage={67}
        matchedCount={2}
        totalCount={3}
      />
    );

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute('title', '2 of 3 required skills matched');
  });

  it('shows default tooltip when counts not provided', () => {
    render(<SkillsMatchBadge percentage={67} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute('title', 'Skills match: 67%');
  });

  // ==========================================
  // Keyboard focusable (NFR-14)
  // ==========================================
  it('is keyboard focusable with tabIndex 0', () => {
    render(<SkillsMatchBadge percentage={67} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute('tabindex', '0');
  });

  // ==========================================
  // Role attribute for screen readers
  // ==========================================
  it('has role="status" for live region announcements', () => {
    render(<SkillsMatchBadge percentage={67} />);

    const badge = screen.getByTestId('skills-match-badge');
    expect(badge).toHaveAttribute('role', 'status');
  });

  // ==========================================
  // Label and value text
  // ==========================================
  it('displays "Skills Match:" label and percentage value', () => {
    render(<SkillsMatchBadge percentage={85.5} />);

    expect(screen.getByText('Skills Match:')).toBeInTheDocument();
    expect(screen.getByText('85.5%')).toBeInTheDocument();
  });

  // ==========================================
  // L2 Review Fix: NaN/Infinity guard
  // ==========================================
  it('renders nothing when percentage is NaN', () => {
    const { container } = render(<SkillsMatchBadge percentage={NaN} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when percentage is Infinity', () => {
    const { container } = render(<SkillsMatchBadge percentage={Infinity} />);
    expect(container.firstChild).toBeNull();
  });
});
