/**
 * Job Score Badge Component Tests - Story 4b.9
 * Tests AC-2, AC-7
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import JobScoreBadge from "./JobScoreBadge";

describe("JobScoreBadge", () => {
  describe("AC-7.2: Circular badge display", () => {
    it("renders score with decimal", () => {
      render(<JobScoreBadge score={87.5} color="green" />);
      expect(screen.getByText("87.5")).toBeInTheDocument();
    });

    it("rounds score to 1 decimal place", () => {
      render(<JobScoreBadge score={87.456} color="green" />);
      expect(screen.getByText("87.5")).toBeInTheDocument();
    });
  });

  describe("AC-7.3: Correct colors for each ScoreColor value", () => {
    it("applies green class for green color", () => {
      const { container } = render(<JobScoreBadge score={85} color="green" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-green");
    });

    it("applies yellow class for yellow color", () => {
      const { container } = render(<JobScoreBadge score={65} color="yellow" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-yellow");
    });

    it("applies red class for red color", () => {
      const { container } = render(<JobScoreBadge score={45} color="red" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-red");
    });

    it("applies gray class for gray color", () => {
      const { container } = render(<JobScoreBadge score={null} color="gray" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-gray");
    });
  });

  describe("AC-7.4: Size variants", () => {
    it("applies sm size by default", () => {
      const { container } = render(<JobScoreBadge score={85} color="green" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-badge-sm");
    });

    it("applies sm size when explicitly set", () => {
      const { container } = render(<JobScoreBadge score={85} color="green" size="sm" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-badge-sm");
    });

    it("applies lg size when specified", () => {
      const { container } = render(<JobScoreBadge score={85} color="green" size="lg" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-badge-lg");
    });
  });

  describe("AC-7.5: Accessibility", () => {
    it('has role="status"', () => {
      render(<JobScoreBadge score={85} color="green" />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("has descriptive aria-label for green scores", () => {
      render(<JobScoreBadge score={85} color="green" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Score: 85.0, good match");
    });

    it("has descriptive aria-label for yellow scores", () => {
      render(<JobScoreBadge score={65} color="yellow" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Score: 65.0, moderate match");
    });

    it("has descriptive aria-label for red scores", () => {
      render(<JobScoreBadge score={45} color="red" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Score: 45.0, poor match");
    });

    it("has descriptive aria-label for null scores", () => {
      render(<JobScoreBadge score={null} color="gray" />);
      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Not yet scored");
    });
  });

  describe("AC-7.6: Handle null score", () => {
    it('displays "—" for null score', () => {
      render(<JobScoreBadge score={null} color="gray" />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("applies gray class for null scores", () => {
      const { container } = render(<JobScoreBadge score={null} color="gray" />);
      const badge = container.querySelector(".score-badge");
      expect(badge).toHaveClass("score-gray");
    });
  });

  describe("Edge cases", () => {
    it("handles score of 0", () => {
      render(<JobScoreBadge score={0} color="red" />);
      expect(screen.getByText("0.0")).toBeInTheDocument();
    });

    it("handles score of 100", () => {
      render(<JobScoreBadge score={100} color="green" />);
      expect(screen.getByText("100.0")).toBeInTheDocument();
    });

    it("handles fractional scores", () => {
      render(<JobScoreBadge score={87.3} color="green" />);
      expect(screen.getByText("87.3")).toBeInTheDocument();
    });
  });
});
