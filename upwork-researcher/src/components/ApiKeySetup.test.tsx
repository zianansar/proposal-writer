import { invoke } from "@tauri-apps/api/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ApiKeySetup from "./ApiKeySetup";

describe("ApiKeySetup", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome message for first-time setup", () => {
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
  });

  it("renders update message when existingKey is provided", () => {
    render(<ApiKeySetup onComplete={mockOnComplete} existingKey="sk-ant-...1234" />);

    expect(screen.getByText(/update api key/i)).toBeInTheDocument();
    expect(screen.getByText("sk-ant-...1234")).toBeInTheDocument();
  });

  it("renders API key input field", () => {
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/sk-ant-/i)).toBeInTheDocument();
  });

  it("shows validation error for invalid prefix", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "invalid-key-12345678901234");

    expect(screen.getByText(/must start with 'sk-ant-'/i)).toBeInTheDocument();
  });

  it("shows validation error for short key", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-short");

    expect(screen.getByText(/too short/i)).toBeInTheDocument();
  });

  it("clears validation error for valid key format", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-api03-validkey12345678");

    expect(screen.queryByText(/must start with/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/too short/i)).not.toBeInTheDocument();
  });

  it("shows warning about encryption", () => {
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    expect(screen.getByText(/stored locally/i)).toBeInTheDocument();
    expect(screen.getByText(/encrypted storage/i)).toBeInTheDocument();
  });

  it("disables submit button when input is empty", () => {
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it("disables submit button when validation error exists", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "invalid-key");

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button with valid key", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-api03-validkey12345678");

    const submitButton = screen.getByRole("button", { name: /save/i });
    expect(submitButton).not.toBeDisabled();
  });

  it("calls set_api_key and onComplete on valid submit", async () => {
    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-api03-validkey12345678");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_api_key", {
        apiKey: "sk-ant-api03-validkey12345678",
      });
    });

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it("shows error when set_api_key fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Save failed"));

    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-api03-validkey12345678");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/save failed/i)).toBeInTheDocument();
    });

    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it("shows Saving... while submitting", async () => {
    // Make invoke hang to test loading state
    vi.mocked(invoke).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );

    const user = userEvent.setup();
    render(<ApiKeySetup onComplete={mockOnComplete} />);

    const input = screen.getByLabelText(/anthropic api key/i);
    await user.type(input, "sk-ant-api03-validkey12345678");

    const submitButton = screen.getByRole("button", { name: /save/i });
    await user.click(submitButton);

    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });
});
