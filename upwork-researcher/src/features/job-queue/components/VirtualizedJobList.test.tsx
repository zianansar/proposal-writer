/**
 * Virtualized Job List tests - Story 4b.9 Task 10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VirtualizedJobList from './VirtualizedJobList';
import type { JobQueueItem } from '../types';

// Mock react-window FixedSizeList
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount }: any) => {
    // Render first 10 items for testing
    const itemsToRender = Math.min(itemCount, 10);
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: itemsToRender }).map((_, index) =>
          children({ index, style: { top: index * 132, height: 132 } })
        )}
      </div>
    );
  },
}));

// Mock window dimensions
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1440,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 1000,
  });
});

const createMockJob = (id: number): JobQueueItem => ({
  id,
  clientName: `Client ${id}`,
  jobTitle: `Job Title ${id}`,
  skillsMatchPercent: 75,
  clientQualityPercent: 80,
  overallScore: 85.0,
  scoreColor: 'green',
  createdAt: new Date().toISOString(),
});

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );
};

describe('VirtualizedJobList', () => {
  it('renders virtualized list with jobs', () => {
    const jobs = [createMockJob(1), createMockJob(2), createMockJob(3)];

    render(<VirtualizedJobList jobs={jobs} />, { wrapper: createWrapper() });

    // At least the first job should be visible
    expect(screen.getByText('Client 1')).toBeInTheDocument();
  });

  it('returns null when jobs array is empty', () => {
    const { container } = render(<VirtualizedJobList jobs={[]} />, { wrapper: createWrapper() });

    expect(container.firstChild).toBeNull();
  });

  it('renders JobCard components for visible jobs (AC-8)', () => {
    const jobs = Array.from({ length: 10 }, (_, i) => createMockJob(i + 1));

    render(<VirtualizedJobList jobs={jobs} />, { wrapper: createWrapper() });

    // First few jobs should be rendered (within viewport)
    expect(screen.getByText('Client 1')).toBeInTheDocument();
    expect(screen.getByText('Job Title 1')).toBeInTheDocument();
  });

  it('handles large job lists efficiently (NFR-2)', () => {
    // Create 1000 jobs to test virtualization
    const jobs = Array.from({ length: 1000 }, (_, i) => createMockJob(i + 1));

    const { container } = render(<VirtualizedJobList jobs={jobs} />, { wrapper: createWrapper() });

    // Only a subset of jobs should be rendered in DOM (virtualized)
    // react-window renders visible items + overscan (3 items above/below)
    const renderedCards = container.querySelectorAll('[role="button"]');

    // With 800px height and 132px per card, ~6 cards visible + 6 overscan = ~12 cards
    // Not all 1000 should be in DOM
    expect(renderedCards.length).toBeLessThan(20);
    expect(renderedCards.length).toBeGreaterThan(0);
  });

  it('applies correct styling to job cards', () => {
    const jobs = [createMockJob(1)];

    const { container } = render(<VirtualizedJobList jobs={jobs} />, { wrapper: createWrapper() });

    const listContainer = container.querySelector('.virtualized-job-list');
    expect(listContainer).toBeInTheDocument();
  });
});
