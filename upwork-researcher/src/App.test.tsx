import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { useGenerationStore } from "./stores/useGenerationStore";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

// Helper to setup invoke mock with API key check
const setupInvokeMock = () => {
  mockInvoke.mockImplementation((command: string) => {
    if (command === "has_api_key") {
      return Promise.resolve(true);
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
    // Setup default mock for has_api_key
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
});
