import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import SafetyWarningModal from "./SafetyWarningModal";

describe("SafetyWarningModal", () => {
  const mockFlaggedSentences = [
    {
      text: "I am delighted to delve into this opportunity.",
      suggestion:
        "Replace 'delighted to delve' with 'excited to work on' - simpler, more natural phrasing.",
      index: 0,
    },
    {
      text: "I possess extensive experience in this domain.",
      suggestion: "Replace 'possess' with 'have' and 'domain' with 'area' for casual tone.",
      index: 1,
    },
    {
      text: "I would be honored to leverage my expertise.",
      suggestion: "Replace 'honored to leverage' with 'happy to use' - less formal.",
      index: 2,
    },
  ];

  const defaultProps = {
    score: 185.5,
    threshold: 180,
    flaggedSentences: mockFlaggedSentences,
    onEdit: vi.fn(),
    onOverride: vi.fn(),
  };

  it("renders warning header and score", () => {
    render(<SafetyWarningModal {...defaultProps} />);

    // Check warning header
    expect(
      screen.getByRole("heading", { name: /AI Detection Risk Detected/i }),
    ).toBeInTheDocument();

    // Check score display
    expect(screen.getByText(/Perplexity score:/i)).toBeInTheDocument();
    expect(screen.getByText(/185.5/i)).toBeInTheDocument();
    expect(screen.getByText(/threshold: 180/i)).toBeInTheDocument();
  });

  it("displays all flagged sentences with suggestions", () => {
    render(<SafetyWarningModal {...defaultProps} />);

    // Check all 3 flagged sentences are displayed
    expect(screen.getByText("I am delighted to delve into this opportunity.")).toBeInTheDocument();
    expect(screen.getByText("I possess extensive experience in this domain.")).toBeInTheDocument();
    expect(screen.getByText("I would be honored to leverage my expertise.")).toBeInTheDocument();

    // Check all 3 suggestions are displayed
    expect(
      screen.getByText(/Replace 'delighted to delve' with 'excited to work on'/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Replace 'possess' with 'have'/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Replace 'honored to leverage' with 'happy to use'/i),
    ).toBeInTheDocument();
  });

  it("highlights flagged sentences with correct structure", () => {
    const { container } = render(<SafetyWarningModal {...defaultProps} />);

    // Verify flagged sentence container structure
    const flaggedSentenceCards = container.querySelectorAll(".flagged-sentence");
    expect(flaggedSentenceCards.length).toBe(3);

    // Each card has a text element and a suggestion element
    flaggedSentenceCards.forEach((card) => {
      const textEl = card.querySelector(".flagged-sentence__text");
      const suggestionEl = card.querySelector(".flagged-sentence__suggestion");
      expect(textEl).not.toBeNull();
      expect(suggestionEl).not.toBeNull();
    });

    // Verify specific text content in highlight elements
    const textElements = container.querySelectorAll(".flagged-sentence__text");
    expect(textElements[0].textContent).toBe("I am delighted to delve into this opportunity.");
    expect(textElements[1].textContent).toBe("I possess extensive experience in this domain.");
    expect(textElements[2].textContent).toBe("I would be honored to leverage my expertise.");
  });

  it("renders action buttons correctly", () => {
    render(<SafetyWarningModal {...defaultProps} />);

    // Check "Edit Proposal" button
    const editButton = screen.getByRole("button", { name: /Edit Proposal/i });
    expect(editButton).toBeInTheDocument();
    expect(editButton.classList.contains("safety-warning-modal__button")).toBe(true);
    expect(editButton.classList.contains("button--primary")).toBe(true);

    // Check "Override (Risky)" button
    const overrideButton = screen.getByRole("button", {
      name: /Override \(Risky\)/i,
    });
    expect(overrideButton).toBeInTheDocument();
    expect(overrideButton.classList.contains("safety-warning-modal__button")).toBe(true);
    expect(overrideButton.classList.contains("button--danger")).toBe(true);
  });

  it("calls onEdit when Edit Proposal clicked", () => {
    const onEdit = vi.fn();
    render(<SafetyWarningModal {...defaultProps} onEdit={onEdit} />);

    const editButton = screen.getByRole("button", { name: /Edit Proposal/i });
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onOverride when Override clicked", () => {
    const onOverride = vi.fn();
    render(<SafetyWarningModal {...defaultProps} onOverride={onOverride} />);

    const overrideButton = screen.getByRole("button", {
      name: /Override \(Risky\)/i,
    });
    fireEvent.click(overrideButton);

    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it("handles empty flagged sentences array", () => {
    render(<SafetyWarningModal {...defaultProps} flaggedSentences={[]} />);

    // Modal should still render
    expect(
      screen.getByRole("heading", { name: /AI Detection Risk Detected/i }),
    ).toBeInTheDocument();

    // But no flagged sentences should be shown
    const flaggedSentenceElements = document.querySelectorAll(".flagged-sentence");
    expect(flaggedSentenceElements.length).toBe(0);
  });

  it("handles keyboard accessibility (Escape key)", () => {
    const onEdit = vi.fn();
    render(<SafetyWarningModal {...defaultProps} onEdit={onEdit} />);

    // Simulate Escape key press
    fireEvent.keyDown(window, { key: "Escape" });

    // onEdit should be called (Escape = close and edit)
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA attributes for accessibility", () => {
    render(<SafetyWarningModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "safety-warning-title");
  });

  it("autofocuses Edit Proposal button on render", async () => {
    render(<SafetyWarningModal {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /Edit Proposal/i });

    // Story 8.2: useFocusTrap uses requestAnimationFrame for focus, so wait for it
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    expect(document.activeElement).toBe(editButton);
  });

  // Story 3.4: Re-humanization tests
  describe("Regeneration with More Humanization (Story 3.4)", () => {
    it("shows regeneration button when onRegenerate provided and not at max intensity", () => {
      const onRegenerate = vi.fn();
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={onRegenerate}
          humanizationIntensity="medium"
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /Regenerate with More Humanization/i,
      });
      expect(regenerateButton).toBeInTheDocument();
      expect(regenerateButton).not.toBeDisabled();
    });

    it("calls onRegenerate when regeneration button clicked", () => {
      const onRegenerate = vi.fn();
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={onRegenerate}
          humanizationIntensity="medium"
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /Regenerate with More Humanization/i,
      });
      fireEvent.click(regenerateButton);

      expect(onRegenerate).toHaveBeenCalledTimes(1);
    });

    it("shows attempt counter when attemptCount > 0", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={vi.fn()}
          humanizationIntensity="medium"
          attemptCount={1}
        />,
      );

      expect(screen.getByText(/Attempt 2 of 3/i)).toBeInTheDocument();
    });

    it("disables regeneration button when at max intensity (heavy)", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={vi.fn()}
          humanizationIntensity="heavy"
        />,
      );

      expect(
        screen.queryByRole("button", {
          name: /Regenerate with More Humanization/i,
        }),
      ).not.toBeInTheDocument();

      expect(screen.getByText(/Already at maximum humanization intensity/i)).toBeInTheDocument();
    });

    it("disables regeneration when max attempts reached", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={vi.fn()}
          humanizationIntensity="medium"
          attemptCount={3}
        />,
      );

      expect(
        screen.queryByRole("button", {
          name: /Regenerate with More Humanization/i,
        }),
      ).not.toBeInTheDocument();

      expect(screen.getByText(/Maximum regeneration attempts \(3\) reached/i)).toBeInTheDocument();
    });

    it("shows loading state when isRegenerating is true", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          onRegenerate={vi.fn()}
          humanizationIntensity="medium"
          isRegenerating={true}
        />,
      );

      const regenerateButton = screen.getByRole("button", {
        name: /Regenerating.../i,
      });
      expect(regenerateButton).toBeDisabled();
    });

    it("shows score comparison when previousScore provided", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          score={165}
          onRegenerate={vi.fn()}
          humanizationIntensity="medium"
          attemptCount={1}
          previousScore={185.5}
        />,
      );

      expect(screen.getByText(/Previous: 185.5/i)).toBeInTheDocument();
      expect(screen.getByText(/✓ Improved/i)).toBeInTheDocument();
    });

    it("shows no improvement message when score does not improve", () => {
      render(
        <SafetyWarningModal
          {...defaultProps}
          score={190}
          onRegenerate={vi.fn()}
          humanizationIntensity="medium"
          attemptCount={1}
          previousScore={185.5}
        />,
      );

      expect(screen.getByText(/Previous: 185.5/i)).toBeInTheDocument();
      expect(screen.getByText(/⚠ No improvement/i)).toBeInTheDocument();
    });

    it("does not show regeneration section when onRegenerate not provided", () => {
      render(<SafetyWarningModal {...defaultProps} humanizationIntensity="medium" />);

      expect(
        screen.queryByRole("button", {
          name: /Regenerate with More Humanization/i,
        }),
      ).not.toBeInTheDocument();
    });
  });
});
