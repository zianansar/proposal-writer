// Tests for useHookStrategies hook (Story 7.3, CR L-1)
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { useHookStrategies } from './useHookStrategies';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('useHookStrategies', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('calls get_distinct_hook_strategies command', async () => {
    mockInvoke.mockResolvedValue(['social_proof', 'contrarian']);

    const { result } = renderHook(() => useHookStrategies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('get_distinct_hook_strategies');
    expect(result.current.data).toEqual(['social_proof', 'contrarian']);
  });

  it('returns empty array when no strategies exist', async () => {
    mockInvoke.mockResolvedValue([]);

    const { result } = renderHook(() => useHookStrategies(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('handles error state', async () => {
    mockInvoke.mockRejectedValue(new Error('DB error'));

    const { result } = renderHook(() => useHookStrategies(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('uses queryKey ["hookStrategies"]', async () => {
    mockInvoke.mockResolvedValue([]);

    renderHook(() => useHookStrategies(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const hookQuery = queries.find(
        (q) => q.queryKey[0] === 'hookStrategies'
      );
      expect(hookQuery).toBeDefined();
    });
  });
});
