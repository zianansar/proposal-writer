import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import ReadyStep from "./ReadyStep";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("ReadyStep", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(true);
    vi.clearAllMocks();
  });

  it("displays completion message", () => {
    render(<ReadyStep />);
    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
  });

  it("displays instruction to paste job post", () => {
    render(<ReadyStep />);
    expect(
      screen.getByText("Paste a job post to get started with your first proposal.")
    ).toBeInTheDocument();
  });

  it("has Start Using App button", () => {
    render(<ReadyStep />);
    expect(
      screen.getByRole("button", { name: /start using app/i })
    ).toBeInTheDocument();
  });

  it("calls set_setting and closes wizard on complete", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    render(<ReadyStep />);

    await user.click(screen.getByRole("button", { name: /start using app/i }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("set_setting", {
        key: "onboarding_completed",
        value: "true",
      });
      expect(useOnboardingStore.getState().showOnboarding).toBe(false);
    });
  });

  it("resets wizard state after completion", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    // Set non-default state
    useOnboardingStore.getState().setCurrentStep(4);

    render(<ReadyStep />);

    await user.click(screen.getByRole("button", { name: /start using app/i }));

    await waitFor(() => {
      expect(useOnboardingStore.getState().currentStep).toBe(1);
    });
  });

  it("shows error and keeps wizard open if set_setting fails", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockRejectedValueOnce(new Error("DB error"));

    render(<ReadyStep />);

    await user.click(screen.getByRole("button", { name: /start using app/i }));

    // Review Fix #3: Wizard should stay open on error
    await waitFor(() => {
      expect(screen.getByText("DB error")).toBeInTheDocument();
      expect(useOnboardingStore.getState().showOnboarding).toBe(true);
    });

    // Button should show "Retry" after error
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
