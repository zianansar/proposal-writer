import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import WelcomeStep from "./WelcomeStep";

describe("WelcomeStep", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it("displays welcome message", () => {
    render(<WelcomeStep />);
    expect(
      screen.getByText("Welcome to Upwork Research Agent!")
    ).toBeInTheDocument();
  });

  it("displays conversational explanation", () => {
    render(<WelcomeStep />);
    expect(
      screen.getByText("This tool helps you write personalized proposals faster.")
    ).toBeInTheDocument();
  });

  it("has Get Started button", () => {
    render(<WelcomeStep />);
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
  });

  it("advances to step 2 when Get Started is clicked", async () => {
    const user = userEvent.setup();
    render(<WelcomeStep />);

    await user.click(screen.getByRole("button", { name: /get started/i }));

    expect(useOnboardingStore.getState().currentStep).toBe(2);
  });
});
