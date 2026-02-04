import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import ApiKeyStep from "./ApiKeyStep";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("ApiKeyStep", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    vi.clearAllMocks();
  });

  it("displays API key setup heading", () => {
    render(<ApiKeyStep />);
    expect(screen.getByText("API Key Setup")).toBeInTheDocument();
  });

  it("displays link to console.anthropic.com", () => {
    render(<ApiKeyStep />);
    const link = screen.getByRole("link", { name: /console.anthropic.com/i });
    expect(link).toHaveAttribute("href", "https://console.anthropic.com");
  });

  it("has password input field with placeholder", () => {
    render(<ApiKeyStep />);
    const input = screen.getByPlaceholderText("sk-ant-...");
    expect(input).toHaveAttribute("type", "password");
  });

  it("disables Next button when input is empty", () => {
    render(<ApiKeyStep />);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("enables Next button when input has value", async () => {
    const user = userEvent.setup();
    render(<ApiKeyStep />);

    await user.type(screen.getByPlaceholderText("sk-ant-..."), "sk-ant-test");

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("shows validation error for invalid key format", async () => {
    const user = userEvent.setup();
    render(<ApiKeyStep />);

    await user.type(screen.getByPlaceholderText("sk-ant-..."), "invalid-key");
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByText(/Invalid API key format/i)
    ).toBeInTheDocument();
  });

  it("calls set_api_key and advances to step 3 on valid key", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    render(<ApiKeyStep />);

    await user.type(
      screen.getByPlaceholderText("sk-ant-..."),
      "sk-ant-valid-key-123"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_api_key", {
        apiKey: "sk-ant-valid-key-123",
      });
      expect(useOnboardingStore.getState().currentStep).toBe(3);
      // Review Fix #5: apiKey no longer stored in Zustand (already persisted via Tauri)
    });
  });

  it("shows error message when set_api_key fails", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Network error"));

    render(<ApiKeyStep />);

    await user.type(
      screen.getByPlaceholderText("sk-ant-..."),
      "sk-ant-valid-key"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("goes back to step 1 when Back button is clicked", async () => {
    const user = userEvent.setup();
    useOnboardingStore.getState().setCurrentStep(2);

    render(<ApiKeyStep />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(1);
  });
});
