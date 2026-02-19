import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import App from "./App";
import { useGenerationStore } from "./stores/useGenerationStore";
import { useOnboardingStore } from "./stores/useOnboardingStore";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

// Story 10.5: Import listen mock for strategies:updated event testing
import { listen } from "@tauri-apps/api/event";
const mockListen = vi.mocked(listen);

// Mock Tauri updater/process plugins (Story 9.7 Task 5.7)
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

// Mock @tauri-apps/api/app for getVersion (Story TD2.3 Task 5)
vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("1.2.0"),
}));

import { check } from "@tauri-apps/plugin-updater";
const mockCheck = vi.mocked(check);

// Helper to setup invoke mock with API key check and onboarding completed
const setupInvokeMock = () => {
  mockInvoke.mockImplementation((command: string, args?: any) => {
    if (command === "has_api_key") {
      return Promise.resolve(true);
    }
    if (command === "get_setting" && args?.key === "onboarding_completed") {
      return Promise.resolve("true"); // Onboarding already completed
    }
    return Promise.resolve(null);
  });
};

// Helper to wait for app to finish loading (API key check)
const waitForAppReady = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useGenerationStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false); // Hide onboarding for tests
    // Setup default mock for has_api_key and onboarding
    setupInvokeMock();
  });

  it("renders the app heading", async () => {
    render(<App />);
    await waitForAppReady();
    expect(screen.getByRole("heading", { name: /upwork research agent/i })).toBeInTheDocument();
  });

  it("renders the job input textarea", async () => {
    render(<App />);
    await waitForAppReady();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the generate button", async () => {
    render(<App />);
    await waitForAppReady();
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeInTheDocument();
  });

  it("disables generate button when input is empty", async () => {
    render(<App />);
    await waitForAppReady();
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeDisabled();
  });

  it("enables generate button when input has content", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForAppReady();
    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    expect(screen.getByRole("button", { name: /generate proposal/i })).not.toBeDisabled();
  });

  it("shows error when trying to generate with empty input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForAppReady();
    // Type and then clear to enable button momentarily
    await user.type(screen.getByRole("textbox"), "a");
    await user.clear(screen.getByRole("textbox"));
    // Button should be disabled again, so this tests the validation
    expect(screen.getByRole("button", { name: /generate proposal/i })).toBeDisabled();
  });

  it("calls invoke with job content when generate is clicked", async () => {
    const user = userEvent.setup();

    render(<App />);
    await waitForAppReady();
    await user.type(screen.getByRole("textbox"), "Looking for a React developer");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    expect(mockInvoke).toHaveBeenCalledWith("generate_proposal_streaming", {
      jobContent: "Looking for a React developer",
      strategyId: null, // Story 5.2: Strategy ID passed to backend (null if not selected)
    });
  });

  it("displays generated proposal on success", async () => {
    const user = userEvent.setup();

    render(<App />);
    await waitForAppReady();
    await user.type(screen.getByRole("textbox"), "Job post content");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // Simulate completion event via store update
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("generate_proposal_streaming", expect.anything());
    });

    // Simulate receiving tokens and completion via store
    act(() => {
      useGenerationStore.getState().appendTokens(["This is your ", "generated proposal!"]);
      useGenerationStore.getState().setComplete("This is your generated proposal!");
    });

    await waitFor(() => {
      expect(screen.getByText("This is your generated proposal!")).toBeInTheDocument();
    });
  });

  it("displays error on API failure", async () => {
    const user = userEvent.setup();
    // Override mock for this test to simulate API failure after API key check
    // CR R1 M-2: Must handle get_setting for onboarding_completed to prevent
    // onboarding wizard from covering the error message
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "get_setting" && args?.key === "onboarding_completed") {
        return Promise.resolve("true");
      }
      if (command === "generate_proposal_streaming") {
        return Promise.reject("API error: rate limited");
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();
    await user.type(screen.getByRole("textbox"), "Job post content");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    await waitFor(() => {
      expect(screen.getByText(/api error: rate limited/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while generating", async () => {
    const user = userEvent.setup();
    // Use a promise that we can resolve manually to check loading state
    let resolvePromise: (value: string) => void;
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "generate_proposal_streaming") {
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();
    await user.type(screen.getByRole("textbox"), "Job post");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // Should show generating state
    expect(screen.getByRole("button", { name: /generating/i })).toBeInTheDocument();
    expect(screen.getByText(/generating your proposal/i)).toBeInTheDocument();

    // Resolve and simulate completion
    resolvePromise!("Done!");

    act(() => {
      useGenerationStore.getState().appendTokens(["Done!"]);
      useGenerationStore.getState().setComplete("Done!");
    });

    await waitFor(() => {
      expect(screen.getByText("Done!")).toBeInTheDocument();
    });
  });

  it("shows API key setup when no API key configured", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(false);
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument();
  });

  // Story 4a.3 Tests: SkillTags integration

  it("does not render SkillTags before analysis runs", async () => {
    // Task 6.10: Verify SkillTags not rendered before analysis
    render(<App />);
    await waitForAppReady();

    // SkillTags should not be present initially
    expect(screen.queryByTestId("skill-tags")).not.toBeInTheDocument();
    expect(screen.queryByTestId("no-skills")).not.toBeInTheDocument();
  });

  it("renders SkillTags when analysis returns skills", async () => {
    const user = userEvent.setup();

    // Mock analyze_job_post to return skills
    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "John Doe",
          keySkills: ["React", "TypeScript", "API Integration"],
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    // Type job content and click Analyze
    await user.type(screen.getByRole("textbox"), "Looking for a React developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Wait for analysis to complete and SkillTags to render
    await waitFor(() => {
      expect(screen.getByTestId("skill-tags")).toBeInTheDocument();
    });

    // Verify skills are displayed
    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(3);
    expect(skillTags[0]).toHaveTextContent("React");
    expect(skillTags[1]).toHaveTextContent("TypeScript");
    expect(skillTags[2]).toHaveTextContent("API Integration");
  });

  it("shows 'No skills detected' when analysis returns empty skills array (AC-5)", async () => {
    const user = userEvent.setup();

    // Mock analyze_job_post to return empty skills
    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "Jane Smith",
          keySkills: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Vague job post");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    await waitFor(() => {
      expect(screen.getByText(/client: jane smith/i)).toBeInTheDocument();
    });

    // AC-5: When skills array is empty, should show "No skills detected"
    expect(screen.getByTestId("no-skills")).toBeInTheDocument();
    expect(screen.getByText("No skills detected")).toBeInTheDocument();
  });

  it("preserves client name when re-analysis fails (AC-6)", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    // First call succeeds, second call fails
    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    // CR R1 M-2: Include get_setting handler for onboarding
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "get_setting" && args?.key === "onboarding_completed") {
        return Promise.resolve("true");
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            clientName: "John Doe",
            keySkills: ["React", "TypeScript"],
          });
        }
        return Promise.reject(new Error("API rate limit exceeded"));
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    // First analysis - succeeds
    await user.type(screen.getByRole("textbox"), "Looking for a React developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    await waitFor(() => {
      expect(screen.getByText(/client: john doe/i)).toBeInTheDocument();
    });

    // Second analysis - fails
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    await waitFor(() => {
      expect(screen.getByText(/api rate limit exceeded/i)).toBeInTheDocument();
    });

    // AC-6: Previously extracted client name should still be displayed
    expect(screen.getByText(/client: john doe/i)).toBeInTheDocument();
  });

  // Story 4a.6 Tests: Analysis Progress Indicator

  it("shows 'Analyzing job post...' immediately when analyze is clicked (4a.6 AC-2)", async () => {
    const user = userEvent.setup();

    // Use a promise that never resolves to keep analyzing state
    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // AC-2: Stage 1 message shown immediately
    expect(screen.getByText("Analyzing job post...")).toBeInTheDocument();
    // L1 fix: Verify data-testid is present
    expect(screen.getByTestId("analysis-progress")).toBeInTheDocument();
  });

  it("shows 'Complete' when analysis succeeds (4a.6 AC-2)", async () => {
    const user = userEvent.setup();

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "John Doe",
          keySkills: ["React"],
          hiddenNeeds: [],
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // AC-2: Stage 3 - Complete
    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });
  });

  it("shows error in progress indicator when analysis fails (4a.6 AC-6)", async () => {
    const user = userEvent.setup();

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    // CR R1 M-2: Include get_setting handler for onboarding
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "get_setting" && args?.key === "onboarding_completed") {
        return Promise.resolve("true");
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // AC-6: Error state shown in progress indicator (L1 fix: use data-testid)
    await waitFor(() => {
      const progressElement = screen.getByTestId("analysis-progress");
      expect(progressElement).toHaveClass("analysis-progress--error");
    });
  });

  it("renders AnalysisProgress with accessibility attributes (4a.6)", async () => {
    const user = userEvent.setup();

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return new Promise(() => {}); // Never resolves - keep in analyzing state
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Verify accessibility attributes (L1 fix: use data-testid)
    const progressStatus = screen.getByTestId("analysis-progress");
    expect(progressStatus).toBeInTheDocument();
    expect(progressStatus).toHaveAttribute("aria-live", "polite");
    expect(progressStatus).toHaveAttribute("aria-busy", "true");
  });

  it("button shows 'Analyzing...' during analysis (4a.6 AC-5)", async () => {
    const user = userEvent.setup();

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    // Use analyze-button class selector since it's the only one with that class
    const analyzeButton = document.querySelector(".analyze-button") as HTMLButtonElement;
    await user.click(analyzeButton);

    // AC-5: Button shows "Analyzing..." and is disabled
    expect(analyzeButton).toHaveTextContent("Analyzing...");
    expect(analyzeButton).toBeDisabled();
  });

  // M2 fix: Test for double-click prevention during analysis
  it("prevents double-click during analysis (4a.6)", async () => {
    const user = userEvent.setup();
    let analyzeCallCount = 0;

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        analyzeCallCount++;
        return new Promise(() => {}); // Never resolves
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    const analyzeButton = screen.getByRole("button", { name: /analyze job/i });

    // First click
    await user.click(analyzeButton);
    expect(analyzeCallCount).toBe(1);

    // Button should now be disabled - verify
    expect(analyzeButton).toBeDisabled();

    // Attempt second click (should be blocked by disabled state)
    await user.click(analyzeButton);
    expect(analyzeCallCount).toBe(1); // Still 1, not 2
  });

  // L3 fix: Timer cleanup test - verify no state updates after unmount
  it("cleans up timers on unmount to prevent memory leaks (4a.6)", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // H2 Code Review Fix: Add save_job_post mock for Story 4a.8 flow
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        // Return a promise that resolves after component would be unmounted
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              clientName: "Test",
              keySkills: [],
              hiddenNeeds: [],
            });
          }, 100);
        });
      }
      return Promise.resolve(null);
    });

    const { unmount } = render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Looking for a developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Unmount immediately while analysis is still in progress
    unmount();

    // Wait for the promise to resolve (after unmount)
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not see "Can't perform a React state update on an unmounted component" warning
    // This verifies timer cleanup is working
    const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) =>
      call[0]?.includes?.("unmounted component"),
    );
    expect(stateUpdateWarnings).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });

  // Note: Timer-based tests (AC-2 extracting transition, AC-3 fast skip, auto-dismiss)
  // are covered in AnalysisProgress.test.tsx unit tests. App integration with fake
  // timers is unreliable due to complex async initialization sequence.

  // ====================
  // Story 4a.8 Tests: Atomic Save with Error Handling
  // ====================

  // Task 5.12: Error message appears when save fails (mock invoke rejection)
  // H3 Code Review Fix: Fixed test to use correct placeholder text
  it("shows error message when save fails but keeps analysis results (AC-5)", async () => {
    const user = userEvent.setup();

    // Setup: save_job_post fails
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") return Promise.resolve(true);
      if (command === "get_setting") return Promise.resolve("true");
      if (command === "save_job_post") {
        return Promise.reject(new Error("Database locked"));
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    // Use the correct placeholder text from JobInput.tsx
    const textarea = screen.getByPlaceholderText(
      /paste a job post url or the full job description/i,
    );
    await user.clear(textarea);
    await user.type(textarea, "Looking for React developer");

    const analyzeButton = screen.getByRole("button", { name: /analyze/i });
    await user.click(analyzeButton);

    // Should show error in analysis progress
    await waitFor(() => {
      expect(screen.getByText(/database locked/i)).toBeInTheDocument();
    });

    // Verify error stage is displayed
    const progressElement = screen.getByTestId("analysis-progress");
    expect(progressElement).toHaveClass("analysis-progress--error");
  });

  // Story 4a.9: Input sanitization - truncation warning tests
  it("shows truncation warning when wasTruncated is true (4a.9 AC-3)", async () => {
    const user = userEvent.setup();

    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "Test Client",
          keySkills: ["React"],
          hiddenNeeds: [],
          wasTruncated: true, // Simulates truncated input
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Very long job post content");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Wait for analysis to complete and truncation warning to appear
    await waitFor(() => {
      expect(screen.getByText(/job post too long/i)).toBeInTheDocument();
      expect(screen.getByText(/content was trimmed/i)).toBeInTheDocument();
    });

    // Verify warning message content (AC-3)
    expect(
      screen.getByText(/job post too long.*content was trimmed.*consider summarizing/i),
    ).toBeInTheDocument();
  });

  it("does not show truncation warning when wasTruncated is false (4a.9 AC-3)", async () => {
    const user = userEvent.setup();

    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "Test Client",
          keySkills: ["React"],
          hiddenNeeds: [],
          wasTruncated: false, // Normal input, not truncated
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Normal job post");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText("Complete")).toBeInTheDocument();
    });

    // Verify NO truncation warning appears
    expect(screen.queryByText(/job post too long/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/content was trimmed/i)).not.toBeInTheDocument();
  });

  it("clears truncation warning when job content changes (4a.9)", async () => {
    const user = userEvent.setup();

    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 1, saved: true });
      }
      if (command === "analyze_job_post") {
        return Promise.resolve({
          clientName: "Test Client",
          keySkills: ["React"],
          hiddenNeeds: [],
          wasTruncated: true,
        });
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Very long job post");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Wait for truncation warning
    await waitFor(() => {
      expect(screen.getByText(/job post too long/i)).toBeInTheDocument();
    });

    // Change job content
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "Different job post");

    // Truncation warning should disappear (reset on content change)
    await waitFor(() => {
      expect(screen.queryByText(/job post too long/i)).not.toBeInTheDocument();
    });
  });

  // Story 4a.9 H3: Generation path truncation warning tests
  it("shows truncation warning when generation completes with wasTruncated=true (4a.9 H3)", async () => {
    const user = userEvent.setup();

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Very long job post content");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // Simulate generation completing with truncation flag
    act(() => {
      useGenerationStore.getState().appendTokens(["Generated proposal text"]);
      useGenerationStore.getState().setComplete("Generated proposal text", true);
    });

    // Wait for truncation warning to appear
    await waitFor(() => {
      expect(screen.getByText(/job post too long/i)).toBeInTheDocument();
      expect(screen.getByText(/content was trimmed to fit generation limits/i)).toBeInTheDocument();
    });
  });

  it("does not show generation truncation warning when wasTruncated=false (4a.9 H3)", async () => {
    const user = userEvent.setup();

    render(<App />);
    await waitForAppReady();

    await user.type(screen.getByRole("textbox"), "Normal job post");
    await user.click(screen.getByRole("button", { name: /generate proposal/i }));

    // Simulate generation completing without truncation
    act(() => {
      useGenerationStore.getState().appendTokens(["Generated proposal text"]);
      useGenerationStore.getState().setComplete("Generated proposal text", false);
    });

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.getByText("Generated proposal text")).toBeInTheDocument();
    });

    // Verify NO generation truncation warning appears (use specific text to differentiate from analysis warning)
    expect(
      screen.queryByText(/content was trimmed to fit generation limits/i),
    ).not.toBeInTheDocument();
  });

  // Story 4b.6 L2: jobPostId integration test
  // Verifies save_job_post returns id which is stored for scoring breakdown fetch
  it("stores jobPostId after save_job_post for scoring breakdown (4b.6)", async () => {
    const user = userEvent.setup();
    let savedJobPostId: number | null = null;

    // Mock flow: save_job_post returns id, analyze_job_post succeeds
    mockInvoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
      }
      if (command === "save_job_post") {
        return Promise.resolve({ id: 123, saved: true }); // Returns jobPostId
      }
      if (command === "analyze_job_post") {
        // Capture that analyze_job_post receives the jobPostId from save_job_post
        savedJobPostId = args?.jobPostId as number;
        return Promise.resolve({
          clientName: "Test Client",
          keySkills: ["React"],
          hiddenNeeds: [],
        });
      }
      if (command === "calculate_and_store_skills_match") {
        return Promise.resolve(75.0);
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    // Type job content and analyze
    await user.type(screen.getByRole("textbox"), "Looking for a React developer");
    await user.click(screen.getByRole("button", { name: /analyze job/i }));

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText(/client: test client/i)).toBeInTheDocument();
    });

    // Story 4b.6: Verify jobPostId was passed to analyze_job_post
    // This confirms the flow: save_job_post returns id → stored → passed to analysis
    expect(savedJobPostId).toBe(123);

    // Verify JobAnalysisPanel renders (receives jobPostId prop for breakdown fetch)
    expect(screen.getByTestId("job-analysis-panel")).toBeInTheDocument();
  });
});

// Story 9.7 Task 5.7: Auto-Update Integration Tests
describe("App - Auto-Update Integration (Story 9.7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGenerationStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
    setupInvokeMock();
  });

  it("renders AutoUpdateNotification toast when non-critical update available", async () => {
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      currentVersion: "1.0.0",
      body: "Bug fixes and improvements",
      date: "2026-02-16",
      downloadAndInstall: vi.fn(),
    } as any);

    render(<App />);

    // Wait for update notification toast to appear (background check resolves)
    await waitFor(() => {
      expect(screen.getByText("Update available: v2.0.0")).toBeInTheDocument();
    });

    // Main app should still be visible (non-critical doesn't block)
    expect(screen.getByRole("heading", { name: /upwork research agent/i })).toBeInTheDocument();
  });

  it("renders MandatoryUpdateDialog for critical updates, blocking normal UI", async () => {
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      currentVersion: "1.0.0",
      body: "Critical security fix",
      date: "2026-02-16",
      critical: true,
      downloadAndInstall: vi.fn(),
    } as any);

    render(<App />);

    // Wait for MandatoryUpdateDialog to appear
    await waitFor(() => {
      expect(screen.getByText("Critical Security Update Required")).toBeInTheDocument();
    });

    // Main app heading should NOT be visible (critical update blocks everything)
    expect(
      screen.queryByRole("heading", { name: /upwork research agent/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show update notification when no update available", async () => {
    mockCheck.mockResolvedValue(null);

    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // No update notification should appear
    expect(screen.queryByText(/update available/i)).not.toBeInTheDocument();
    // Main app renders normally
    expect(screen.getByRole("heading", { name: /upwork research agent/i })).toBeInTheDocument();
  });
});

// Story 10.5: Config Update Notification Integration Tests
describe("App - Config Update Integration (Story 10.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue(null); // No auto-update by default
    useGenerationStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
    setupInvokeMock();
  });

  it("does not show ConfigUpdateNotification by default (no config updates)", async () => {
    render(<App />);
    await waitForAppReady();

    // ConfigUpdateNotification renders null when not visible
    expect(screen.queryByText(/hook strategies updated/i)).not.toBeInTheDocument();
  });

  it("shows ConfigUpdateNotification when strategies:updated event fires (AC-1)", async () => {
    render(<App />);
    await waitForAppReady();

    // Find the strategies:updated listener registered by useRemoteConfig
    const strategiesCall = mockListen.mock.calls.find(
      (call) => call[0] === "strategies:updated",
    );
    expect(strategiesCall).toBeDefined();

    // Fire the event
    const callback = strategiesCall![1] as (event: { payload: unknown }) => void;
    act(() => {
      callback({
        payload: { newCount: 2, updatedCount: 1, newStrategies: [] },
      });
    });

    // ConfigUpdateNotification should appear (text also exists in LiveAnnouncer, so use class selector)
    await waitFor(() => {
      const notification = document.querySelector(".config-update-notification");
      expect(notification).toBeInTheDocument();
      expect(notification).toHaveTextContent(
        /hook strategies updated: 2 new, 1 updated/i,
      );
    });
  });

  it("hides ConfigUpdateNotification when app-update is also showing (AC-6)", async () => {
    // Non-critical update available — AutoUpdateNotification shows
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      currentVersion: "1.0.0",
      body: "Bug fixes",
      date: "2026-02-16",
      downloadAndInstall: vi.fn(),
    } as any);

    render(<App />);
    await waitForAppReady();

    // Wait for auto-update notification to appear first
    await waitFor(() => {
      expect(screen.getByText("Update available: v2.0.0")).toBeInTheDocument();
    });

    // Fire strategies:updated event
    const strategiesCall = mockListen.mock.calls.find(
      (call) => call[0] === "strategies:updated",
    );
    if (strategiesCall) {
      const callback = strategiesCall[1] as (event: { payload: unknown }) => void;
      act(() => {
        callback({
          payload: { newCount: 1, updatedCount: 0, newStrategies: [] },
        });
      });
    }

    // Config notification should NOT be visible (app-update takes priority)
    expect(screen.queryByText(/hook strategies updated/i)).not.toBeInTheDocument();
  });

  it("shows ConfigUpdateNotification after auto-update toast is dismissed (CR R2 H-1)", async () => {
    // Non-critical update available — AutoUpdateNotification shows
    mockCheck.mockResolvedValue({
      version: "2.0.0",
      currentVersion: "1.0.0",
      body: "Bug fixes",
      date: "2026-02-16",
      downloadAndInstall: vi.fn(),
    } as any);

    render(<App />);
    await waitForAppReady();

    // Wait for auto-update notification to appear
    await waitFor(() => {
      expect(screen.getByText("Update available: v2.0.0")).toBeInTheDocument();
    });

    // Fire strategies:updated event while auto-update is showing
    const strategiesCall = mockListen.mock.calls.find(
      (call) => call[0] === "strategies:updated",
    );
    expect(strategiesCall).toBeDefined();
    const callback = strategiesCall![1] as (event: { payload: unknown }) => void;
    act(() => {
      callback({
        payload: { newCount: 3, updatedCount: 0, newStrategies: [] },
      });
    });

    // Config notification should NOT be visible yet (auto-update showing)
    expect(screen.queryByText(/hook strategies updated/i)).not.toBeInTheDocument();

    // Dismiss auto-update toast by clicking "Later"
    // This triggers onLater → state transitions to 'hidden' → onToastHidden fires
    fireEvent.click(screen.getByText("Later"));

    // Now config notification should appear (auto-update dismissed → onToastHidden)
    await waitFor(() => {
      const notification = document.querySelector(".config-update-notification");
      expect(notification).toBeInTheDocument();
      expect(notification).toHaveTextContent(/hook strategies updated: 3 new, 0 updated/i);
    });
  });
});

// Story 10.5 CR R2 M-3: Startup cleanup of expired first-seen entries
describe("App - Startup Cleanup (Story 10.5 Task 6.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGenerationStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
    setupInvokeMock();
  });

  it("prunes expired new_strategies_first_seen entries on startup", async () => {
    const { useSettingsStore } = await import("./stores/useSettingsStore");

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const testFirstSeen = JSON.stringify({
      "expired-strategy": eightDaysAgo,
      "fresh-strategy": oneDayAgo,
    });
    const testDismissed = JSON.stringify({
      "expired-strategy": true,
      "fresh-strategy": true,
    });

    // Mock get_all_settings to return our test data so initializeApp loads them
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "has_api_key") return Promise.resolve(true);
      if (command === "get_setting" && args?.key === "onboarding_completed")
        return Promise.resolve("true");
      if (command === "get_all_settings") {
        return Promise.resolve([
          { key: "new_strategies_first_seen", value: testFirstSeen, updated_at: "" },
          { key: "new_strategies_dismissed", value: testDismissed, updated_at: "" },
        ]);
      }
      return Promise.resolve(null);
    });

    render(<App />);
    await waitForAppReady();

    // Wait for initializeApp to complete and cleanup to run
    await waitFor(() => {
      const store = useSettingsStore.getState();
      const firstSeen = JSON.parse(store.settings["new_strategies_first_seen"] || "{}");
      // Expired entry should be pruned, fresh entry should remain
      expect(firstSeen["expired-strategy"]).toBeUndefined();
      expect(firstSeen["fresh-strategy"]).toBe(oneDayAgo);
    });

    // Dismissed entries for expired strategies should also be pruned
    const store = useSettingsStore.getState();
    const dismissed = JSON.parse(store.settings["new_strategies_dismissed"] || "{}");
    expect(dismissed["expired-strategy"]).toBeUndefined();
    expect(dismissed["fresh-strategy"]).toBe(true);
  });
});

// Story TD2.3 Task 5: Health check integration tests (AC-1, AC-2, AC-3)
describe("App health check orchestration (TD2.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGenerationStore.getState().reset();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setShowOnboarding(false);
  });

  const setupHealthCheckInvokes = (overrides: Record<string, unknown> = {}) => {
    mockInvoke.mockImplementation((command: string, args?: unknown) => {
      const typedArgs = args as Record<string, unknown> | undefined;
      const defaults: Record<string, unknown> = {
        has_api_key: true,
        detect_update_command: false,
        get_installed_version_command: "1.1.0",
        set_installed_version_command: null,
        run_health_checks_command: {
          passed: true,
          checks_run: 4,
          failures: [],
          duration_ms: 100,
        },
        check_and_clear_rollback_command: null,
        rollback_to_previous_version_command: null,
        check_encryption_status: { databaseEncrypted: false },
        get_encryption_status: { databaseEncrypted: false },
        check_for_draft: null,
        get_cooldown_remaining: 0,
        check_threshold_learning: null,
        check_threshold_decrease: null,
        list_settings: [],
        ...overrides,
      };
      if (command === "get_setting" && typedArgs?.key === "onboarding_completed") {
        return Promise.resolve("true");
      }
      if (command in defaults) return Promise.resolve(defaults[command]);
      return Promise.resolve(null);
    });
  };

  it("does not show HealthCheckModal when detect_update_command returns false (AC-1)", async () => {
    setupHealthCheckInvokes({ detect_update_command: false });
    render(<App />);
    await waitForAppReady();
    // Health check modal should never appear
    expect(screen.queryByText("Verifying app health...")).not.toBeInTheDocument();
  });

  it("shows success toast when health checks pass (AC-2)", async () => {
    setupHealthCheckInvokes({
      detect_update_command: true,
      get_installed_version_command: "1.1.0",
      run_health_checks_command: {
        passed: true,
        checks_run: 4,
        failures: [],
        duration_ms: 80,
      },
    });
    render(<App />);
    await waitForAppReady();
    // Wait for health check flow to complete and success toast to appear
    await waitFor(
      () => {
        expect(screen.getByText(/updated to v/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    expect(screen.getByText("Update Successful")).toBeInTheDocument();
  });

  it("shows RollbackDialog when health checks fail (AC-3)", async () => {
    setupHealthCheckInvokes({
      detect_update_command: true,
      get_installed_version_command: "1.1.0",
      run_health_checks_command: {
        passed: false,
        checks_run: 4,
        failures: [
          { check: "Database integrity", error: "PRAGMA cipher_integrity_check failed", critical: true },
        ],
        duration_ms: 200,
      },
    });
    render(<App />);
    await waitForAppReady();
    // Wait for rollback dialog to appear
    await waitFor(
      () => {
        expect(screen.getByRole("dialog", { name: /update failed/i })).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    expect(screen.getByText(/PRAGMA cipher_integrity_check failed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restart app/i })).toBeInTheDocument();
    // CR R2 M-1: Verify rollback command was actually invoked before dialog appeared
    expect(mockInvoke).toHaveBeenCalledWith("rollback_to_previous_version_command");
  });

  it("dismisses success toast on Escape keypress (AC-4)", async () => {
    // CR R2 L-1: Test the Escape keydown handler added by CR R1 M-1
    setupHealthCheckInvokes({
      detect_update_command: true,
      get_installed_version_command: "1.1.0",
      run_health_checks_command: {
        passed: true,
        checks_run: 4,
        failures: [],
        duration_ms: 80,
      },
    });
    render(<App />);
    await waitForAppReady();
    // Wait for success toast to appear
    await waitFor(
      () => {
        expect(screen.getByText("Update Successful")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    // Press Escape to dismiss
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Update Successful")).not.toBeInTheDocument();
    });
  });
});
