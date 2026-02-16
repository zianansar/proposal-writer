// Tests for useSearchProposals hook (Story 7.3)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ProposalHistoryResponse } from "./types";
import {
  useSearchProposals,
  hasActiveFilters,
  activeFilterCount,
  DEFAULT_FILTERS,
} from "./useSearchProposals";
import type { ProposalFilters } from "./useSearchProposals";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe("useSearchProposals", () => {
  let queryClient: QueryClient;

  const mockResponse: ProposalHistoryResponse = {
    proposals: [
      {
        id: 1,
        jobExcerpt: "Job 1",
        previewText: "Text 1",
        createdAt: "2026-01-01",
        outcomeStatus: "pending",
        hookStrategyId: null,
      },
    ],
    totalCount: 1,
    hasMore: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(mockResponse);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("calls get_proposal_history when no filters active", async () => {
    const { result } = renderHook(() => useSearchProposals(DEFAULT_FILTERS), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_proposal_history", {
      limit: 50,
      offset: 0,
    });
  });

  it("calls search_proposals when filters are active", async () => {
    const filters: ProposalFilters = {
      searchText: "React",
      outcomeStatus: "",
      dateRangeDays: 0,
      hookStrategy: "",
    };

    const { result } = renderHook(() => useSearchProposals(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("search_proposals", {
      searchText: "React",
      outcomeStatus: null,
      dateRangeDays: null,
      hookStrategy: null,
      limit: 50,
      offset: 0,
    });
  });

  it("passes all filter params to search_proposals", async () => {
    const filters: ProposalFilters = {
      searchText: "dev",
      outcomeStatus: "hired",
      dateRangeDays: 30,
      hookStrategy: "social_proof",
    };

    const { result } = renderHook(() => useSearchProposals(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("search_proposals", {
      searchText: "dev",
      outcomeStatus: "hired",
      dateRangeDays: 30,
      hookStrategy: "social_proof",
      limit: 50,
      offset: 0,
    });
  });

  it("uses parameterized queryKey when filters active", async () => {
    const filters: ProposalFilters = {
      searchText: "test",
      outcomeStatus: "hired",
      dateRangeDays: 7,
      hookStrategy: "",
    };

    renderHook(() => useSearchProposals(filters), { wrapper });

    // Verify the query was cached with parameterized key
    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const filteredQuery = queries.find(
        (q) => q.queryKey.length === 2 && typeof q.queryKey[1] === "object",
      );
      expect(filteredQuery).toBeDefined();
    });
  });

  it("uses base queryKey when no filters", async () => {
    renderHook(() => useSearchProposals(DEFAULT_FILTERS), { wrapper });

    await waitFor(() => {
      const queries = queryClient.getQueryCache().getAll();
      const baseQuery = queries.find(
        (q) => q.queryKey.length === 1 && q.queryKey[0] === "proposalHistory",
      );
      expect(baseQuery).toBeDefined();
    });
  });
});

describe("hasActiveFilters", () => {
  it("returns false for default filters", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("returns true when searchText is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, searchText: "test" })).toBe(true);
  });

  it("returns true when outcomeStatus is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, outcomeStatus: "hired" })).toBe(true);
  });

  it("returns true when dateRangeDays is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, dateRangeDays: 7 })).toBe(true);
  });

  it("returns true when hookStrategy is set", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, hookStrategy: "social_proof" })).toBe(true);
  });
});

describe("activeFilterCount", () => {
  it("returns 0 for default filters", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it("returns correct count for mixed filters", () => {
    expect(
      activeFilterCount({
        searchText: "test",
        outcomeStatus: "hired",
        dateRangeDays: 0,
        hookStrategy: "",
      }),
    ).toBe(2);
  });

  it("returns 4 when all filters active", () => {
    expect(
      activeFilterCount({
        searchText: "test",
        outcomeStatus: "hired",
        dateRangeDays: 30,
        hookStrategy: "social_proof",
      }),
    ).toBe(4);
  });
});
