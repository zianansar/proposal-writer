/**
 * Job Card tests - Story 4b.9
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import JobCard from './JobCard';
import type { JobQueueItem } from '../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
  );
};

const mockJob: JobQueueItem = {
  id: 1,
  clientName: 'Acme Corp',
  jobTitle: 'Senior React Developer',
  skillsMatchPercent: 85,
  clientQualityPercent: 90,
  overallScore: 87.5,
  scoreColor: 'green',
  createdAt: new Date().toISOString(),
};

describe('JobCard', () => {
  it('displays all job information (AC-1, AC-6.2)', () => {
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('87.5')).toBeInTheDocument();
  });

  it('truncates long job titles to 50 chars (AC-6.2)', () => {
    const longJob = {
      ...mockJob,
      jobTitle: 'This is a very long job title that exceeds fifty characters and should be truncated',
    };

    render(<JobCard job={longJob} />, { wrapper: createWrapper() });

    const title = screen.getByText(/This is a very long job title that exceeds/);
    expect(title.textContent).toMatch(/\.\.\.$/);
    expect(title.textContent!.length).toBeLessThanOrEqual(50);
  });

  it('applies correct color class based on scoreColor (AC-2)', () => {
    const { container } = render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    const badge = container.querySelector('.score-badge');
    expect(badge).toHaveClass('score-green');
  });

  it('navigates to editor on click (AC-6.5)', () => {
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith('/editor/1');
  });

  it('handles keyboard activation with Enter key (AC-6.7)', () => {
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/editor/1');
  });

  it('handles keyboard activation with Space key (AC-6.7)', () => {
    mockNavigate.mockClear();
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ' });

    expect(mockNavigate).toHaveBeenCalledWith('/editor/1');
  });

  it('is keyboard accessible with tabIndex (AC-6.7)', () => {
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('role', 'button');
  });

  it('displays relative time format (AC-6.6)', () => {
    render(<JobCard job={mockJob} />, { wrapper: createWrapper() });

    // Should display something like "X seconds ago" or "X minutes ago"
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });

  it('handles null score gracefully', () => {
    const noScoreJob = {
      ...mockJob,
      overallScore: null,
      scoreColor: 'gray' as const,
    };

    render(<JobCard job={noScoreJob} />, { wrapper: createWrapper() });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles null percentages gracefully', () => {
    const noPercentJob = {
      ...mockJob,
      skillsMatchPercent: null,
      clientQualityPercent: null,
    };

    render(<JobCard job={noPercentJob} />, { wrapper: createWrapper() });

    // Should not crash, metrics section just won't have values
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});
