// Tests for OutcomeDistributionChart component (Story 7.5 CR R1 H-2)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { OutcomeDistributionChart } from "./OutcomeDistributionChart";

// Track Cell renders to verify color mapping
const cellProps: any[] = [];
let lastChartData: any[] = [];

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) =>
    createElement("div", { "data-testid": "responsive-container" }, children),
  BarChart: ({ children, data }: any) => {
    lastChartData = data || [];
    return createElement(
      "div",
      { "data-testid": "bar-chart", "data-items": data?.length },
      children,
    );
  },
  Bar: ({ children }: any) => createElement("div", { "data-testid": "bar" }, children),
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: (props: any) => {
    cellProps.push(props);
    return createElement("div", { "data-testid": "cell", "data-fill": props.fill });
  },
}));

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const mockOutcomes = [
  { outcomeStatus: "hired", count: 5 },
  { outcomeStatus: "pending", count: 3 },
  { outcomeStatus: "rejected", count: 2 },
];

describe("OutcomeDistributionChart", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockInvoke.mockClear();
    cellProps.length = 0;
    lastChartData = [];
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  function renderChart() {
    return render(createElement(OutcomeDistributionChart), { wrapper });
  }

  it("renders bar chart with data", async () => {
    mockInvoke.mockResolvedValue(mockOutcomes);

    renderChart();

    const chart = await screen.findByTestId("bar-chart");
    expect(chart).toBeTruthy();
    expect(chart.getAttribute("data-items")).toBe("3");
    // CR R2 L-3: Verify data transformations (formatLabel, percentage calc)
    expect(lastChartData[0].name).toBe("Hired");
    expect(lastChartData[1].name).toBe("Pending");
    expect(lastChartData[2].name).toBe("Rejected");
    expect(lastChartData[0].percentage).toBe("50.0"); // 5/10
    expect(lastChartData[1].percentage).toBe("30.0"); // 3/10
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

  it("applies correct colors per outcome status", async () => {
    mockInvoke.mockResolvedValue(mockOutcomes);

    renderChart();

    await screen.findByTestId("bar-chart");

    // Verify Cell components received correct fills
    const fills = cellProps.map((p) => p.fill);
    expect(fills).toContain("#4ade80"); // hired = green
    expect(fills).toContain("#737373"); // pending = gray
    expect(fills).toContain("#ef4444"); // rejected = dark red
  });

  it("uses fallback color for unknown status", async () => {
    mockInvoke.mockResolvedValue([{ outcomeStatus: "unknown_status", count: 1 }]);

    renderChart();

    await screen.findByTestId("bar-chart");

    const fills = cellProps.map((p) => p.fill);
    expect(fills).toContain("#a3a3a3"); // fallback gray
  });
});
