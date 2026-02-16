/**
 * Job Queue Page tests - Story 4b.9
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react-window FixedSizeList
vi.mock("react-window", () => ({
  FixedSizeList: ({ children, itemCount }: any) => {
    const itemsToRender = Math.min(itemCount, 10);
    return (
      <div data-testid="virtualized-list">
        {Array.from({ length: itemsToRender }).map((_, index) =>
          children({ index, style: { top: index * 132, height: 132 } }),
        )}
      </div>
    );
  },
}));

// Mock the useInfiniteJobQueue hook - this is what JobQueuePage actually uses
const mockUseInfiniteJobQueue = vi.fn();
vi.mock("../hooks/useInfiniteJobQueue", () => ({
  useInfiniteJobQueue: (params: any) => mockUseInfiniteJobQueue(params),
}));

// Mock the useInfiniteScroll hook
const mockObserverTarget = createRef<HTMLDivElement>();
vi.mock("../hooks/useInfiniteScroll", () => ({
  useInfiniteScroll: () => mockObserverTarget,
}));

import JobQueuePage from "./JobQueuePage";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("JobQueuePage", () => {
  beforeEach(() => {
    cleanup();
    mockUseInfiniteJobQueue.mockReset();
  });

  it("renders loading state", () => {
    mockUseInfiniteJobQueue.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    expect(screen.getByText("Job Queue")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Job Queue" })).toBeInTheDocument();
  });

  it("renders error state with retry button", () => {
    const mockRefetch = vi.fn();
    mockUseInfiniteJobQueue.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch jobs"),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: mockRefetch,
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    expect(screen.getByText("Failed to load jobs")).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch jobs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders empty state (AC-10)", () => {
    mockUseInfiniteJobQueue.mockReturnValue({
      data: {
        pages: [
          {
            jobs: [],
            totalCount: 0,
            hasMore: false,
            colorCounts: { green: 0, yellow: 0, red: 0, gray: 0 },
          },
        ],
        pageParams: [0],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    expect(screen.getByText("No jobs in queue")).toBeInTheDocument();
    expect(screen.getByText("Import jobs via RSS or paste manually.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Jobs" })).toBeInTheDocument();
  });

  it("renders job list with sort and filter controls", () => {
    mockUseInfiniteJobQueue.mockReturnValue({
      data: {
        pages: [
          {
            jobs: [
              {
                id: 1,
                clientName: "Client A",
                jobTitle: "Test Job",
                skillsMatchPercent: 75,
                clientQualityPercent: 80,
                overallScore: 85.5,
                scoreColor: "green",
                createdAt: "2026-02-09T12:00:00Z",
              },
            ],
            totalCount: 1,
            hasMore: false,
            colorCounts: { green: 1, yellow: 0, red: 0, gray: 0 },
          },
        ],
        pageParams: [0],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    // Verify controls
    expect(screen.getByLabelText("Sort by:")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by:" })).toBeInTheDocument();
    expect(screen.getByText("Show:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All/ })).toBeInTheDocument();

    // Verify job is displayed
    expect(screen.getByText("Client A")).toBeInTheDocument();
    expect(screen.getByText("Test Job")).toBeInTheDocument();
    // Score is displayed in JobScoreBadge with descriptive aria-label (includes color description)
    // [AI-Review Fix H3]: Updated test to match JobScoreBadge aria-label format
    expect(screen.getByRole("status", { name: /Score: 85\.5/ })).toBeInTheDocument();
  });

  it("displays load more button when hasNextPage is true", () => {
    mockUseInfiniteJobQueue.mockReturnValue({
      data: {
        pages: [
          {
            jobs: [
              {
                id: 1,
                clientName: "Client A",
                jobTitle: "Test Job",
                skillsMatchPercent: 75,
                clientQualityPercent: 80,
                overallScore: 85.5,
                scoreColor: "green",
                createdAt: "2026-02-09T12:00:00Z",
              },
            ],
            totalCount: 50,
            hasMore: true,
            colorCounts: { green: 20, yellow: 15, red: 10, gray: 5 },
          },
        ],
        pageParams: [0],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    expect(screen.getByRole("button", { name: "Load more jobs" })).toBeInTheDocument();
  });

  it("shows correct filter counts (AC-5)", () => {
    mockUseInfiniteJobQueue.mockReturnValue({
      data: {
        pages: [
          {
            jobs: [
              {
                id: 1,
                clientName: "Client A",
                jobTitle: "Test Job",
                skillsMatchPercent: 75,
                clientQualityPercent: 80,
                overallScore: 85.5,
                scoreColor: "green",
                createdAt: "2026-02-09T12:00:00Z",
              },
            ],
            totalCount: 50,
            hasMore: false,
            colorCounts: { green: 12, yellow: 18, red: 15, gray: 5 },
          },
        ],
        pageParams: [0],
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: vi.fn(),
    });

    render(<JobQueuePage />, { wrapper: createWrapper() });

    // Verify filter chips show correct counts
    // All: 12 + 18 + 15 + 5 = 50
    expect(screen.getByRole("button", { name: "All (50)" })).toBeInTheDocument();
    // Yellow+: 12 + 18 = 30
    expect(screen.getByRole("button", { name: "Yellow+ (30)" })).toBeInTheDocument();
    // Green Only: 12
    expect(screen.getByRole("button", { name: "Green Only (12)" })).toBeInTheDocument();
  });
});
