import { invoke } from "@tauri-apps/api/core";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DEFAULT_USER_ID, VOICE_SAVE_DEBOUNCE_MS } from "../types/voice";

import { VoiceSettings } from "./VoiceSettings";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock react-router-dom for VoiceProfileDisplay
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

// Mock voice-learning components to avoid Router/profile dependencies in unit tests
vi.mock("../features/voice-learning", () => ({
  VoiceProfileDisplay: () => null,
  VoiceLearningTimeline: () => null,
  VoiceLearningProgress: () => null,
  useProposalsEditedCount: () => ({ progress: null, loading: false }),
}));

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

describe("VoiceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC: Three sliders render
  it("renders three sliders", async () => {
    mockInvoke.mockResolvedValue(null); // No existing profile

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText(/tone.*formal to casual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/length.*brief to detailed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/technical depth.*simple to expert/i)).toBeInTheDocument();
  });

  // AC: Info message displays
  it("displays info message", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/changes will affect future proposals/i)).toBeInTheDocument();
  });

  // AC: Loads values from profile
  it("loads values from profile", async () => {
    const mockProfile = {
      user_id: "default",
      tone_score: 7,
      length_preference: 3,
      technical_depth: 9,
      avg_sentence_length: 15,
      vocabulary_complexity: 8,
      structure_paragraphs_pct: 70,
      structure_bullets_pct: 30,
      common_phrases: [],
      sample_count: 5,
      calibration_source: "GoldenSet",
    };

    mockInvoke.mockResolvedValue(mockProfile);

    render(<VoiceSettings />);

    await waitFor(() => {
      const toneSlider = screen.getByLabelText(/tone.*formal to casual/i) as HTMLInputElement;
      expect(toneSlider.value).toBe("7");
    });

    const lengthSlider = screen.getByLabelText(/length.*brief to detailed/i) as HTMLInputElement;
    expect(lengthSlider.value).toBe("3");

    const depthSlider = screen.getByLabelText(
      /technical depth.*simple to expert/i,
    ) as HTMLInputElement;
    expect(depthSlider.value).toBe("9");
  });

  // AC: Shows default values when no profile exists
  it("shows default values when no profile exists", async () => {
    mockInvoke.mockResolvedValue(null); // No profile

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Default values are 5
    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i) as HTMLInputElement;
    expect(toneSlider.value).toBe("5");

    const lengthSlider = screen.getByLabelText(/length.*brief to detailed/i) as HTMLInputElement;
    expect(lengthSlider.value).toBe("5");

    const depthSlider = screen.getByLabelText(
      /technical depth.*simple to expert/i,
    ) as HTMLInputElement;
    expect(depthSlider.value).toBe("5");
  });

  // AC: Displays current values (X/10)
  it("displays current values next to sliders", async () => {
    const mockProfile = {
      user_id: "default",
      tone_score: 7,
      length_preference: 4,
      technical_depth: 8,
      avg_sentence_length: 15,
      vocabulary_complexity: 8,
      structure_paragraphs_pct: 70,
      structure_bullets_pct: 30,
      common_phrases: [],
      sample_count: 5,
      calibration_source: "GoldenSet",
    };

    mockInvoke.mockResolvedValue(mockProfile);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.getByText(/tone: 7\/10/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/length: 4\/10/i)).toBeInTheDocument();
    expect(screen.getByText(/technical depth: 8\/10/i)).toBeInTheDocument();
  });

  // AC: Descriptive labels change based on value
  it("shows descriptive labels that change based on value", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Default 5 → "Balanced" for tone and length, "Intermediate" for technical depth
    expect(screen.getByText(/tone: 5\/10 balanced/i)).toBeInTheDocument();
    expect(screen.getByText(/length: 5\/10 balanced/i)).toBeInTheDocument();
    expect(screen.getByText(/technical depth: 5\/10 intermediate/i)).toBeInTheDocument();
  });

  // AC: Debounced save triggers after 300ms
  it("debounces save after slider change", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);

    // Change slider value
    fireEvent.change(toneSlider, { target: { value: "8" } });

    // Should not save immediately
    expect(mockInvoke).not.toHaveBeenCalledWith("update_voice_parameters", expect.anything());

    // Wait for debounce (300ms) + execution
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("update_voice_parameters", {
          userId: "default",
          params: { tone_score: 8 },
        });
      },
      { timeout: 1000 },
    );
  });

  // AC: Shows "Saving..." indicator during save
  it("shows saving indicator on change", async () => {
    let saveResolver: () => void;
    const savePromise = new Promise<void>((resolve) => {
      saveResolver = resolve;
    });

    mockInvoke.mockImplementation((cmd) => {
      if (cmd === "get_voice_profile") return Promise.resolve(null);
      if (cmd === "update_voice_parameters") {
        return savePromise;
      }
      return Promise.resolve();
    });

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    // Should show "Saving..." after debounce
    await waitFor(
      () => {
        expect(screen.getByText(/saving/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    // Resolve save
    saveResolver!();
  });

  // AC: Shows "✓ Saved" after successful save
  it("shows success message after save", async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === "get_voice_profile") return Promise.resolve(null);
      if (cmd === "update_voice_parameters") return Promise.resolve();
      return Promise.resolve();
    });

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    // Wait for save to complete
    await waitFor(
      () => {
        expect(screen.getByText(/✓ saved/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  // AC: Handles save errors
  it("shows error message on save failure", async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === "get_voice_profile") return Promise.resolve(null);
      if (cmd === "update_voice_parameters") return Promise.reject(new Error("Network error"));
      return Promise.resolve();
    });

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    await waitFor(
      () => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  // AC: Multiple rapid changes only trigger one save
  it("debounces multiple rapid changes", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);

    // Make multiple rapid changes
    fireEvent.change(toneSlider, { target: { value: "7" } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.change(toneSlider, { target: { value: "8" } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.change(toneSlider, { target: { value: "9" } });

    // Should only save once with final value after debounce
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledTimes(2); // 1 for load, 1 for save
        expect(mockInvoke).toHaveBeenLastCalledWith("update_voice_parameters", {
          userId: "default",
          params: { tone_score: 9 },
        });
      },
      { timeout: 1000 },
    );
  });

  // AC: Each slider updates independently
  it("updates each slider independently", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Change tone
    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "7" } });

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("update_voice_parameters", {
          userId: "default",
          params: { tone_score: 7 },
        });
      },
      { timeout: 1000 },
    );

    mockInvoke.mockClear();

    // Change length
    const lengthSlider = screen.getByLabelText(/length.*brief to detailed/i);
    fireEvent.change(lengthSlider, { target: { value: "3" } });

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("update_voice_parameters", {
          userId: "default",
          params: { length_preference: 3 },
        });
      },
      { timeout: 1000 },
    );
  });

  // AC: ARIA labels for accessibility
  it("has proper ARIA labels for accessibility", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Check that sliders have descriptive ARIA labels
    const toneSlider = screen.getByLabelText(/tone.*formal to casual.*currently.*out of 10/i);
    expect(toneSlider).toHaveAttribute("aria-valuetext");

    const lengthSlider = screen.getByLabelText(/length.*brief to detailed.*currently.*out of 10/i);
    expect(lengthSlider).toHaveAttribute("aria-valuetext");

    const depthSlider = screen.getByLabelText(
      /technical depth.*simple to expert.*currently.*out of 10/i,
    );
    expect(depthSlider).toHaveAttribute("aria-valuetext");
  });

  // AC: Status messages are announced to screen readers
  it("announces status changes to screen readers", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    // Wait for status message
    const statusElement = await waitFor(
      () => {
        return screen.getByText(/✓ saved/i);
      },
      { timeout: 1000 },
    );

    // Should have aria-live for screen reader announcements
    expect(statusElement.closest('[aria-live="polite"]')).toBeInTheDocument();
  });

  // [AI-Review] Verify exact get_voice_profile invoke call format
  it("calls get_voice_profile with correct userId on mount", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Verify exact call format with DEFAULT_USER_ID constant
    expect(mockInvoke).toHaveBeenCalledWith("get_voice_profile", {
      userId: DEFAULT_USER_ID,
    });
  });

  // [AI-Review] Test slider step="0.5" precision through save/load cycle
  it("preserves half-point precision (step=0.5) through save/load", async () => {
    // First render with half-point values from profile
    const mockProfile = {
      user_id: DEFAULT_USER_ID,
      tone_score: 7.5,
      length_preference: 3.5,
      technical_depth: 8.5,
      avg_sentence_length: 15,
      vocabulary_complexity: 8,
      structure_paragraphs_pct: 70,
      structure_bullets_pct: 30,
      common_phrases: [],
      sample_count: 5,
      calibration_source: "GoldenSet",
    };

    mockInvoke.mockResolvedValue(mockProfile);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Verify half-point values are loaded correctly
    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i) as HTMLInputElement;
    expect(toneSlider.value).toBe("7.5");

    const lengthSlider = screen.getByLabelText(/length.*brief to detailed/i) as HTMLInputElement;
    expect(lengthSlider.value).toBe("3.5");

    const depthSlider = screen.getByLabelText(
      /technical depth.*simple to expert/i,
    ) as HTMLInputElement;
    expect(depthSlider.value).toBe("8.5");

    // Verify labels display correctly for half-point values
    expect(screen.getByText(/tone: 7.5\/10/i)).toBeInTheDocument();
    expect(screen.getByText(/length: 3.5\/10/i)).toBeInTheDocument();
    expect(screen.getByText(/technical depth: 8.5\/10/i)).toBeInTheDocument();
  });

  // [AI-Review] Test saving half-point value
  it("saves half-point values correctly", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);

    // Change to half-point value
    fireEvent.change(toneSlider, { target: { value: "6.5" } });

    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("update_voice_parameters", {
          userId: DEFAULT_USER_ID,
          params: { tone_score: 6.5 },
        });
      },
      { timeout: 1000 },
    );
  });

  // [AI-Review] Test that constants are used correctly
  it("uses VOICE_SAVE_DEBOUNCE_MS constant for debounce timing", async () => {
    mockInvoke.mockResolvedValue(null);

    render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    // Should not save before debounce period
    await new Promise((resolve) => setTimeout(resolve, VOICE_SAVE_DEBOUNCE_MS - 50));
    expect(mockInvoke).not.toHaveBeenCalledWith("update_voice_parameters", expect.anything());

    // Should save after debounce period
    await waitFor(
      () => {
        expect(mockInvoke).toHaveBeenCalledWith("update_voice_parameters", expect.anything());
      },
      { timeout: 500 },
    );
  });

  // [AI-Review] Test dark mode CSS classes exist
  it("has dark mode styles applied via CSS", async () => {
    mockInvoke.mockResolvedValue(null);

    const { container } = render(<VoiceSettings />);

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    // Verify component has the voice-settings class that has dark mode styles
    expect(container.querySelector(".voice-settings")).toBeInTheDocument();

    // Verify slider groups have classes that have dark mode styles
    const sliderGroups = container.querySelectorAll(".voice-slider-group");
    expect(sliderGroups.length).toBe(3);

    // Verify status area exists (has dark mode styles)
    const toneSlider = screen.getByLabelText(/tone.*formal to casual/i);
    fireEvent.change(toneSlider, { target: { value: "8" } });

    await waitFor(
      () => {
        const statusElement = container.querySelector(".voice-settings-status");
        expect(statusElement).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });
});
