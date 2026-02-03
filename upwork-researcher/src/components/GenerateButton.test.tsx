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
});
