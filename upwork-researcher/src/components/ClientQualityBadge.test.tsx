/**
 * ClientQualityBadge Component Tests (Story 4b.3: Task 5)
 * Tests color coding, warning badge, null handling, accessibility
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientQualityBadge from './ClientQualityBadge';

describe('ClientQualityBadge', () => {
  // ==========================================
  // Subtask 5.9: Green color for >=80
  // ==========================================
  it('displays green color class for score >= 80 (AC-2)', () => {
    render(<ClientQualityBadge score={85} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--green');
    expect(badge).toHaveTextContent('85');
  });

  it('displays green for exactly 80', () => {
    render(<ClientQualityBadge score={80} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--green');
  });

  it('displays green for 100', () => {
    render(<ClientQualityBadge score={100} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--green');
    expect(badge).toHaveTextContent('100');
  });

  // ==========================================
  // Subtask 5.10: Yellow color for 60-79
  // ==========================================
  it('displays yellow color class for score 60-79 (AC-2)', () => {
    render(<ClientQualityBadge score={70} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--yellow');
    expect(badge).toHaveTextContent('70');
  });

  it('displays yellow for exactly 60', () => {
    render(<ClientQualityBadge score={60} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--yellow');
  });

  it('displays yellow for 79', () => {
    render(<ClientQualityBadge score={79} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--yellow');
  });

  // ==========================================
  // Subtask 5.11: Red color with warning badge for <60
  // ==========================================
  it('displays red color class for score < 60 (AC-2)', () => {
    render(<ClientQualityBadge score={45} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--red');
    expect(badge).toHaveTextContent('45');
  });

  it('displays red for 0', () => {
    render(<ClientQualityBadge score={0} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--red');
  });

  it('displays red for 59', () => {
    render(<ClientQualityBadge score={59} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--red');
  });

  it('shows warning badge for scores < 60 (AC-2)', () => {
    render(<ClientQualityBadge score={45} />);

    expect(screen.getByText(/High risk client/)).toBeInTheDocument();
  });

  it('does not show warning badge for scores >= 60', () => {
    render(<ClientQualityBadge score={65} />);

    expect(screen.queryByText(/High risk client/)).not.toBeInTheDocument();
  });

  it('does not show warning badge for scores >= 80', () => {
    render(<ClientQualityBadge score={90} />);

    expect(screen.queryByText(/High risk client/)).not.toBeInTheDocument();
  });

  // ==========================================
  // Subtask 5.12: "Not available" when score is null
  // ==========================================
  it('displays "Not available" when score is null (AC-2)', () => {
    render(<ClientQualityBadge score={null} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveClass('client-quality--null');
    expect(badge).toHaveTextContent('Not available');
  });

  it('has aria-label for null state (NFR-14)', () => {
    render(<ClientQualityBadge score={null} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Client quality score: Not available'
    );
  });

  // ==========================================
  // Accessibility: aria-label (NFR-14)
  // ==========================================
  it('has correct aria-label with score and quality level (NFR-14)', () => {
    render(<ClientQualityBadge score={85} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Client quality score: 85, high quality'
    );
  });

  it('has "medium quality" aria-label for 60-79', () => {
    render(<ClientQualityBadge score={70} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Client quality score: 70, medium quality'
    );
  });

  it('has "high risk" aria-label for < 60', () => {
    render(<ClientQualityBadge score={45} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute(
      'aria-label',
      'Client quality score: 45, high risk'
    );
  });

  // ==========================================
  // Tooltip (NFR-14)
  // ==========================================
  it('has tooltip explaining score interpretation', () => {
    render(<ClientQualityBadge score={85} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute(
      'title',
      'Estimated quality based on job post signals. 80+ = high quality, 60-79 = medium, <60 = high risk'
    );
  });

  // ==========================================
  // Keyboard focusable (NFR-14)
  // ==========================================
  it('is keyboard focusable with tabIndex 0', () => {
    render(<ClientQualityBadge score={85} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute('tabindex', '0');
  });

  // ==========================================
  // Role attribute for screen readers
  // ==========================================
  it('has role="status" for live region announcements', () => {
    render(<ClientQualityBadge score={85} />);

    const badge = screen.getByTestId('client-quality-badge');
    expect(badge).toHaveAttribute('role', 'status');
  });

  // ==========================================
  // Label and value text
  // ==========================================
  it('displays "Client Quality:" label and integer score', () => {
    render(<ClientQualityBadge score={85} />);

    expect(screen.getByText('Client Quality:')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});
