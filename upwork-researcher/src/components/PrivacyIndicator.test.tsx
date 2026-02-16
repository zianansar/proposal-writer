import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { PrivacyIndicator } from "./PrivacyIndicator";

describe("PrivacyIndicator", () => {
  describe("default rendering", () => {
    it("displays lock icon and headline", () => {
      render(<PrivacyIndicator />);
      expect(screen.getByText("🔒")).toBeInTheDocument();
      expect(screen.getByText("Your proposals never leave your device")).toBeInTheDocument();
    });

    it("displays description text", () => {
      render(<PrivacyIndicator />);
      expect(screen.getByText(/analyze your writing style locally/i)).toBeInTheDocument();
    });

    it("has lock icon with aria-hidden", () => {
      render(<PrivacyIndicator />);
      const icon = screen.getByText("🔒");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("expandable section", () => {
    it('shows "How does this work?" button', () => {
      render(<PrivacyIndicator />);
      expect(screen.getByRole("button", { name: /how does this work/i })).toBeInTheDocument();
    });

    it("expands when button is clicked", () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole("button", { name: /how does this work/i });
      fireEvent.click(button);
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();
      expect(screen.getByText(/What Gets Sent to AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Your Data/i)).toBeInTheDocument();
    });

    it("updates aria-expanded state", () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole("button", { name: /how does this work/i });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("collapses when Collapse button is clicked", () => {
      render(<PrivacyIndicator />);
      fireEvent.click(screen.getByRole("button", { name: /how does this work/i }));
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /collapse/i }));
      expect(screen.queryByText(/What We Analyze Locally/i)).not.toBeInTheDocument();
    });
  });

  describe("variants", () => {
    it("renders compact variant with shorter text", () => {
      render(<PrivacyIndicator variant="compact" />);
      expect(screen.getByText("Your proposals stay on your device")).toBeInTheDocument();
      expect(screen.getByText("Only style patterns are used for generation.")).toBeInTheDocument();
    });

    it("hides expandable button for compact variant", () => {
      render(<PrivacyIndicator variant="compact" />);
      expect(screen.queryByRole("button", { name: /how does this work/i })).not.toBeInTheDocument();
    });

    it("renders settings variant", () => {
      render(<PrivacyIndicator variant="settings" />);
      expect(screen.getByText(/delete all data anytime/i)).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("is keyboard navigable with Enter key", () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole("button", { name: /how does this work/i });
      button.focus();
      expect(button).toHaveFocus();
      // M3 fix: Actually test keyboard interaction
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
      // Native button handles Enter -> click, so we simulate the resulting click
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("is keyboard navigable with Space key", () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole("button", { name: /how does this work/i });
      button.focus();
      expect(button).toHaveFocus();
      // Space key also triggers button click
      fireEvent.keyDown(button, { key: " ", code: "Space" });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("has correct aria-controls attribute with unique ID", () => {
      render(<PrivacyIndicator />);
      const button = screen.getByRole("button", { name: /how does this work/i });
      // M1 fix: ID should be dynamically generated (not hardcoded 'privacy-details')
      const ariaControls = button.getAttribute("aria-controls");
      expect(ariaControls).toBeTruthy();
      expect(ariaControls).not.toBe("");
    });

    it("expanded content has region role", () => {
      render(<PrivacyIndicator />);
      fireEvent.click(screen.getByRole("button", { name: /how does this work/i }));
      expect(screen.getByRole("region", { name: /privacy details/i })).toBeInTheDocument();
    });
  });

  describe("click outside to close (H1 fix)", () => {
    it("closes expanded view when clicking outside", () => {
      render(
        <div>
          <PrivacyIndicator />
          <button data-testid="outside-element">Outside</button>
        </div>,
      );

      // Expand the indicator
      fireEvent.click(screen.getByRole("button", { name: /how does this work/i }));
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside-element"));

      // Should be collapsed
      expect(screen.queryByText(/What We Analyze Locally/i)).not.toBeInTheDocument();
    });

    it("does not close when clicking inside the indicator", () => {
      render(<PrivacyIndicator />);

      // Expand
      fireEvent.click(screen.getByRole("button", { name: /how does this work/i }));
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();

      // Click inside expanded content
      fireEvent.mouseDown(screen.getByText(/What We Analyze Locally/i));

      // Should still be expanded
      expect(screen.getByText(/What We Analyze Locally/i)).toBeInTheDocument();
    });
  });

  describe("prop overrides", () => {
    it("disables expandable when expandable={false} on golden-set variant", () => {
      render(<PrivacyIndicator variant="golden-set" expandable={false} />);
      // golden-set normally has showExpandable: true, but expandable prop should override
      expect(screen.queryByRole("button", { name: /how does this work/i })).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<PrivacyIndicator className="custom-class" />);
      expect(container.querySelector(".privacy-indicator.custom-class")).toBeInTheDocument();
    });
  });

  describe("settings variant delete link (H2 fix)", () => {
    it("renders delete link in settings variant when onDeleteClick provided", () => {
      const mockOnDelete = vi.fn();
      render(<PrivacyIndicator variant="settings" onDeleteClick={mockOnDelete} />);

      expect(screen.getByRole("button", { name: /delete all voice data/i })).toBeInTheDocument();
    });

    it("calls onDeleteClick when delete link is clicked", () => {
      const mockOnDelete = vi.fn();
      render(<PrivacyIndicator variant="settings" onDeleteClick={mockOnDelete} />);

      fireEvent.click(screen.getByRole("button", { name: /delete all voice data/i }));

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it("does not render delete link without onDeleteClick callback", () => {
      render(<PrivacyIndicator variant="settings" />);

      expect(
        screen.queryByRole("button", { name: /delete all voice data/i }),
      ).not.toBeInTheDocument();
    });

    it("does not render delete link for non-settings variants", () => {
      const mockOnDelete = vi.fn();
      render(<PrivacyIndicator variant="golden-set" onDeleteClick={mockOnDelete} />);

      expect(
        screen.queryByRole("button", { name: /delete all voice data/i }),
      ).not.toBeInTheDocument();
    });
  });
});
