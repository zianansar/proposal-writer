import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import SettingsPanel from "./SettingsPanel";

const mockInvoke = vi.mocked(invoke);

// Mock the stores
vi.mock("../stores/useSettingsStore", () => ({
  useSettingsStore: vi.fn((selector) => {
    if (selector) {
      // getHumanizationIntensity selector
      return "medium";
    }
    // Default store
    return {
      getSetting: vi.fn((key: string) => {
        if (key === "log_level") return "INFO";
        return undefined;
      }),
      setSetting: vi.fn(),
    };
  }),
  getHumanizationIntensity: vi.fn(),
}));

vi.mock("../stores/useOnboardingStore", () => ({
  useOnboardingStore: vi.fn(() => ({
    setShowOnboarding: vi.fn(),
  })),
}));

describe("SettingsPanel - Safety Threshold (Story 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock: get_safety_threshold returns 180
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "set_setting") {
        return Promise.resolve();
      }
      if (command === "set_log_level") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Story 3.5, Task 6.5: Test Safety section renders with slider (140-220 range)
  it("renders Safety section with slider (range 140-220)", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for async threshold load
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    });

    // Check section exists
    expect(screen.getByText("Safety")).toBeInTheDocument();

    // Check slider exists with correct attributes
    const slider = screen.getByRole("slider", { name: /ai detection threshold/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("min", "140");
    expect(slider).toHaveAttribute("max", "220");
    expect(slider).toHaveAttribute("step", "10");
  });

  // Story 3.5, Task 6.6: Test slider displays default value 180 on load
  it("displays default threshold 180 on load", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for async threshold load
    await waitFor(() => {
      const slider = screen.getByRole("slider", { name: /ai detection threshold/i });
      expect(slider).toHaveValue("180");
    });

    // Check label shows threshold value
    expect(screen.getByText(/AI Detection Threshold:/)).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
  });

  // Story 3.5, Task 6.7: Test changing slider calls set_setting with new value (debounced 300ms)
  it("calls set_setting after debounce (300ms) when slider changes", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for initial load
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    });

    vi.clearAllMocks();

    const slider = screen.getByRole("slider", { name: /ai detection threshold/i });

    // Change slider to 200
    await act(async () => {
      fireEvent.change(slider, { target: { value: "200" } });
    });

    // Immediately after change, set_setting should NOT be called yet (debouncing)
    expect(mockInvoke).not.toHaveBeenCalledWith("set_setting", expect.anything());

    // Advance timers by 300ms (debounce period)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Now set_setting should be called
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "safety_threshold",
        value: "200",
      });
    });
  });

  // Story 3.5, Task 6.8: Test labels "Strict", "Balanced", "Permissive" display correctly
  it("displays labels Strict (140), Balanced (180), Permissive (220)", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for render
    await waitFor(() => {
      expect(screen.getByText("Safety")).toBeInTheDocument();
    });

    // Check all three labels exist
    expect(screen.getByText("Strict (140)")).toBeInTheDocument();
    expect(screen.getByText("Balanced (180)")).toBeInTheDocument();
    expect(screen.getByText("Permissive (220)")).toBeInTheDocument();

    // Check help text
    expect(screen.getByText(/Lower = stricter AI detection checks, Higher = more proposals pass/)).toBeInTheDocument();
  });

  // Story 3.5: Test success message appears after save
  it("shows success message '✓ Saved' after set_setting succeeds", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    });

    const slider = screen.getByRole("slider", { name: /ai detection threshold/i });

    // Change slider
    await act(async () => {
      fireEvent.change(slider, { target: { value: "150" } });
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Wait for save to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "safety_threshold",
        value: "150",
      });
    });

    // Check success message appears
    await waitFor(() => {
      expect(screen.getByText("✓ Saved")).toBeInTheDocument();
    });
  });

  // Story 3.5: Test slider reverts on save error
  it("reverts slider value on save error", async () => {
    // Mock set_setting to fail
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "set_setting") {
        return Promise.reject(new Error("Database error"));
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    });

    const slider = screen.getByRole("slider", { name: /ai detection threshold/i });

    // Initial value should be 180
    expect(slider).toHaveValue("180");

    // Change slider to 200
    await act(async () => {
      fireEvent.change(slider, { target: { value: "200" } });
    });

    // Slider should update locally
    expect(slider).toHaveValue("200");

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Wait for save attempt and revert
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "safety_threshold",
        value: "200",
      });
    });

    // Revert happens via get_safety_threshold call
    await waitFor(() => {
      // Check error message appears
      expect(screen.getByText(/Failed:/)).toBeInTheDocument();
    });

    // Slider should revert to 180
    await waitFor(() => {
      expect(slider).toHaveValue("180");
    });
  });

  // Story 3.5: Test multiple rapid changes only trigger one save (debouncing)
  it("debounces rapid slider changes (only saves once after 300ms)", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_safety_threshold");
    });

    vi.clearAllMocks();

    const slider = screen.getByRole("slider", { name: /ai detection threshold/i });

    // Rapid changes: 150, 160, 170, 180
    await act(async () => {
      fireEvent.change(slider, { target: { value: "150" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "160" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "170" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "200" } });
    });

    // Now wait for debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Only ONE set_setting call should have been made (for the last value 200)
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "safety_threshold",
        value: "200",
      });
    });
  });
});
