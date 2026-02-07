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
    // Story 3.5: Added get_safety_threshold mock
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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

  it("calls get_safety_threshold, analyze_perplexity, then writeText when clicked", async () => {
    render(<CopyButton text="Test proposal text" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Story 3.5: Should fetch threshold first
    expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    // Story 3.5: Should pass threshold to analyze_perplexity
    expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
      text: "Test proposal text",
      threshold: 180,
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
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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

  // Story 3.6: Override now shows confirmation dialog instead of direct copy
  // This test verifies the confirmation flow (updated from Story 3.2)
  it("shows confirmation dialog when Override clicked (Story 3.6)", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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
      if (command === "log_safety_override") {
        return Promise.resolve(null);
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

    // SafetyWarningModal should be replaced by OverrideConfirmDialog
    expect(screen.queryByText(/AI Detection Risk Detected/i)).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Confirm override to complete copy
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy Anyway/i }));
    });

    // Should have copied after confirmation
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

  // ==========================================================================
  // Story 3.5: Integration tests - custom threshold affects safety check
  // ==========================================================================

  it("uses custom threshold (150) - score 160 triggers warning", async () => {
    // Mock custom threshold of 150 (stricter)
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(150);
      }
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 160,
          threshold: 150,
          flaggedSentences: [
            {
              text: "Flagged sentence.",
              suggestion: "Make it more natural.",
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

    // With threshold 150, score 160 should trigger warning (160 >= 150)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/160/)).toBeInTheDocument();
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("uses custom threshold (200) - score 160 allows copy", async () => {
    // Mock custom threshold of 200 (permissive)
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(200);
      }
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 160,
          threshold: 200,
          flaggedSentences: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // With threshold 200, score 160 should allow copy (160 < 200)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal");
  });

  it("uses default threshold 180 when get_safety_threshold fails", async () => {
    // Mock get_safety_threshold failure
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.reject(new Error("Database error"));
      }
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 185,
          threshold: 180,
          flaggedSentences: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Should fall back to threshold 180
    expect(mockInvoke).toHaveBeenCalledWith("analyze_perplexity", {
      text: "Test proposal",
      threshold: 180,
    });
  });

  // ==========================================================================
  // Story 3.6: Override Confirmation Dialog integration tests
  // ==========================================================================

  // Story 3.6, Task 5.8: Override button shows confirmation dialog (not direct copy)
  it("shows OverrideConfirmDialog when Override clicked (not direct copy)", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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

    // Click Copy to trigger analysis
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Safety warning modal should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click "Override (Risky)"
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });

    // SafetyWarningModal should be gone, OverrideConfirmDialog should appear
    expect(
      screen.queryByText(/AI Detection Risk Detected/i)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText(/This proposal may be detected as AI-generated/i)
    ).toBeInTheDocument();

    // Should NOT have copied yet
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  // Story 3.6, Task 5.9: Cancel in confirmation returns to SafetyWarningModal
  it("returns to SafetyWarningModal when Cancel clicked in confirmation", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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

    // Click Copy to trigger analysis
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Click "Override (Risky)" to show confirmation dialog
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });

    // Confirmation dialog visible
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Click "Cancel"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    });

    // Should be back to SafetyWarningModal
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/AI Detection Risk Detected/i)).toBeInTheDocument();

    // Should NOT have copied
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  // Story 3.6, Task 5.10: Confirm in confirmation copies to clipboard
  it("copies to clipboard when Copy Anyway clicked in confirmation", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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
      if (command === "log_safety_override") {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" />);

    // Click Copy to trigger analysis
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Click "Override (Risky)" to show confirmation dialog
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });

    // Click "Copy Anyway"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy Anyway/i }));
    });

    // Dialog should be gone
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Should have copied
    expect(mockWriteText).toHaveBeenCalledWith("Test proposal");

    // Should show "Copied!" state
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });

  // Story 3.6, AI-Review M2: Test clipboard failure during override confirm
  it("shows error when clipboard fails during override confirm", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
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

    // Clipboard will fail
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard access denied"));

    render(<CopyButton text="Test proposal" />);

    // Click Copy to trigger analysis
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Click "Override (Risky)" to show confirmation dialog
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });

    // Click "Copy Anyway"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy Anyway/i }));
    });

    // Dialog should be gone
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // Error should be shown
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to copy to clipboard"
    );
  });

  // Story 3.7: Verify record_safety_override is called with correct parameters
  it("calls record_safety_override when override is confirmed", async () => {
    const proposalId = 42;
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "analyze_perplexity") {
        return Promise.resolve({
          score: 195.5,
          threshold: 180,
          flaggedSentences: [
            {
              text: "AI sentence.",
              suggestion: "Humanize it.",
              index: 0,
            },
          ],
        });
      }
      if (command === "record_safety_override") {
        return Promise.resolve(1); // Return override ID
      }
      return Promise.resolve(null);
    });

    render(<CopyButton text="Test proposal" proposalId={proposalId} />);

    // Click Copy to trigger analysis
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Click Override, then Copy Anyway
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Override \(Risky\)/i })
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy Anyway/i }));
    });

    // Verify record_safety_override was called with proposalId, score, and threshold
    expect(mockInvoke).toHaveBeenCalledWith("record_safety_override", {
      proposalId,
      aiScore: 195.5,
      threshold: 180,
    });
  });
});

