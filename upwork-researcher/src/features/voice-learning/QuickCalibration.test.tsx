// Unit tests for QuickCalibration component (Story 5.7)

import * as tauriApi from "@tauri-apps/api/core";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { QuickCalibration } from "./QuickCalibration";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("QuickCalibration", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <QuickCalibration onComplete={mockOnComplete} {...props} />
      </BrowserRouter>,
    );
  };

  const clickOption = (text: string) => {
    fireEvent.click(screen.getByText(text));
  };

  describe("question progression", () => {
    it("renders first question on mount", () => {
      renderComponent();

      expect(screen.getByText("How would you describe your writing tone?")).toBeInTheDocument();
      expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
    });

    it("advances to question 2 when Next is clicked", async () => {
      renderComponent();

      // Select an answer
      clickOption("Professional");

      // Click Next
      const nextButton = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("How detailed are your typical responses?")).toBeInTheDocument();
        expect(screen.getByText("Question 2 of 5")).toBeInTheDocument();
      });
    });

    it("progresses through all 5 questions", async () => {
      renderComponent();

      // Q1: Tone
      clickOption("Professional");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));

      await waitFor(() => expect(screen.getByText("Question 2 of 5")).toBeInTheDocument());

      // Q2: Length
      clickOption("Moderate");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));

      await waitFor(() => expect(screen.getByText("Question 3 of 5")).toBeInTheDocument());

      // Q3: Technical Depth
      clickOption("Technical");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));

      await waitFor(() => expect(screen.getByText("Question 4 of 5")).toBeInTheDocument());

      // Q4: Structure
      clickOption("Mixed");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));

      await waitFor(() => expect(screen.getByText("Question 5 of 5")).toBeInTheDocument());

      // Q5: Call to Action
      expect(screen.getByText("How do you typically close your proposals?")).toBeInTheDocument();
    });

    it("disables Next button until answer is selected", () => {
      renderComponent();

      const nextButton = screen.getByRole("button", { name: /Next/i });
      expect(nextButton).toBeDisabled();

      // Select answer
      clickOption("Professional");
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe("back navigation", () => {
    it("disables Back button on first question", () => {
      renderComponent();

      const backButton = screen.getByRole("button", { name: /Back/i });
      expect(backButton).toBeDisabled();
    });

    it("returns to previous question when Back is clicked", async () => {
      renderComponent();

      // Go to Q2
      clickOption("Professional");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));

      await waitFor(() => expect(screen.getByText("Question 2 of 5")).toBeInTheDocument());

      // Go back to Q1
      fireEvent.click(screen.getByRole("button", { name: /Back/i }));

      await waitFor(() => {
        expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
        expect(screen.getByText("How would you describe your writing tone?")).toBeInTheDocument();
      });
    });
  });

  describe("completion flow", () => {
    it("shows Finish button on last question", async () => {
      renderComponent();

      // Navigate to Q5
      const questions = ["Professional", "Moderate", "Technical", "Mixed"];
      for (const answer of questions) {
        clickOption(answer);
        fireEvent.click(screen.getByRole("button", { name: /Next/i }));
        await waitFor(() => {});
      }

      // On Q5, button should say "Finish"
      expect(screen.getByRole("button", { name: /Finish/i })).toBeInTheDocument();
    });

    it("saves profile and shows completion screen", async () => {
      vi.mocked(tauriApi.invoke).mockResolvedValue(undefined);

      renderComponent();

      // Answer all 5 questions
      clickOption("Professional");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Moderate");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Technical");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Mixed");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Consultative");
      fireEvent.click(screen.getByRole("button", { name: /Finish/i }));

      // Wait for completion screen
      await waitFor(() => {
        expect(screen.getByText("Voice Calibrated!")).toBeInTheDocument();
      });

      // Use getAllByText since text appears in both visible element and sr-only announcement
      expect(
        screen.getAllByText(/Your writing style preferences are saved/).length,
      ).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Start Writing/i })).toBeInTheDocument();
    });

    it("calls quick_calibrate with answers (TD-5 AC-2: backend is source of truth)", async () => {
      vi.mocked(tauriApi.invoke).mockResolvedValue(undefined);

      renderComponent();

      // Answer all questions
      clickOption("Formal");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Brief");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Expert");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Bullet Points");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => {});

      clickOption("Direct");
      fireEvent.click(screen.getByRole("button", { name: /Finish/i }));

      await waitFor(() => {
        expect(tauriApi.invoke).toHaveBeenCalledWith("quick_calibrate", {
          answers: {
            tone: "formal",
            length: "brief",
            technicalDepth: "expert",
            structure: "bullets",
            callToAction: "direct",
          },
        });
      });
    });
  });

  describe("accessibility", () => {
    it("has dialog role with aria-modal", () => {
      renderComponent();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("has progress indicator with aria-live", () => {
      renderComponent();

      const progress = screen.getByText("Question 1 of 5");
      expect(progress).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("navigation after completion", () => {
    it("navigates to home when Start Writing is clicked", async () => {
      vi.mocked(tauriApi.invoke).mockResolvedValue(undefined);

      renderComponent();

      // Complete calibration
      const answers = ["Professional", "Moderate", "Technical", "Mixed", "Direct"];
      for (const answer of answers) {
        clickOption(answer);
        fireEvent.click(screen.getByRole("button", { name: /(Next|Finish)/i }));
        await waitFor(() => {});
      }

      await waitFor(() => {
        expect(screen.getByText("Voice Calibrated!")).toBeInTheDocument();
      });

      // Click Start Writing
      fireEvent.click(screen.getByRole("button", { name: /Start Writing/i }));

      expect(mockOnComplete).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  // H3 fix: Add edit mode tests (Task 6.6)
  describe("edit mode with existing answers", () => {
    it("pre-populates answers when existingAnswers provided", () => {
      const existingAnswers = {
        tone: "formal",
        length: "detailed",
        technicalDepth: "expert",
        structure: "paragraphs",
        callToAction: "consultative",
      };

      renderComponent({ existingAnswers });

      // First question should have Formal pre-selected
      const formalRadio = screen.getByLabelText(/Formal: Academic, traditional/i);
      expect(formalRadio).toBeChecked();
    });

    it("preserves existing answers when navigating forward and back", async () => {
      const existingAnswers = {
        tone: "casual",
      };

      renderComponent({ existingAnswers });

      // Casual should be pre-selected on Q1
      expect(screen.getByLabelText(/Casual: Relaxed, approachable/i)).toBeChecked();

      // Go to Q2
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => expect(screen.getByText("Question 2 of 5")).toBeInTheDocument());

      // Select an answer on Q2
      clickOption("Brief");

      // Go back to Q1
      fireEvent.click(screen.getByRole("button", { name: /Back/i }));
      await waitFor(() => expect(screen.getByText("Question 1 of 5")).toBeInTheDocument());

      // Casual should still be selected
      expect(screen.getByLabelText(/Casual: Relaxed, approachable/i)).toBeChecked();
    });

    it("allows changing pre-populated answers", async () => {
      const existingAnswers = {
        tone: "formal",
      };

      renderComponent({ existingAnswers });

      // Formal should be pre-selected
      expect(screen.getByLabelText(/Formal: Academic, traditional/i)).toBeChecked();

      // Change to Casual
      clickOption("Casual");
      expect(screen.getByLabelText(/Casual: Relaxed, approachable/i)).toBeChecked();
      expect(screen.getByLabelText(/Formal: Academic, traditional/i)).not.toBeChecked();
    });
  });

  describe("error handling", () => {
    it("displays error message when save fails", async () => {
      vi.mocked(tauriApi.invoke).mockRejectedValue("Database connection failed");

      renderComponent();

      // Answer all questions - navigate through Q1-Q4, then answer Q5
      clickOption("Professional");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => expect(screen.getByText("Question 2 of 5")).toBeInTheDocument());

      clickOption("Moderate");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => expect(screen.getByText("Question 3 of 5")).toBeInTheDocument());

      clickOption("Technical");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => expect(screen.getByText("Question 4 of 5")).toBeInTheDocument());

      clickOption("Mixed");
      fireEvent.click(screen.getByRole("button", { name: /Next/i }));
      await waitFor(() => expect(screen.getByText("Question 5 of 5")).toBeInTheDocument());

      // Answer last question and click Finish (this triggers the error)
      clickOption("Direct");
      fireEvent.click(screen.getByRole("button", { name: /Finish/i }));

      // Should show error instead of completion
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
      // Error message shows the actual error (string errors passed through directly)
      expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();

      // Should NOT show completion screen
      expect(screen.queryByText("Voice Calibrated!")).not.toBeInTheDocument();
    });
  });

  describe("focus trap (AC-7)", () => {
    it("has dialog role with aria-modal", () => {
      renderComponent();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });
});
