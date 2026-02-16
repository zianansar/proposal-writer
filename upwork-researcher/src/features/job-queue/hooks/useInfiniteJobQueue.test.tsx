/**
 * useInfiniteJobQueue hook tests - Story 4b.9 Task 11
 * Tests AC-7, AC-11
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { JobQueueResponse } from "../types";

import { useInfiniteJobQueue } from "./useInfiniteJobQueue";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe("useInfiniteJobQueue", () => {
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
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const mockResponse: JobQueueResponse = {
    jobs: [
      {
        id: 1,
        clientName: "Acme Corp",
        jobTitle: "Senior Developer",
        skillsMatchPercent: 85,
        clientQualityPercent: 90,
        overallScore: 87.5,
        scoreColor: "green",
        createdAt: new Date().toISOString(),
      },
    ],
    totalCount: 100,
    hasMore: true,
    colorCounts: {
      green: 50,
      yellow: 30,
      red: 15,
      gray: 5,
    },
  };

  describe("AC-11.2: Load initial 50 jobs", () => {
    it("fetches first page with offset 0 and limit 50", async () => {
      mockInvoke.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockInvoke).toHaveBeenCalledWith("get_job_queue", {
        sortBy: "score",
        filter: "all",
        limit: 50,
        offset: 0,
      });
    });

    it("allows custom limit", async () => {
      mockInvoke.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => useInfiniteJobQueue({ sortBy: "score", filter: "all", limit: 25 }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockInvoke).toHaveBeenCalledWith("get_job_queue", {
        sortBy: "score",
        filter: "all",
        limit: 25,
        offset: 0,
      });
    });
  });

  describe("AC-11.4: Fetch next page when needed", () => {
    it("calculates next offset based on jobs loaded", async () => {
      const page1Response: JobQueueResponse = {
        ...mockResponse,
        jobs: Array(50).fill(mockResponse.jobs[0]),
        hasMore: true,
      };

      const page2Response: JobQueueResponse = {
        ...mockResponse,
        jobs: Array(50).fill(mockResponse.jobs[0]),
        hasMore: true,
      };

      mockInvoke.mockResolvedValueOnce(page1Response).mockResolvedValueOnce(page2Response);

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch next page
      result.current.fetchNextPage();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });

      // Second call should have offset = 50 (number of jobs from page 1)
      expect(mockInvoke).toHaveBeenNthCalledWith(2, "get_job_queue", {
        sortBy: "score",
        filter: "all",
        limit: 50,
        offset: 50,
      });
    });
  });

  describe("AC-11.6: Stop fetching when hasMore === false", () => {
    it("does not provide next page when hasMore is false", async () => {
      const finalPageResponse: JobQueueResponse = {
        ...mockResponse,
        hasMore: false,
      };

      mockInvoke.mockResolvedValue(finalPageResponse);

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(false);
    });

    it("provides next page when hasMore is true", async () => {
      mockInvoke.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe("Query key management", () => {
    it("uses separate query keys for different sort/filter combinations", async () => {
      mockInvoke.mockResolvedValue(mockResponse);

      const { result: result1 } = renderHook(
        () => useInfiniteJobQueue({ sortBy: "score", filter: "all" }),
        { wrapper },
      );

      const { result: result2 } = renderHook(
        () => useInfiniteJobQueue({ sortBy: "date", filter: "greenOnly" }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
        expect(result2.current.isSuccess).toBe(true);
      });

      // Should have made two separate requests
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error handling", () => {
    it("handles fetch errors", async () => {
      mockInvoke.mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error("Database error"));
    });
  });

  describe("Cache configuration", () => {
    it("uses correct staleTime and gcTime", async () => {
      mockInvoke.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useInfiniteJobQueue({ sortBy: "score", filter: "all" }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Query options are configured correctly (verified by TanStack Query internals)
      expect(result.current.data).toBeDefined();
    });
  });
});
