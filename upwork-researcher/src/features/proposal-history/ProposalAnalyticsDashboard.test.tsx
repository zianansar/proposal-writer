// Tests for ProposalAnalyticsDashboard component (Story 7.5 CR R1 H-2)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { ProposalAnalyticsDashboard } from "./ProposalAnalyticsDashboard";

// Mock recharts — ResponsiveContainer doesn't render in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) =>
    createElement("div", { "data-testid": "responsive-container" }, children),
  BarChart: ({ children }: any) => createElement("div", { "data-testid": "bar-chart" }, children),
  ComposedChart: ({ children }: any) =>
    createElement("div", { "data-testid": "composed-chart" }, children),
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
}));

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const mockSummary = {
  totalProposals: 47,
  positiveOutcomes: 8,
  resolvedProposals: 35,
  proposalsThisMonth: 12,
  responseRate: 22.9,
  bestStrategy: "social_proof",
  bestStrategyRate: 40.0,
};

const emptySummary = {
  totalProposals: 0,
  positiveOutcomes: 0,
  resolvedProposals: 0,
  proposalsThisMonth: 0,
  responseRate: 0,
  bestStrategy: null,
  bestStrategyRate: 0,
};

describe("ProposalAnalyticsDashboard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  function renderDashboard() {
    return render(createElement(ProposalAnalyticsDashboard), { wrapper });
  }

  it("renders metric cards with data", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary") return Promise.resolve(mockSummary);
      if (cmd === "get_outcome_distribution") return Promise.resolve([]);
      if (cmd === "get_response_rate_by_strategy") return Promise.resolve([]);
      if (cmd === "get_weekly_activity") return Promise.resolve([]);
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    renderDashboard();

    expect(await screen.findByText("47")).toBeTruthy();
    expect(screen.getByText("22.9%")).toBeTruthy();
    expect(screen.getByText("Social Proof")).toBeTruthy();
    expect(screen.getByText("40.0%")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders empty state when totalProposals is 0", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary") return Promise.resolve(emptySummary);
      return Promise.resolve([]);
    });

    renderDashboard();

    expect(
      await screen.findByText(
        "No analytics data yet. Generate and track proposals to see insights here.",
      ),
    ).toBeTruthy();
  });

  it("renders loading state initially", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderDashboard();

    const skeletons = document.querySelectorAll(".metric-card-skeleton");
    expect(skeletons.length).toBe(4);
  });

  it("renders error state on failure", async () => {
    mockInvoke.mockRejectedValue(new Error("DB error"));

    renderDashboard();

    expect(await screen.findByText("Failed to load analytics data.")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("retry button calls refetch not page reload", async () => {
    // CR R2 L-1: Mock reload to verify it's NOT called
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
    });

    // First call fails, second succeeds
    mockInvoke.mockRejectedValueOnce(new Error("DB error")).mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary") return Promise.resolve(mockSummary);
      return Promise.resolve([]);
    });

    renderDashboard();

    const retryBtn = await screen.findByText("Retry");
    fireEvent.click(retryBtn);

    // After retry, should call invoke again (not reload)
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("response rate color is green when > 20%", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary")
        return Promise.resolve({ ...mockSummary, responseRate: 25.0 });
      return Promise.resolve([]);
    });

    renderDashboard();

    const rateEl = await screen.findByText("25.0%");
    expect(rateEl.style.color).toBe("rgb(74, 222, 128)"); // #4ade80
  });

  it("response rate color is yellow when 10-20%", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary")
        return Promise.resolve({ ...mockSummary, responseRate: 15.0 });
      return Promise.resolve([]);
    });

    renderDashboard();

    const rateEl = await screen.findByText("15.0%");
    expect(rateEl.style.color).toBe("rgb(251, 191, 36)"); // #fbbf24
  });

  it("response rate color is red when < 10%", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary")
        return Promise.resolve({ ...mockSummary, responseRate: 5.0 });
      return Promise.resolve([]);
    });

    renderDashboard();

    const rateEl = await screen.findByText("5.0%");
    expect(rateEl.style.color).toBe("rgb(248, 113, 113)"); // #f87171
  });

  it("shows N/A when no best strategy", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary")
        return Promise.resolve({ ...mockSummary, bestStrategy: null, bestStrategyRate: 0 });
      return Promise.resolve([]);
    });

    renderDashboard();

    expect(await screen.findByText("N/A")).toBeTruthy();
  });

  it("renders chart section headings", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_proposal_analytics_summary") return Promise.resolve(mockSummary);
      return Promise.resolve([]);
    });

    renderDashboard();

    expect(await screen.findByText("Proposal Analytics")).toBeTruthy();
    expect(screen.getByText("Outcome Distribution")).toBeTruthy();
    expect(screen.getByText("Hook Strategy Performance")).toBeTruthy();
    expect(screen.getByText("Weekly Activity (Last 12 Weeks)")).toBeTruthy();
  });
});
