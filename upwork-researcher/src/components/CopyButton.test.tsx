import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";
import CopyButton from "./CopyButton";

const mockWriteText = vi.mocked(writeText);
const mockInvoke = vi.mocked(invoke);

describe("CopyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: safe perplexity score (below threshold), copy proceeds
    mockInvoke.mockImplementation((command: string) => {
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 120.0,
          threshold: 180,
          flaggedSentences: [],
        });
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with default text", () => {
    render(<CopyButton text="Test proposal" />);
    expect(screen.getByRole("button")).toHaveTextContent("Copy to Clipboard");
  });

  it("calls analyze_perplexity then writeText when clicked", async () => {
    render(<CopyButton text="Test proposal text" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
      text: "Test proposal text",
    });
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal text");
  });

  it("shows 'Copied!' after successful copy", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });

  it("returns to 'Copy to Clipboard' after 2 seconds", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copied!");

    // Advance timers by 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copy to Clipboard");
  });

  it("is disabled when disabled prop is true", () => {
    render(<CopyButton text="Test proposal" disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when text is empty", () => {
    render(<CopyButton text="" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call writeText when disabled", async () => {
    render(<CopyButton text="Test proposal" disabled />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("shows error message when copy fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard error"));
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to copy to clipboard"
    );
  });

  it("has correct aria-label for accessibility", () => {
    render(<CopyButton text="Test proposal" />);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Copy to clipboard"
    );
  });

  it("updates aria-label after copy", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Copied to clipboard"
    );
  });

  // ==========================================================================
  // Story 3.2: SafetyWarningModal integration tests
  // ==========================================================================

  it("shows SafetyWarningModal when perplexity score >= threshold", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 195.5,
          threshold: 180,
          flaggedSentences: [
            {
              text: "I am delighted to delve.",
              suggestion: "Replace with 'excited to work on'",
              index: 0,
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Modal should be visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/AI Detection Risk Detected/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/195.5/)).toBeInTheDocument();
    expect(
      screen.getByText("I am delighted to delve.")
    ).toBeInTheDocument();

    // Should NOT have copied
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("copies text when perplexity analysis fails (graceful fallback)", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "analyze_perplexity") {
        return Promise.reject(new Error("API timeout"));
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Should have copied despite API failure (graceful degradation)
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });

  it("closes modal and does NOT copy when Edit Proposal clicked", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 200,
          threshold: 180,
          flaggedSentences: [
            {
              text: "Risky sentence.",
              suggestion: "Fix it.",
              index: 0,
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Modal visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click "Edit Proposal"
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Edit Proposal/i })
      );
    });

    // Modal should be gone
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Should NOT have copied
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("copies text when Override clicked despite warning", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 200,
          threshold: 180,
          flaggedSentences: [
            {
              text: "Risky sentence.",
              suggestion: "Fix it.",
              index: 0,
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Modal visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click "Override (Risky)"
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });

    // Modal should be gone
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Should have copied
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
  });

  it("does NOT show modal when score is below threshold", async () => {
    // Default mock returns score 120 < 180 threshold
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // No modal
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Copy succeeded
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
  });
});
