import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import CopyButton from "./CopyButton";

const mockWriteText = vi.mocked(writeText);

describe("CopyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with default text", () => {
    render(<CopyButton text="Test proposal" />);
    expect(screen.getByRole("button")).toHaveTextContent("Copy to Clipboard");
  });

  it("calls writeText with the provided text when clicked", async () => {
    render(<CopyButton text="Test proposal text" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(mockWriteText).toHaveBeenCalledWith("Test proposal text");
  });

  it("shows 'Copied!' after successful copy", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copied!");
  });

  it("returns to 'Copy to Clipboard' after 2 seconds", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copied!");

    // Advance timers by 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("button")).toHaveTextContent("Copy to Clipboard");
  });

  it("is disabled when disabled prop is true", () => {
    render(<CopyButton text="Test proposal" disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when text is empty", () => {
    render(<CopyButton text="" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call writeText when disabled", async () => {
    render(<CopyButton text="Test proposal" disabled />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it("shows error message when copy fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Clipboard error"));
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to copy to clipboard");
  });

  it("has correct aria-label for accessibility", () => {
    render(<CopyButton text="Test proposal" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Copy to clipboard");
  });

  it("updates aria-label after copy", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);
    render(<CopyButton text="Test proposal" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Copied to clipboard");
  });
});
