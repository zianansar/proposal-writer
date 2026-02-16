/**
 * Story 4b.4: Budget Alignment Badge Tests (Subtask 9.5)
 *
 * Tests:
 * - Green badge for aligned budgets (>=100%)
 * - Yellow badge for 70-99% alignment
 * - Red badge for <70% alignment
 * - Gray badge for unknown/mismatch
 * - "Configure rates" message when user has no rates
 * - Tooltip shows correct details
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import BudgetAlignmentBadge from "./BudgetAlignmentBadge";

describe("BudgetAlignmentBadge", () => {
  describe("Green badge (>=100% alignment)", () => {
    it("renders green badge for 100% alignment", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={75}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveClass("budget-alignment--green");
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("renders green badge for >100% alignment", () => {
      render(
        <BudgetAlignmentBadge
          percentage={125}
          status="green"
          budgetMin={100}
          budgetMax={100}
          budgetType="hourly"
          userHourlyRate={80}
        />,
      );

      expect(screen.getByText("125%")).toBeInTheDocument();
      expect(screen.getByTestId("budget-alignment-badge")).toHaveClass("budget-alignment--green");
    });
  });

  describe("Yellow badge (70-99% alignment)", () => {
    it("renders yellow badge for 80% alignment", () => {
      render(
        <BudgetAlignmentBadge
          percentage={80}
          status="yellow"
          budgetMin={60}
          budgetMax={60}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveClass("budget-alignment--yellow");
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    it("renders yellow badge for 70% alignment (boundary)", () => {
      render(
        <BudgetAlignmentBadge
          percentage={70}
          status="yellow"
          budgetMin={52.5}
          budgetMax={52.5}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      expect(screen.getByText("70%")).toBeInTheDocument();
      expect(screen.getByTestId("budget-alignment-badge")).toHaveClass("budget-alignment--yellow");
    });
  });

  describe("Red badge (<70% alignment)", () => {
    it("renders red badge for 50% alignment", () => {
      render(
        <BudgetAlignmentBadge
          percentage={50}
          status="red"
          budgetMin={37.5}
          budgetMax={37.5}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveClass("budget-alignment--red");
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.getByText("Below rate")).toBeInTheDocument();
    });

    it("renders red badge for 69% alignment (boundary)", () => {
      render(
        <BudgetAlignmentBadge
          percentage={69}
          status="red"
          budgetMin={51.75}
          budgetMax={51.75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      expect(screen.getByText("69%")).toBeInTheDocument();
      expect(screen.getByTestId("budget-alignment-badge")).toHaveClass("budget-alignment--red");
    });
  });

  describe("Gray badge (unknown/mismatch)", () => {
    it("renders gray badge for unknown budget", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="gray"
          budgetMin={null}
          budgetMax={null}
          budgetType="unknown"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveClass("budget-alignment--gray");
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("renders gray badge for type mismatch", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="mismatch"
          budgetMin={50}
          budgetMax={50}
          budgetType="hourly"
          userProjectRateMin={2000}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveClass("budget-alignment--gray");
      expect(screen.getByText("Type Mismatch")).toBeInTheDocument();
    });
  });

  describe("No rates configured message", () => {
    it("shows configure rates message when no hourly rate for hourly job", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="mismatch"
          budgetMin={50}
          budgetMax={50}
          budgetType="hourly"
        />,
      );

      expect(screen.getByText("Configure rates in Settings")).toBeInTheDocument();
    });

    it("shows configure rates message when no project rate for fixed job", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="mismatch"
          budgetMin={2000}
          budgetMax={2000}
          budgetType="fixed"
        />,
      );

      expect(screen.getByText("Configure rates in Settings")).toBeInTheDocument();
    });

    it("does not show configure message for unknown budget type", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="gray"
          budgetMin={null}
          budgetMax={null}
          budgetType="unknown"
        />,
      );

      expect(screen.queryByText("Configure rates in Settings")).not.toBeInTheDocument();
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("Tooltip and accessibility", () => {
    it("has correct aria-label for green status", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={75}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute(
        "aria-label",
        "Budget alignment: 100 percent, meets your rate expectations",
      );
    });

    it("has correct aria-label for yellow status", () => {
      render(
        <BudgetAlignmentBadge
          percentage={80}
          status="yellow"
          budgetMin={60}
          budgetMax={60}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute(
        "aria-label",
        "Budget alignment: 80 percent, slightly below your rate",
      );
    });

    it("has correct aria-label for red status", () => {
      render(
        <BudgetAlignmentBadge
          percentage={50}
          status="red"
          budgetMin={37.5}
          budgetMax={37.5}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute(
        "aria-label",
        "Budget alignment: 50 percent, significantly below your rate",
      );
    });

    it("has tooltip with budget details for hourly job", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={75}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute("title", "Job budget: $75/hr, Your rate: $75/hr");
    });

    it("has tooltip with budget range for hourly range", () => {
      render(
        <BudgetAlignmentBadge
          percentage={80}
          status="yellow"
          budgetMin={50}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute("title", "Job budget: $50-$75/hr, Your rate: $75/hr");
    });

    it("has tooltip with budget details for fixed job", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={2000}
          budgetMax={2000}
          budgetType="fixed"
          userProjectRateMin={2000}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute(
        "title",
        "Job budget: $2000 fixed, Your minimum: $2000+ projects",
      );
    });

    it("has mismatch tooltip for hourly job without hourly rate", () => {
      render(
        <BudgetAlignmentBadge
          percentage={null}
          status="mismatch"
          budgetMin={50}
          budgetMax={50}
          budgetType="hourly"
          userProjectRateMin={2000}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute(
        "title",
        "Job is hourly but you haven't configured an hourly rate in Settings",
      );
    });

    it("is keyboard focusable", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={75}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute("tabIndex", "0");
    });

    it("has status role for screen readers", () => {
      render(
        <BudgetAlignmentBadge
          percentage={100}
          status="green"
          budgetMin={75}
          budgetMax={75}
          budgetType="hourly"
          userHourlyRate={75}
        />,
      );

      const badge = screen.getByTestId("budget-alignment-badge");
      expect(badge).toHaveAttribute("role", "status");
    });
  });
});
