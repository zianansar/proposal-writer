/**
 * HealthCheckModal component tests (Story TD2.3 Task 4.1, AC-7, AC-5)
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HealthCheckModal } from "./HealthCheckModal";

// Mock useFocusTrap — tested separately in hooks/useFocusTrap.test.ts
vi.mock("../hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

const defaultProgress = {
  currentCheck: 0,
  totalChecks: 4,
  checkName: "",
};

describe("HealthCheckModal", () => {
  it("renders null when isOpen=false", () => {
    const { container } = render(
      <HealthCheckModal isOpen={false} progress={defaultProgress} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with title when isOpen=true", () => {
    render(<HealthCheckModal isOpen={true} progress={defaultProgress} />);
    expect(screen.getByText("Verifying app health...")).toBeInTheDocument();
  });

  it("displays correct currentCheck / totalChecks", () => {
    const progress = { currentCheck: 2, totalChecks: 4, checkName: "Schema version" };
    render(<HealthCheckModal isOpen={true} progress={progress} />);
    expect(screen.getByText("2/4 checks complete")).toBeInTheDocument();
  });

  it("displays checkName in progress text", () => {
    const progress = { currentCheck: 1, totalChecks: 4, checkName: "Database connection" };
    render(<HealthCheckModal isOpen={true} progress={progress} />);
    expect(screen.getByText("Database connection")).toBeInTheDocument();
  });

  it("progressbar aria-valuenow matches currentCheck", () => {
    const progress = { currentCheck: 3, totalChecks: 4, checkName: "Settings accessible" };
    render(<HealthCheckModal isOpen={true} progress={progress} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "3");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "4");
  });

  it("has role=dialog and aria-modal=true (AC-5)", () => {
    render(<HealthCheckModal isOpen={true} progress={defaultProgress} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "health-check-title");
  });

  it("check name paragraph has aria-live=polite for screen reader announcements (AC-5)", () => {
    const progress = { currentCheck: 2, totalChecks: 4, checkName: "Database integrity" };
    render(<HealthCheckModal isOpen={true} progress={progress} />);
    const checkNameEl = screen.getByText("Database integrity");
    expect(checkNameEl).toHaveAttribute("aria-live", "polite");
    expect(checkNameEl).toHaveAttribute("aria-atomic", "true");
  });
});
