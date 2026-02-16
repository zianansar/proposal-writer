import { render, screen, waitFor, act } from "@testing-library/react";
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
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
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
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
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
    mockInvoke.mockImplementation((command: string) => {
      if (command === "has_api_key") {
        return Promise.resolve(true);
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
