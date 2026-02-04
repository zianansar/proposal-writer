import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import HistoryList from "./HistoryList";

// invoke is already mocked in setup.ts

describe("HistoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    render(<HistoryList />);

    expect(screen.getByText(/loading proposals/i)).toBeInTheDocument();
  });

  it("displays proposals after loading", async () => {
    render(<HistoryList />);

    await waitFor(() => {
      expect(screen.getByText(/Test job content 1/)).toBeInTheDocument();
      expect(screen.getByText(/Test job content 2/)).toBeInTheDocument();
    });
  });

  it("calls get_proposals command on mount", async () => {
    render(<HistoryList />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_proposals");
    });
  });

  it("shows empty state when no proposals", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);

    render(<HistoryList />);

    await waitFor(() => {
      expect(screen.getByText(/no proposals yet/i)).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Database error"));

    render(<HistoryList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load proposals/i)).toBeInTheDocument();
      expect(screen.getByText(/database error/i)).toBeInTheDocument();
    });
  });
});
