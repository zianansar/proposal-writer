import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VoiceProfileDisplay } from "./VoiceProfileDisplay";
import type { VoiceProfile } from "./types";

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("./useVoiceProfile", () => ({
  useVoiceProfile: vi.fn(),
}));

vi.mock("./VoiceProfileEmpty", () => ({
  VoiceProfileEmpty: ({ onStartCalibration }: { onStartCalibration: () => void }) => (
    <div data-testid="empty-state">
      <button onClick={onStartCalibration}>Start Calibration</button>
    </div>
  ),
}));

import { useVoiceProfile } from "./useVoiceProfile";

const mockProfile: VoiceProfile = {
  tone_score: 6,
  avg_sentence_length: 15,
  vocabulary_complexity: 8,
  structure_preference: {
    paragraphs_pct: 60,
    bullets_pct: 40,
  },
  technical_depth: 8,
  common_phrases: [
    "I've worked with React for 5 years",
    "My approach to this would be",
    "I can deliver within your timeline",
    "Let me know if you need clarification",
    "I'm confident I can help",
  ],
  sample_count: 5,
  calibration_source: "GoldenSet",
};

describe("VoiceProfileDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe("Display Tests (AC-1)", () => {
    it("renders all 4 metrics (tone, length, structure, technical depth)", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByText(/Tone: Professional/)).toBeInTheDocument();
      expect(screen.getByText(/Length: Moderate/)).toBeInTheDocument();
      expect(screen.getByText(/Structure: Mixed/)).toBeInTheDocument();
      expect(screen.getByText(/Technical Depth: Expert/)).toBeInTheDocument();
    });

    it("displays sample count correctly", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByText(/Based on 5 past proposals/)).toBeInTheDocument();
    });

    it('displays sample count with singular "proposal" when count is 1', () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: { ...mockProfile, sample_count: 1 },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByText(/Based on 1 past proposal$/)).toBeInTheDocument();
    });

    it("displays top 3 common phrases only", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByText(/"I've worked with React for 5 years"/)).toBeInTheDocument();
      expect(screen.getByText(/"My approach to this would be"/)).toBeInTheDocument();
      expect(screen.getByText(/"I can deliver within your timeline"/)).toBeInTheDocument();

      // 4th and 5th phrases should NOT be displayed
      expect(screen.queryByText(/"Let me know if you need clarification"/)).not.toBeInTheDocument();
      expect(screen.queryByText(/"I'm confident I can help"/)).not.toBeInTheDocument();
    });

    it('displays "Recalibrate Voice" button', () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByRole("button", { name: /Recalibrate Voice/i })).toBeInTheDocument();
    });
  });

  describe("Empty State Tests (AC-2)", () => {
    it("displays VoiceProfileEmpty when profile is null", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it('empty state has "Start Calibration" button', () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByRole("button", { name: /Start Calibration/i })).toBeInTheDocument();
    });
  });

  describe("Loading State Tests (AC-5)", () => {
    it("displays skeleton while loading", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<VoiceProfileDisplay />);

      // Check for skeleton elements
      const skeletons = container.querySelectorAll('[class*="bg-[#2a2a2a]"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("skeleton has correct structure (4 metric rows)", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<VoiceProfileDisplay />);

      // Should have 4 metric rows in skeleton
      const metricRows = container.querySelectorAll(".flex.items-start.gap-3");
      expect(metricRows.length).toBe(4);
    });
  });

  describe("Error State Tests", () => {
    it("displays error message when fetch fails", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: false,
        error: "Database connection failed",
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(
        screen.getByText(/Failed to load voice profile: Database connection failed/),
      ).toBeInTheDocument();
    });

    it("error message is user-friendly", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: false,
        error: "Network error",
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      const errorElement = screen.getByText(/Failed to load voice profile/);
      expect(errorElement).toHaveClass("text-red-500");
    });
  });

  describe("Privacy Messaging Tests (AC-6)", () => {
    it("displays privacy message", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      expect(screen.getByText(/🔒 Your proposals stay on your device/)).toBeInTheDocument();
    });
  });

  describe("Accessibility Tests (AC-7)", () => {
    it('emojis have aria-hidden="true"', () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<VoiceProfileDisplay />);

      const emojiSpans = container.querySelectorAll('span[aria-hidden="true"]');
      expect(emojiSpans.length).toBe(4);
    });

    it('metrics have role="list" and role="listitem" for screen readers', () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<VoiceProfileDisplay />);

      const list = container.querySelector('[role="list"]');
      expect(list).toBeInTheDocument();
      expect(list).toHaveAttribute("aria-label", "Voice profile metrics");

      const listItems = container.querySelectorAll('[role="listitem"]');
      expect(listItems.length).toBe(4);
    });

    it("metrics have aria-label for screen reader announcements", () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<VoiceProfileDisplay />);

      const toneMetric = container.querySelector('[aria-label*="Tone: Professional"]');
      expect(toneMetric).toBeInTheDocument();

      const lengthMetric = container.querySelector('[aria-label*="Length: Moderate"]');
      expect(lengthMetric).toBeInTheDocument();
    });

    it("Recalibrate button is keyboard accessible", async () => {
      const user = userEvent.setup();
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<VoiceProfileDisplay />);

      const button = screen.getByRole("button", { name: /Recalibrate Voice/i });

      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe("Navigation Tests (AC-4)", () => {
    it('"Recalibrate Voice" button triggers navigation to /calibration', async () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: mockProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const user = userEvent.setup();
      render(<VoiceProfileDisplay />);

      const button = screen.getByRole("button", { name: /Recalibrate Voice/i });
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/calibration");
    });

    it('empty state "Start Calibration" button triggers navigation to /calibration', async () => {
      vi.mocked(useVoiceProfile).mockReturnValue({
        profile: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const user = userEvent.setup();
      render(<VoiceProfileDisplay />);

      const button = screen.getByRole("button", { name: /Start Calibration/i });
      await user.click(button);

      // Note: This verifies the mock VoiceProfileEmpty's button calls onStartCalibration,
      // which in turn calls navigate('/calibration')
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/calibration");
    });
  });
});
