// Tests for ProposalHistoryList component (Story 8.7)
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ProposalHistoryList } from './ProposalHistoryList';
import type { ProposalHistoryResponse } from './types';

// Mock react-window
vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemKey }: any) => {
    const itemsToRender = Math.min(itemCount, 10);
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: itemsToRender }).map((_, index) => {
          const key = itemKey ? itemKey(index) : index;
          return (
            <div key={key}>
              {children({ index, style: { top: index * 72, height: 72 } })}
            </div>
          );
        })}
      </div>
    );
  },
}));

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('ProposalHistoryList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    mockInvoke.mockClear();

    // Mock window dimensions
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

  it('shows loading skeleton initially', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ProposalHistoryList />, { wrapper });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders virtualized list with proposals (AC-1)', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        jobExcerpt: `Job ${i + 1}`,
        previewText: `Preview ${i + 1}`,
        createdAt: new Date().toISOString(),
      })),
      totalCount: 100,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    render(<ProposalHistoryList />, { wrapper });

    // Wait for data to load
    await screen.findByText('Job 1');

    // AC-1: Should only render ~10 items (mocked limit), not all 100
    const cards = screen.getAllByRole('button');
    expect(cards.length).toBeLessThan(20);
  });

  it('shows empty state when no proposals exist', async () => {
    const emptyResponse: ProposalHistoryResponse = {
      proposals: [],
      totalCount: 0,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(emptyResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText(/No proposals yet/);
    expect(screen.getByText(/Create your first proposal/)).toBeInTheDocument();
  });

  it('integrates with VirtualizedList component', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: [
        { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: new Date().toISOString() },
        { id: 2, jobExcerpt: 'Job 2', previewText: 'Preview 2', createdAt: new Date().toISOString() },
      ],
      totalCount: 2,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    const { container } = render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(container.querySelector('[data-testid="virtualized-list"]')).toBeInTheDocument();
  });

  it('uses correct row height (72px) (AC-1)', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: [
        { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: new Date().toISOString() },
      ],
      totalCount: 1,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    const { container } = render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const card = container.querySelector('.proposal-history-card') as HTMLElement;
    expect(card.style.height).toBe('72px');
  });

  it('displays all proposal data correctly', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: [
        {
          id: 1,
          jobExcerpt: 'Looking for React developer',
          previewText: 'I am excited to apply',
          createdAt: new Date().toISOString(),
        },
      ],
      totalCount: 1,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Looking for React developer');
    expect(screen.getByText(/I am excited to apply/)).toBeInTheDocument();
  });

  it('handles window resize', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: [
        { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: new Date().toISOString() },
      ],
      totalCount: 1,
      hasMore: false,
    };

    mockInvoke.mockResolvedValue(mockResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    // Simulate resize
    window.innerWidth = 1920;
    window.dispatchEvent(new Event('resize'));

    // Component should still render
    expect(screen.getByText('Job 1')).toBeInTheDocument();
  });
});
