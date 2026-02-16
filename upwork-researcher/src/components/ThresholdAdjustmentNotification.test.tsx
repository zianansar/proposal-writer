import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ThresholdAdjustmentNotification, {
  ThresholdSuggestion,
} from "./ThresholdAdjustmentNotification";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("ThresholdAdjustmentNotification", () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnRemindLater = vi.fn();

  const increaseSuggestion: ThresholdSuggestion = {
    currentThreshold: 180,
    suggestedThreshold: 190,
    successfulOverrideCount: 3,
    averageOverrideScore: 185.5,
    direction: "increase",
  };

  const decreaseSuggestion: ThresholdSuggestion = {
    currentThreshold: 190,
    suggestedThreshold: 180,
    successfulOverrideCount: 0,
    averageOverrideScore: 0,
    direction: "decrease",
  };

  const atMaximumSuggestion: ThresholdSuggestion = {
    currentThreshold: 220,
    suggestedThreshold: 220,
    successfulOverrideCount: 0,
    averageOverrideScore: 0,
    direction: "at_maximum",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("Increase suggestion (AC4)", () => {
    it("displays correct title and message for increase", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Adjust Your Safety Threshold?")).toBeInTheDocument();
      expect(screen.getByText(/You've successfully used/)).toBeInTheDocument();
      expect(screen.getByText("3 proposals")).toBeInTheDocument();
    });

    it("displays current and suggested thresholds", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Current")).toBeInTheDocument();
      expect(screen.getByText("180")).toBeInTheDocument();
      expect(screen.getByText("Suggested")).toBeInTheDocument();
      expect(screen.getByText("190")).toBeInTheDocument();
    });

    it("displays explanation text", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(
        screen.getByText("This will reduce false warnings while maintaining safety."),
      ).toBeInTheDocument();
    });

    it("shows correct button labels for increase", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Yes, Adjust to 190")).toBeInTheDocument();
      expect(screen.getByText("No, Keep 180")).toBeInTheDocument();
      expect(screen.getByText("Remind Me Later")).toBeInTheDocument();
    });
  });

  describe("Decrease suggestion (AC8)", () => {
    it("displays correct message for decrease", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={decreaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(
        screen.getByText(/Your threshold hasn't been challenged recently/),
      ).toBeInTheDocument();
    });

    it("shows correct button labels for decrease", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={decreaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Yes, Lower to 180")).toBeInTheDocument();
      expect(screen.getByText("No, Keep 190")).toBeInTheDocument();
    });

    it("displays decrease explanation", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={decreaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(
        screen.getByText("Lowering your threshold provides more protection against AI detection."),
      ).toBeInTheDocument();
    });
  });

  describe("Maximum threshold warning (AC7)", () => {
    it("shows warning when approaching maximum", () => {
      const maxSuggestion: ThresholdSuggestion = {
        currentThreshold: 210,
        suggestedThreshold: 220,
        successfulOverrideCount: 3,
        averageOverrideScore: 215,
        direction: "increase",
      };

      render(
        <ThresholdAdjustmentNotification
          suggestion={maxSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText(/approaching the maximum safety threshold/)).toBeInTheDocument();
    });

    it("does not show warning for non-maximum suggestions", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(
        screen.queryByText(/approaching the maximum safety threshold/),
      ).not.toBeInTheDocument();
    });
  });

  describe("At maximum threshold (AC7)", () => {
    it("displays at maximum title and message", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={atMaximumSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Maximum Threshold Reached")).toBeInTheDocument();
      expect(screen.getByText(/maximum safety threshold \(220\)/)).toBeInTheDocument();
    });

    it("shows only current threshold (no suggested arrow)", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={atMaximumSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Current")).toBeInTheDocument();
      expect(screen.getByText("220")).toBeInTheDocument();
      expect(screen.queryByText("Suggested")).not.toBeInTheDocument();
      expect(screen.queryByText("→")).not.toBeInTheDocument();
    });

    it("shows only 'Got It' button", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={atMaximumSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("Got It")).toBeInTheDocument();
      expect(screen.queryByText(/Yes,/)).not.toBeInTheDocument();
      expect(screen.queryByText(/No, Keep/)).not.toBeInTheDocument();
      expect(screen.queryByText("Remind Me Later")).not.toBeInTheDocument();
    });

    it("calls onRemindLater when 'Got It' is clicked", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={atMaximumSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const gotItButton = screen.getByText("Got It");
      fireEvent.click(gotItButton);

      expect(mockOnRemindLater).toHaveBeenCalled();
    });

    it("shows warning icon for at maximum", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={atMaximumSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      expect(screen.getByText("⚠️")).toBeInTheDocument();
    });
  });

  describe("Button actions (AC5, AC6)", () => {
    it("calls apply_threshold_adjustment and onAccept when accept is clicked", async () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const acceptButton = screen.getByText("Yes, Adjust to 190");
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("apply_threshold_adjustment", {
          newThreshold: 190,
        });
      });

      await waitFor(() => {
        expect(mockOnAccept).toHaveBeenCalledWith(190);
      });
    });

    it("calls dismiss_threshold_suggestion and onReject when reject is clicked", async () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const rejectButton = screen.getByText("No, Keep 180");
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("dismiss_threshold_suggestion");
      });

      await waitFor(() => {
        expect(mockOnReject).toHaveBeenCalled();
      });
    });

    it("calls onRemindLater when remind button is clicked", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const remindButton = screen.getByText("Remind Me Later");
      fireEvent.click(remindButton);

      expect(mockOnRemindLater).toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard accessibility", () => {
    it("dismisses with remind later on Escape key", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      fireEvent.keyDown(window, { key: "Escape" });

      expect(mockOnRemindLater).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const notification = screen.getByRole("alert");
      expect(notification).toHaveAttribute("aria-live", "polite");
      expect(notification).toHaveAttribute("aria-labelledby", "threshold-notification-title");
    });

    it("accept button has autofocus", () => {
      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const acceptButton = screen.getByText("Yes, Adjust to 190");
      expect(acceptButton).toHaveFocus();
    });
  });

  describe("Error handling", () => {
    it("logs error when apply_threshold_adjustment fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Database error"));

      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const acceptButton = screen.getByText("Yes, Adjust to 190");
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to apply threshold adjustment:",
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it("logs error when dismiss_threshold_suggestion fails", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Database error"));

      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const rejectButton = screen.getByText("No, Keep 180");
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith("Failed to dismiss suggestion:", expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it("shows error message when apply_threshold_adjustment fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Database error"));

      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const acceptButton = screen.getByText("Yes, Adjust to 190");
      fireEvent.click(acceptButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to update threshold. Please try again."),
        ).toBeInTheDocument();
      });
    });

    it("shows error message when dismiss_threshold_suggestion fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error("Database error"));

      render(
        <ThresholdAdjustmentNotification
          suggestion={increaseSuggestion}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
          onRemindLater={mockOnRemindLater}
        />,
      );

      const rejectButton = screen.getByText("No, Keep 180");
      fireEvent.click(rejectButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to save preference. Please try again."),
        ).toBeInTheDocument();
      });
    });
  });
});
