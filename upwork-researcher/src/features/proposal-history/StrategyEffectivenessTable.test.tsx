// Tests for StrategyEffectivenessTable (Story 10.4: Task 4.12)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { StrategyEffectivenessData } from "../../types/analytics";
import { StrategyEffectivenessTable } from "./StrategyEffectivenessTable";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockData: StrategyEffectivenessData[] = [
  {
    hookStrategyId: "Social Proof",
    abAssigned: true,
    total: 10,
    won: 4,
    responseRate: 0.4,
    avgScore: 1.8,
  },
  {
    hookStrategyId: "Social Proof",
    abAssigned: false,
    total: 5,
    won: 2,
    responseRate: 0.4,
    avgScore: 2.0,
  },
  {
    hookStrategyId: "Contrarian",
    abAssigned: true,
    total: 8,
    won: 1,
    responseRate: 0.125,
    avgScore: 0.5,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StrategyEffectivenessTable", () => {
  // Task 4.12.1: Table renders correctly with mock data
  it("renders table with data", async () => {
    mockInvoke.mockResolvedValue(mockData);
    render(<StrategyEffectivenessTable />, { wrapper });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    const socialProofCells = await screen.findAllByText("Social Proof");
    expect(socialProofCells.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("Contrarian")).toBeInTheDocument();
  });

  // Task 4.12.2: A/B vs Manual labeling
  it("labels A/B assigned as 'A/B' and manual as 'Manual'", async () => {
    mockInvoke.mockResolvedValue(mockData);
    render(<StrategyEffectivenessTable />, { wrapper });

    // Two "A/B" badges (Social Proof AB + Contrarian AB) and one "Manual"
    const abBadges = await screen.findAllByText("A/B");
    const manualBadges = await screen.findAllByText("Manual");

    expect(abBadges.length).toBe(2);
    expect(manualBadges.length).toBe(1);
  });

  // Task 4.12.3: Response rate sorting (already sorted by SQL, data reflects it)
  it("displays response rates for each row", async () => {
    mockInvoke.mockResolvedValue(mockData);
    render(<StrategyEffectivenessTable />, { wrapper });

    // 40.0% should appear (Social Proof A/B and Manual both have 0.4 rate)
    const rates = await screen.findAllByText("40.0%");
    expect(rates.length).toBeGreaterThanOrEqual(1);

    // Contrarian should show 12.5%
    expect(await screen.findByText("12.5%")).toBeInTheDocument();
  });

  // Task 4.12.4: Empty state
  it("shows empty state when no data", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<StrategyEffectivenessTable />, { wrapper });

    expect(
      await screen.findByText(
        "Generate proposals and track outcomes to see strategy effectiveness.",
      ),
    ).toBeInTheDocument();
  });

  // Task 4.12.5: Loading state
  it("shows loading skeleton while fetching", () => {
    // Make invoke never resolve (stays in loading state)
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(<StrategyEffectivenessTable />, { wrapper });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Task 4.12.6: Error state with retry button
  it("shows error state with retry button on fetch failure", async () => {
    mockInvoke.mockRejectedValue(new Error("DB error"));
    render(<StrategyEffectivenessTable />, { wrapper });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("retry button refetches data", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValueOnce(new Error("DB error")).mockResolvedValue(mockData);
    render(<StrategyEffectivenessTable />, { wrapper });

    const retryBtn = await screen.findByRole("button", { name: /retry/i });
    await user.click(retryBtn);

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
