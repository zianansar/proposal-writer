import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import EncryptionStatusIndicator from "./EncryptionStatusIndicator";
import type { EncryptionStatus } from "./EncryptionStatusIndicator";

describe("EncryptionStatusIndicator", () => {
  const encryptedStatus: EncryptionStatus = {
    databaseEncrypted: true,
    apiKeyInKeychain: true,
    cipherVersion: "4.10.0",
  };

  const unencryptedStatus: EncryptionStatus = {
    databaseEncrypted: false,
    apiKeyInKeychain: false,
    cipherVersion: "N/A",
  };

  // Subtask 6.1: renders lock icon when encryption enabled
  it("renders lock icon when encryption enabled", () => {
    const onOpenDetails = vi.fn();
    const { container } = render(
      <EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={onOpenDetails} />,
    );

    const button = screen.getByRole("button", {
      name: /encryption status/i,
    });
    expect(button).toBeInTheDocument();

    // SVG lock icon present
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  // Subtask 6.2: tooltip appears on hover with correct text
  it("shows tooltip on hover with correct text", () => {
    const onOpenDetails = vi.fn();
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={onOpenDetails} />);

    const button = screen.getByRole("button");

    // Hover to show tooltip
    fireEvent.mouseEnter(button);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toBe("Data encrypted with AES-256");

    // Leave to hide
    fireEvent.mouseLeave(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // Subtask 6.3: clicking icon opens encryption details modal
  it("calls onOpenDetails when clicked", () => {
    const onOpenDetails = vi.fn();
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={onOpenDetails} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  // Subtask 6.7: indicator hidden when encryption not enabled
  it("renders nothing when encryption not enabled", () => {
    const onOpenDetails = vi.fn();
    const { container } = render(
      <EncryptionStatusIndicator status={unencryptedStatus} onOpenDetails={onOpenDetails} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("has accessible aria-label", () => {
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Encryption status: enabled. Data encrypted with AES-256",
    );
  });

  it("shows tooltip on focus for keyboard users", () => {
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={vi.fn()} />);

    const button = screen.getByRole("button");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // Review Fix M1: tooltip associated via aria-describedby
  it("associates tooltip with button via aria-describedby when visible", () => {
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={vi.fn()} />);

    const button = screen.getByRole("button");

    // No aria-describedby when tooltip hidden
    expect(button).not.toHaveAttribute("aria-describedby");

    // Show tooltip
    fireEvent.mouseEnter(button);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("id", "encryption-tooltip");
    expect(button).toHaveAttribute("aria-describedby", "encryption-tooltip");

    // Hide tooltip
    fireEvent.mouseLeave(button);
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("opens details on Enter key", () => {
    const onOpenDetails = vi.fn();
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={onOpenDetails} />);

    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("opens details on Space key", () => {
    const onOpenDetails = vi.fn();
    render(<EncryptionStatusIndicator status={encryptedStatus} onOpenDetails={onOpenDetails} />);

    const button = screen.getByRole("button");
    fireEvent.keyDown(button, { key: " " });
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});
