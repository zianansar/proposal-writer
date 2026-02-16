import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import GenerateButton from "./GenerateButton";

describe("GenerateButton", () => {
  it("renders a button with 'Generate Proposal' text", () => {
    render(<GenerateButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GenerateButton onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows 'Generating...' when loading", () => {
    render(<GenerateButton onClick={() => {}} loading={true} />);
    expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
  });

  it("is disabled when loading", () => {
    render(<GenerateButton onClick={() => {}} loading={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<GenerateButton onClick={() => {}} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is not disabled by default", () => {
    render(<GenerateButton onClick={() => {}} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  // =========================================================================
  // Story 3.8: Cooldown tests
  // =========================================================================

  // Story 3.8, Task 7.7: Test shows countdown text when cooldownSeconds > 0
  it("shows countdown text when cooldownSeconds > 0", () => {
    render(<GenerateButton onClick={() => {}} cooldownSeconds={47} />);
    expect(screen.getByRole("button", { name: /please wait 47s/i })).toBeInTheDocument();
  });

  // Story 3.8, Task 7.8: Test button disabled during cooldown
  it("is disabled during cooldown", () => {
    render(<GenerateButton onClick={() => {}} cooldownSeconds={30} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // Story 3.8, Task 7.9: Test button re-enables when cooldownSeconds is 0
  it("re-enables when cooldownSeconds is 0", () => {
    render(<GenerateButton onClick={() => {}} cooldownSeconds={0} />);
    expect(screen.getByRole("button")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeInTheDocument();
  });

  // Story 3.8: Test cooldown class is added
  it("adds cooldown class when cooling down", () => {
    render(<GenerateButton onClick={() => {}} cooldownSeconds={10} />);
    expect(screen.getByRole("button")).toHaveClass("cooldown");
  });

  // Story 3.8: Test cooldown class is not added when not cooling down
  it("does not add cooldown class when not cooling down", () => {
    render(<GenerateButton onClick={() => {}} cooldownSeconds={0} />);
    expect(screen.getByRole("button")).not.toHaveClass("cooldown");
  });

  // Story 3.8: Test loading state takes precedence over cooldown display
  it("shows loading text over cooldown when both active", () => {
    render(<GenerateButton onClick={() => {}} loading={true} cooldownSeconds={30} />);
    expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
  });
});
