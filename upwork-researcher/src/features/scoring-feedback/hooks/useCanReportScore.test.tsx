// Story 4b.10: useCanReportScore Hook Tests (Task 12.9)

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useCanReportScore } from "./useCanReportScore";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("useCanReportScore", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  it("returns canReport: true when no prior feedback exists", async () => {
    mockInvoke.mockResolvedValue({
      canReport: true,
      lastReportedAt: null,
    });

    const { result } = renderHook(() => useCanReportScore(123), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      canReport: true,
      lastReportedAt: null,
    });
    expect(mockInvoke).toHaveBeenCalledWith("check_can_report_score", { jobPostId: 123 });
  });

  it("returns canReport: false when feedback exists within 24h", async () => {
    const lastReported = "2026-02-09T10:30:00Z";
    mockInvoke.mockResolvedValue({
      canReport: false,
      lastReportedAt: lastReported,
    });

    const { result } = renderHook(() => useCanReportScore(456), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      canReport: false,
      lastReportedAt: lastReported,
    });
  });

  it("returns canReport: true when feedback exists outside 24h window", async () => {
    mockInvoke.mockResolvedValue({
      canReport: true,
      lastReportedAt: null, // Server doesn't return old timestamps
    });

    const { result } = renderHook(() => useCanReportScore(789), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.canReport).toBe(true);
  });

  it("is loading initially", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useCanReportScore(1), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("handles errors gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("Database error"));

    const { result } = renderHook(() => useCanReportScore(1), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it("uses correct query key with jobPostId", async () => {
    mockInvoke.mockResolvedValue({ canReport: true });

    const { result: result1 } = renderHook(() => useCanReportScore(100), { wrapper });
    const { result: result2 } = renderHook(() => useCanReportScore(200), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    // Should have been called with different jobPostIds
    expect(mockInvoke).toHaveBeenCalledWith("check_can_report_score", { jobPostId: 100 });
    expect(mockInvoke).toHaveBeenCalledWith("check_can_report_score", { jobPostId: 200 });
  });

  it("calls invoke on initial mount", async () => {
    mockInvoke.mockResolvedValue({ canReport: true });

    const { result } = renderHook(() => useCanReportScore(999), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify invoke was called on mount
    expect(mockInvoke).toHaveBeenCalledWith("check_can_report_score", { jobPostId: 999 });
  });

  it("returns correct TypeScript types", async () => {
    mockInvoke.mockResolvedValue({
      canReport: true,
      lastReportedAt: undefined,
    });

    const { result } = renderHook(() => useCanReportScore(1), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Type assertions - these would fail at compile time if types are wrong
    const canReport: boolean | undefined = result.current.data?.canReport;
    const lastReportedAt: string | undefined = result.current.data?.lastReportedAt;

    expect(typeof canReport).toBe("boolean");
  });
});
