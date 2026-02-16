import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import AnalyzeButton from "./AnalyzeButton";

describe("AnalyzeButton", () => {
  it("renders with correct default text", () => {
    render(<AnalyzeButton onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Analyze Job");
  });

  it("is disabled when disabled prop is true", () => {
    render(<AnalyzeButton onClick={() => {}} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is enabled when job content is present", () => {
    render(<AnalyzeButton onClick={() => {}} disabled={false} />);
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("is disabled when input is empty", () => {
    render(<AnalyzeButton onClick={() => {}} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state when analyzing", () => {
    render(<AnalyzeButton onClick={() => {}} loading={true} />);
    expect(screen.getByRole("button")).toHaveTextContent("Analyzing...");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<AnalyzeButton onClick={handleClick} disabled={false} />);
    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<AnalyzeButton onClick={handleClick} disabled={true} />);
    await user.click(screen.getByRole("button"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("has correct ARIA attributes", () => {
    render(<AnalyzeButton onClick={() => {}} />);
    const button = screen.getByRole("button");

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("title", "Extract job details (client name, skills, needs)");
  });

  it("applies analyze-button class", () => {
    render(<AnalyzeButton onClick={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("analyze-button");
  });
});
