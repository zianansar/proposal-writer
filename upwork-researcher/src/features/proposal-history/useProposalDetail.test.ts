import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useProposalDetail } from "./useProposalDetail";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockDetail = {
  id: 1,
  jobContent: "Looking for React developer",
  generatedText: "I am excited to apply...",
  createdAt: "2026-02-10T12:00:00",
  updatedAt: null,
  status: "draft",
  outcomeStatus: "pending" as const,
  outcomeUpdatedAt: null,
  hookStrategyId: "social_proof",
  jobPostId: 42,
  jobTitle: "Acme Corp",
  revisionCount: 3,
};

describe("useProposalDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches proposal detail by id", async () => {
    mockInvoke.mockResolvedValueOnce(mockDetail);

    const { result } = renderHook(() => useProposalDetail(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith("get_proposal_detail", { id: 1 });
    expect(result.current.data).toEqual(mockDetail);
  });

  it("handles error from backend", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Proposal not found: 999"));

    const { result } = renderHook(() => useProposalDetail(999), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("Proposal not found: 999");
  });

  it("does not fetch when id is null", () => {
    const { result } = renderHook(() => useProposalDetail(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useProposalDetail(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
