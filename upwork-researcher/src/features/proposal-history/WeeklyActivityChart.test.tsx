// Tests for WeeklyActivityChart component (Story 7.5 CR R1 H-2)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { WeeklyActivityChart } from "./WeeklyActivityChart";

let lastChartData: any[] = [];

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) =>
    createElement("div", { "data-testid": "responsive-container" }, children),
  ComposedChart: ({ children, data }: any) => {
    lastChartData = data || [];
    return createElement(
      "div",
      { "data-testid": "composed-chart", "data-items": data?.length },
      children,
    );
  },
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const mockActivity = [
  {
    weekLabel: "2026-W05",
    weekStart: "2026-01-26",
    proposalCount: 5,
    positiveCount: 2,
    responseRate: 40.0,
  },
  {
    weekLabel: "2026-W06",
    weekStart: "2026-02-02",
    proposalCount: 3,
    positiveCount: 1,
    responseRate: 33.3,
  },
  {
    weekLabel: "2026-W07",
    weekStart: "2026-02-09",
    proposalCount: 8,
    positiveCount: 3,
    responseRate: 37.5,
  },
];

describe("WeeklyActivityChart", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
    lastChartData = [];
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  function renderChart() {
    return render(createElement(WeeklyActivityChart), { wrapper });
  }

  it("renders composed chart with data", async () => {
    mockInvoke.mockResolvedValue(mockActivity);

    renderChart();

    const chart = await screen.findByTestId("composed-chart");
    expect(chart).toBeTruthy();
    expect(chart.getAttribute("data-items")).toBe("3");
  });

  it("renders loading state", () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    renderChart();

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders error state", async () => {
    mockInvoke.mockRejectedValue(new Error("DB error"));

    renderChart();

    expect(await screen.findByText("Error loading data")).toBeTruthy();
  });

  it('renders "No data" when empty', async () => {
    mockInvoke.mockResolvedValue([]);

    renderChart();

    expect(await screen.findByText("No data")).toBeTruthy();
  });

  it("requests 12 weeks of data by default", async () => {
    mockInvoke.mockResolvedValue(mockActivity);

    renderChart();

    await screen.findByTestId("composed-chart");

    expect(mockInvoke).toHaveBeenCalledWith("get_weekly_activity", { weeks: 12 });
  });

  it("formats week dates correctly from ISO dates", async () => {
    // Single week to verify date formatting
    mockInvoke.mockResolvedValue([
      {
        weekLabel: "2026-W06",
        weekStart: "2026-02-02",
        proposalCount: 3,
        positiveCount: 1,
        responseRate: 33.3,
      },
    ]);

    renderChart();

    const chart = await screen.findByTestId("composed-chart");
    expect(chart.getAttribute("data-items")).toBe("1");
    // CR R2 L-3: Verify date formatting and responseRate rounding
    expect(lastChartData[0].week).toBe("Feb 2");
    expect(lastChartData[0].proposalCount).toBe(3);
    expect(lastChartData[0].responseRate).toBe(33.3);
  });
});
