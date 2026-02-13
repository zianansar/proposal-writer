import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useUpdateProposalOutcome, OUTCOME_STATUSES } from './useUpdateProposalOutcome';
import type { ProposalHistoryResponse } from './types';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return { queryClient, wrapper: ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  };
}

const mockPage: ProposalHistoryResponse = {
  proposals: [
    { id: 1, jobExcerpt: 'Job 1', previewText: 'Preview 1', createdAt: '2026-01-01T00:00:00Z', outcomeStatus: 'pending', hookStrategyId: null },
    { id: 2, jobExcerpt: 'Job 2', previewText: 'Preview 2', createdAt: '2026-01-02T00:00:00Z', outcomeStatus: 'submitted', hookStrategyId: null },
  ],
  totalCount: 2,
  hasMore: false,
};

describe('useUpdateProposalOutcome', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('exports all 7 valid outcome statuses', () => {
    expect(OUTCOME_STATUSES).toHaveLength(7);
    expect(OUTCOME_STATUSES).toContain('pending');
    expect(OUTCOME_STATUSES).toContain('submitted');
    expect(OUTCOME_STATUSES).toContain('response_received');
    expect(OUTCOME_STATUSES).toContain('interview');
    expect(OUTCOME_STATUSES).toContain('hired');
    expect(OUTCOME_STATUSES).toContain('no_response');
    expect(OUTCOME_STATUSES).toContain('rejected');
  });

  it('invokes update_proposal_outcome Tauri command on mutate (AC-2)', async () => {
    mockInvoke.mockResolvedValue({ success: true, message: "Outcome updated to 'hired'" });
    const { queryClient, wrapper } = createWrapper();

    // Seed the cache
    queryClient.setQueryData(['proposalHistory'], { pages: [mockPage], pageParams: [0] });

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 1, outcomeStatus: 'hired' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('update_proposal_outcome', {
      proposalId: 1,
      outcomeStatus: 'hired',
    });
  });

  it('optimistically updates cache before server response (AC-2)', async () => {
    // Make invoke hang so we can observe optimistic state
    let resolveInvoke: (v: unknown) => void;
    mockInvoke.mockImplementation(() => new Promise((res) => { resolveInvoke = res; }));

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(['proposalHistory'], { pages: [mockPage], pageParams: [0] });

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 1, outcomeStatus: 'interview' });
    });

    // Check cache was optimistically updated
    const cached = queryClient.getQueryData<{ pages: ProposalHistoryResponse[] }>(['proposalHistory']);
    const proposal = cached?.pages[0].proposals.find((p) => p.id === 1);
    expect(proposal?.outcomeStatus).toBe('interview');

    // Resolve to clean up
    await act(async () => { resolveInvoke!({ success: true }); });
  });

  it('rolls back optimistic update on error preserving full snapshot (AC-5, M1)', async () => {
    mockInvoke.mockRejectedValue(new Error('Database error'));

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(['proposalHistory'], { pages: [mockPage], pageParams: [0] });

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 1, outcomeStatus: 'hired' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Cache should be rolled back to original status AND preserve pageParams
    const cached = queryClient.getQueryData<{ pages: ProposalHistoryResponse[]; pageParams: unknown[] }>(['proposalHistory']);
    const proposal = cached?.pages[0].proposals.find((p) => p.id === 1);
    expect(proposal?.outcomeStatus).toBe('pending');
    expect(cached?.pageParams).toEqual([0]);
  });

  it('invalidates proposalHistory query on settled', async () => {
    mockInvoke.mockResolvedValue({ success: true });

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(['proposalHistory'], { pages: [mockPage], pageParams: [0] });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 2, outcomeStatus: 'rejected' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['proposalHistory'] });
  });

  it('provides error object on failure (AC-5)', async () => {
    mockInvoke.mockRejectedValue(new Error('Invalid status'));

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(['proposalHistory'], { pages: [mockPage], pageParams: [0] });

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 1, outcomeStatus: 'hired' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Invalid status');
  });

  it('handles mutation when cache is empty', async () => {
    mockInvoke.mockResolvedValue({ success: true });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateProposalOutcome(), { wrapper });

    await act(async () => {
      result.current.mutate({ proposalId: 1, outcomeStatus: 'hired' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalled();
  });
});
