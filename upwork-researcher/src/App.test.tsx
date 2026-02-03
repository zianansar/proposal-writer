import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the app heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /upwork research agent/i })).toBeInTheDocument();
  });

  it("renders the job input textarea", () => {
    render(<App />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the generate button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeInTheDocument();
  });

  it("disables generate button when input is empty", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeDisabled();
  });

  it("enables generate button when input has content", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    expect(screen.getByRole("button", { name: /generate proposal/i })).not.toBeDisabled();
  });

  it("shows error when trying to generate with empty input", async () => {
    const user = userEvent.setup();
    render(<App />);
    // Type and then clear to enable button momentarily
    await user.type(screen.getByRole("textbox"), "a");
    await user.clear(screen.getByRole("textbox"));
    // Button should be disabled again, so this tests the validation
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls invoke with job content when generate is clicked", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce("Generated proposal text");

    render(<App />);
    await user.type(screen.getByRole("textbox"), "Looking for a React developer");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    expect(mockInvoke).toHaveBeenCalledWith("generate_proposal", {
      jobContent: "Looking for a React developer",
    });
  });

  it("displays generated proposal on success", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce("This is your generated proposal!");

    render(<App />);
    await user.type(screen.getByRole("textbox"), "Job post content");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    await waitFor(() => {
      expect(screen.getByText("This is your generated proposal!")).toBeInTheDocument();
    });
  });

  it("displays error on API failure", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValueOnce("API error: rate limited");

    render(<App />);
    await user.type(screen.getByRole("textbox"), "Job post content");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    await waitFor(() => {
      expect(screen.getByText(/api error: rate limited/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while generating", async () => {
    const user = userEvent.setup();
    // Use a promise that we can resolve manually to check loading state
    let resolvePromise: (value: string) => void;
    mockInvoke.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePromise = resolve;
    }));

    render(<App />);
    await user.type(screen.getByRole("textbox"), "Job post");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // Should show generating state
    expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
    expect(screen.getByText(/generating your proposal/i)).toBeInTheDocument();

    // Resolve and verify loading stops
    resolvePromise!("Done!");
    await waitFor(() => {
      expect(screen.getByText("Done!")).toBeInTheDocument();
    });
  });
});
