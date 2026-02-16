// Tests for analytics dashboard hooks (Story 7.5)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  useAnalyticsSummary,
  useOutcomeDistribution,
  useStrategyPerformance,
  useWeeklyActivity,
} from "./useProposalAnalytics";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe("useAnalyticsSummary", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("calls get_proposal_analytics_summary command", async () => {
    const mockSummary = {
      totalProposals: 10,
      positiveOutcomes: 3,
      resolvedProposals: 8,
      proposalsThisMonth: 5,
      responseRate: 37.5,
      bestStrategy: "social_proof",
      bestStrategyRate: 60.0,
    };
    mockInvoke.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_proposal_analytics_summary");
    expect(result.current.data).toEqual(mockSummary);
  });

  it("handles empty database", async () => {
    const emptySummary = {
      totalProposals: 0,
      positiveOutcomes: 0,
      resolvedProposals: 0,
      proposalsThisMonth: 0,
      responseRate: 0,
      bestStrategy: null,
      bestStrategyRate: 0,
    };
    mockInvoke.mockResolvedValue(emptySummary);

    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(emptySummary);
  });

  it("handles error state", async () => {
    mockInvoke.mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('uses queryKey ["analytics", "summary"]', async () => {
    mockInvoke.mockResolvedValue({
      totalProposals: 0,
      positiveOutcomes: 0,
      resolvedProposals: 0,
      proposalsThisMonth: 0,
      responseRate: 0,
      bestStrategy: null,
      bestStrategyRate: 0,
    });

    renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const analyticsQuery = queries.find(
        (q) => q.queryKey[0] === "analytics" && q.queryKey[1] === "summary",
      );
      expect(analyticsQuery).toBeDefined();
    });
  });

  it("has staleTime of 5 minutes", async () => {
    mockInvoke.mockResolvedValue({
      totalProposals: 0,
      positiveOutcomes: 0,
      resolvedProposals: 0,
      proposalsThisMonth: 0,
      responseRate: 0,
      bestStrategy: null,
      bestStrategyRate: 0,
    });

    renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const analyticsQuery = queries.find(
        (q) => q.queryKey[0] === "analytics" && q.queryKey[1] === "summary",
      );
      expect(analyticsQuery?.options.staleTime).toBe(5 * 60 * 1000);
    });
  });
});

describe("useOutcomeDistribution", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("calls get_outcome_distribution command", async () => {
    const mockDistribution = [
      { outcomeStatus: "pending", count: 5 },
      { outcomeStatus: "hired", count: 3 },
      { outcomeStatus: "rejected", count: 2 },
    ];
    mockInvoke.mockResolvedValue(mockDistribution);

    const { result } = renderHook(() => useOutcomeDistribution(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_outcome_distribution");
    expect(result.current.data).toEqual(mockDistribution);
  });

  it("handles empty array", async () => {
    mockInvoke.mockResolvedValue([]);

    const { result } = renderHook(() => useOutcomeDistribution(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('uses queryKey ["analytics", "outcomes"]', async () => {
    mockInvoke.mockResolvedValue([]);

    renderHook(() => useOutcomeDistribution(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const query = queries.find(
        (q) => q.queryKey[0] === "analytics" && q.queryKey[1] === "outcomes",
      );
      expect(query).toBeDefined();
    });
  });
});

describe("useStrategyPerformance", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("calls get_response_rate_by_strategy command", async () => {
    const mockPerformance = [
      { strategy: "social_proof", total: 5, positive: 3, responseRate: 60.0 },
      { strategy: "contrarian", total: 3, positive: 1, responseRate: 33.33 },
    ];
    mockInvoke.mockResolvedValue(mockPerformance);

    const { result } = renderHook(() => useStrategyPerformance(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_response_rate_by_strategy");
    expect(result.current.data).toEqual(mockPerformance);
  });

  it('uses queryKey ["analytics", "strategies"]', async () => {
    mockInvoke.mockResolvedValue([]);

    renderHook(() => useStrategyPerformance(), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const query = queries.find(
        (q) => q.queryKey[0] === "analytics" && q.queryKey[1] === "strategies",
      );
      expect(query).toBeDefined();
    });
  });
});

describe("useWeeklyActivity", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("calls get_weekly_activity with default 12 weeks", async () => {
    const mockActivity = [
      {
        weekLabel: "2026-W06",
        weekStart: "2026-02-02",
        proposalCount: 3,
        positiveCount: 1,
        responseRate: 33.33,
      },
    ];
    mockInvoke.mockResolvedValue(mockActivity);

    const { result } = renderHook(() => useWeeklyActivity(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_weekly_activity", { weeks: 12 });
    expect(result.current.data).toEqual(mockActivity);
  });

  it("calls get_weekly_activity with custom weeks parameter", async () => {
    mockInvoke.mockResolvedValue([]);

    const { result } = renderHook(() => useWeeklyActivity(4), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_weekly_activity", { weeks: 4 });
  });

  it('uses queryKey ["analytics", "weekly", weeks]', async () => {
    mockInvoke.mockResolvedValue([]);

    renderHook(() => useWeeklyActivity(8), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const query = queries.find(
        (q) => q.queryKey[0] === "analytics" && q.queryKey[1] === "weekly" && q.queryKey[2] === 8,
      );
      expect(query).toBeDefined();
    });
  });
});
