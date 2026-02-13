// Tests for ProposalHistoryList component (Story 8.7 + Story 7.2 + Story 7.3)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
        mutations: {
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
      {children}
    </QueryClientProvider>
  );

  const singleProposalResponse: ProposalHistoryResponse = {
    proposals: [
      { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: new Date().toISOString(), outcomeStatus: 'pending', hookStrategyId: null },
    ],
    totalCount: 1,
    hasMore: false,
  };

  // Helper: mock invoke to handle proposal history + hook strategies + mutations
  const mockDefaultInvoke = (proposalResponse: ProposalHistoryResponse = singleProposalResponse) => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_proposal_history') return Promise.resolve(proposalResponse);
      if (cmd === 'search_proposals') return Promise.resolve(proposalResponse);
      if (cmd === 'get_distinct_hook_strategies') return Promise.resolve([]);
      if (cmd === 'update_proposal_outcome') return Promise.resolve({ success: true });
      return Promise.resolve({});
    });
  };

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
        outcomeStatus: 'pending' as const,
        hookStrategyId: null,
      })),
      totalCount: 100,
      hasMore: false,
    };

    mockDefaultInvoke(mockResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const cards = document.querySelectorAll('.proposal-history-card');
    expect(cards.length).toBeLessThan(20);
  });

  it('shows empty state when no proposals exist', async () => {
    const emptyResponse: ProposalHistoryResponse = {
      proposals: [],
      totalCount: 0,
      hasMore: false,
    };

    mockDefaultInvoke(emptyResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText(/No proposals yet/);
    expect(screen.getByText(/Create your first proposal/)).toBeInTheDocument();
  });

  it('integrates with VirtualizedList component', async () => {
    const mockResponse: ProposalHistoryResponse = {
      proposals: [
        { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: new Date().toISOString(), outcomeStatus: 'pending', hookStrategyId: null },
        { id: 2, jobExcerpt: 'Job 2', previewText: 'Preview 2', createdAt: new Date().toISOString(), outcomeStatus: 'pending', hookStrategyId: null },
      ],
      totalCount: 2,
      hasMore: false,
    };

    mockDefaultInvoke(mockResponse);

    const { container } = render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(container.querySelector('[data-testid="virtualized-list"]')).toBeInTheDocument();
  });

  it('uses correct row height (72px) (AC-1)', async () => {
    mockDefaultInvoke();

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
          outcomeStatus: 'pending',
          hookStrategyId: null,
        },
      ],
      totalCount: 1,
      hasMore: false,
    };

    mockDefaultInvoke(mockResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Looking for React developer');
    expect(screen.getByText(/I am excited to apply/)).toBeInTheDocument();
  });

  it('handles window resize', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    window.innerWidth = 1920;
    window.dispatchEvent(new Event('resize'));

    expect(screen.getByText('Job 1')).toBeInTheDocument();
  });

  // Story 7.2: Toast notification tests

  it('shows success toast after outcome update (AC-2)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Target the OutcomeDropdown <li> by its unique id (avoids conflict with filter <option>)
    const hiredOption = document.getElementById('outcome-option-hired')!;
    fireEvent.mouseDown(hiredOption);

    await waitFor(() => {
      expect(screen.getByText("Outcome updated to 'hired'")).toBeInTheDocument();
    });
  });

  it('shows error toast on failed outcome update (AC-5)', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_proposal_history') return Promise.resolve(singleProposalResponse);
      if (cmd === 'get_distinct_hook_strategies') return Promise.resolve([]);
      if (cmd === 'update_proposal_outcome') return Promise.reject(new Error('DB error'));
      return Promise.resolve({});
    });

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const badge = screen.getByLabelText(/Outcome:/);
    fireEvent.click(badge);

    // Target the OutcomeDropdown <li> by its unique id
    const hiredOption = document.getElementById('outcome-option-hired')!;
    fireEvent.mouseDown(hiredOption);

    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument();
    });
  });

  it('passes onStatusChange to ProposalHistoryCard', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const badge = screen.getByLabelText(/Outcome:/);
    expect(badge).toHaveAttribute('aria-haspopup', 'listbox');
  });

  // =========================================================================
  // Story 7.3: Search and Filter integration tests
  // =========================================================================

  it('renders SearchFilterBar above the list (7.3 AC-1)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByLabelText(/Search proposals/)).toBeInTheDocument();
  });

  it('shows result count (7.3)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(screen.getByText(/Showing 1 proposal/)).toBeInTheDocument();
  });

  it('shows filtered empty state with clear button (7.3 AC-6)', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_distinct_hook_strategies') return Promise.resolve([]);
      if (cmd === 'get_proposal_history') return Promise.resolve(singleProposalResponse);
      if (cmd === 'search_proposals') {
        return Promise.resolve({
          proposals: [],
          totalCount: 0,
          hasMore: false,
        });
      }
      return Promise.resolve({});
    });

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const statusSelect = screen.getByLabelText(/outcome status/i);
    fireEvent.change(statusSelect, { target: { value: 'hired' } });

    await waitFor(() => {
      expect(screen.getByText(/No proposals match your filters/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Clear filters/)).toBeInTheDocument();
  });

  it('shows outcome status filter dropdown (7.3 AC-2)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(screen.getByLabelText(/outcome status/i)).toBeInTheDocument();
  });

  it('shows date range filter dropdown (7.3 AC-3)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
  });

  it('calls search_proposals when outcome filter is selected (7.3 AC-2)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const statusSelect = screen.getByLabelText(/outcome status/i);
    fireEvent.change(statusSelect, { target: { value: 'hired' } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('search_proposals', expect.objectContaining({
        outcomeStatus: 'hired',
      }));
    });
  });

  it('calls search_proposals after debounce when typing (7.3 AC-1)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    const searchInput = screen.getByLabelText(/Search proposals/);
    fireEvent.change(searchInput, { target: { value: 'React' } });

    // Wait for debounce (300ms) + query execution
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('search_proposals', expect.objectContaining({
        searchText: 'React',
      }));
    }, { timeout: 2000 });
  });

  // =========================================================================
  // Story 7.6: DatabaseExportButton integration tests
  // =========================================================================

  it('renders DatabaseExportButton in history toolbar (7.6 AC-1)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    // Export button should be visible in the toolbar
    expect(screen.getByRole('button', { name: /export encrypted database backup/i })).toBeInTheDocument();
  });

  it('opens confirmation dialog when export button clicked (7.6)', async () => {
    mockDefaultInvoke();

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText('Job 1');

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export encrypted database backup/i });
    fireEvent.click(exportButton);

    // Confirmation dialog should appear
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Passphrase Warning/i)).toBeInTheDocument();
  });

  it('does not render DatabaseExportButton in empty state (7.6)', async () => {
    const emptyResponse: ProposalHistoryResponse = {
      proposals: [],
      totalCount: 0,
      hasMore: false,
    };

    mockDefaultInvoke(emptyResponse);

    render(<ProposalHistoryList />, { wrapper });

    await screen.findByText(/No proposals yet/);

    // Export button should NOT be visible in empty state
    expect(screen.queryByRole('button', { name: /export encrypted database backup/i })).not.toBeInTheDocument();
  });
});
