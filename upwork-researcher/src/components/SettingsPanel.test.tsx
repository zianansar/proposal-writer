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

// Helper: flush pending promises (allows React state updates + async invoke to resolve)
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SettingsPanel - Safety Threshold (Story 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers with shouldAdvanceTime to prevent waitFor timeouts
    vi.useFakeTimers({ shouldAdvanceTime: true });

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
      // Story 4b.5 Review Fix: Return proper RateConfig object instead of null
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      // Story 4b.5 Review Fix: Return empty skills array for UserSkillsConfig
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
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

    // Advance timers by 300ms (debounce period) and flush promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Now set_setting should be called
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "safety_threshold",
      value: "200",
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

    // Advance past debounce and flush promises
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Verify save was called
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "safety_threshold",
      value: "150",
    });

    // Check success message appears
    expect(screen.getByText("✓ Saved")).toBeInTheDocument();
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
      // Story 4b.5 Review Fix: Include rate config mock
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      // Story 4b.5 Review Fix: Include user skills mock
      if (command === "get_user_skills") {
        return Promise.resolve([]);
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

    // Advance past debounce and flush promises (error handling + revert)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Verify save was attempted
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "safety_threshold",
      value: "200",
    });

    // Check error message appears
    expect(screen.getByText(/Failed:/)).toBeInTheDocument();

    // Slider should revert to 180
    expect(slider).toHaveValue("180");
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

    // Rapid changes: 150, 160, 170, 200
    await act(async () => {
      fireEvent.change(slider, { target: { value: "150" } });
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "160" } });
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "170" } });
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      fireEvent.change(slider, { target: { value: "200" } });
    });

    // Now wait for debounce to complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Only ONE set_setting call should have been made (for the last value 200)
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "safety_threshold",
      value: "200",
    });
  });
});

// Story 4b.4: Rate Configuration Tests (Subtask 9.4)
describe("SettingsPanel - Rate Configuration (Story 4b.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default mock: return rates config and safety threshold
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "set_user_hourly_rate") {
        return Promise.resolve();
      }
      if (command === "set_user_project_rate_min") {
        return Promise.resolve();
      }
      if (command === "set_setting") {
        return Promise.resolve();
      }
      if (command === "set_log_level") {
        return Promise.resolve();
      }
      // Story 4b.5 Review Fix: Include user skills mock
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // Subtask 9.4: Test hourly rate input renders
  it("renders hourly rate input field", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    const hourlyInput = screen.getByTestId("hourly-rate-input");
    expect(hourlyInput).toBeInTheDocument();
    expect(hourlyInput).toHaveAttribute("placeholder", "75");
    expect(hourlyInput).toHaveAttribute("type", "number");
  });

  // Subtask 9.4: Test project rate input renders
  it("renders project rate input field", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    const projectInput = screen.getByTestId("project-rate-input");
    expect(projectInput).toBeInTheDocument();
    expect(projectInput).toHaveAttribute("placeholder", "2000");
    expect(projectInput).toHaveAttribute("type", "number");
  });

  // Subtask 9.4: Test rates load on mount
  it("loads configured rates on mount", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: 75.0, project_rate_min: 2000.0 });
      }
      // Story 4b.5 Review Fix: Include user skills mock
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      const hourlyInput = screen.getByTestId("hourly-rate-input");
      expect(hourlyInput).toHaveValue(75);
    });

    const projectInput = screen.getByTestId("project-rate-input");
    expect(projectInput).toHaveValue(2000);
  });

  // Subtask 9.4: Test hourly rate saves with debounce (500ms)
  it("saves hourly rate after 500ms debounce", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    vi.clearAllMocks();

    const hourlyInput = screen.getByTestId("hourly-rate-input");

    // Change to 85
    await act(async () => {
      fireEvent.change(hourlyInput, { target: { value: "85" } });
    });

    // Should NOT be called immediately
    expect(mockInvoke).not.toHaveBeenCalledWith("set_user_hourly_rate", expect.anything());

    // Advance timers by 500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Now should be called
    expect(mockInvoke).toHaveBeenCalledWith("set_user_hourly_rate", { rate: 85 });
  });

  // Subtask 9.4: Test project rate saves with debounce (500ms)
  it("saves project rate after 500ms debounce", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    vi.clearAllMocks();

    const projectInput = screen.getByTestId("project-rate-input");

    // Change to 3000
    await act(async () => {
      fireEvent.change(projectInput, { target: { value: "3000" } });
    });

    // Should NOT be called immediately
    expect(mockInvoke).not.toHaveBeenCalledWith("set_user_project_rate_min", expect.anything());

    // Advance timers by 500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Now should be called
    expect(mockInvoke).toHaveBeenCalledWith("set_user_project_rate_min", { rate: 3000 });
  });

  // Subtask 9.4: Test "Saving..." indicator appears during save
  it("shows 'Saving...' indicator during hourly rate save", async () => {
    // Make the invoke hang for a bit so we can see the saving state
    let resolveInvoke: (() => void) | null = null;
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "set_user_hourly_rate") {
        return new Promise<void>((resolve) => {
          resolveInvoke = resolve;
        });
      }
      // Story 4b.5 Review Fix: Include user skills mock
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    const hourlyInput = screen.getByTestId("hourly-rate-input");

    // Change to 85
    await act(async () => {
      fireEvent.change(hourlyInput, { target: { value: "85" } });
    });

    // Advance past debounce to trigger save
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // "Saving..." should appear
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    // Complete the save
    await act(async () => {
      resolveInvoke?.();
    });

    // "Saving..." should disappear
    await waitFor(() => {
      expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
    });
  });

  // Subtask 9.4: Test help text is displayed
  it("shows help text for rate configuration", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    expect(screen.getByText("Used to calculate budget alignment for job scoring")).toBeInTheDocument();
  });

  // Subtask 9.4: Test success message appears
  it("shows success message after hourly rate saved", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    const hourlyInput = screen.getByTestId("hourly-rate-input");

    await act(async () => {
      fireEvent.change(hourlyInput, { target: { value: "85" } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("✓ Hourly rate saved")).toBeInTheDocument();
  });

  // Subtask 9.4: Test empty value doesn't trigger save
  it("does not save empty hourly rate value", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: 75.0, project_rate_min: null });
      }
      if (command === "set_user_hourly_rate") {
        return Promise.resolve();
      }
      // Story 4b.5 Review Fix: Include user skills mock
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    vi.clearAllMocks();

    const hourlyInput = screen.getByTestId("hourly-rate-input");

    // Clear the input
    await act(async () => {
      fireEvent.change(hourlyInput, { target: { value: "" } });
    });

    // Advance past debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Should NOT call set_user_hourly_rate for empty value
    expect(mockInvoke).not.toHaveBeenCalledWith("set_user_hourly_rate", expect.anything());
  });

  // Subtask 9.4: Test invalid value (<=0) doesn't trigger save
  it("does not save invalid hourly rate value (<=0)", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_user_rate_config");
    });

    vi.clearAllMocks();

    const hourlyInput = screen.getByTestId("hourly-rate-input");

    // Enter 0
    await act(async () => {
      fireEvent.change(hourlyInput, { target: { value: "0" } });
    });

    // Advance past debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Should NOT call set_user_hourly_rate for invalid value
    expect(mockInvoke).not.toHaveBeenCalledWith("set_user_hourly_rate", expect.anything());
  });
});

// Story 6.2: VoiceSettings Integration Tests
describe("SettingsPanel - VoiceSettings Integration (Story 6.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      // VoiceSettings calls
      if (command === "get_voice_profile") {
        return Promise.resolve(null);
      }
      if (command === "update_voice_parameters") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // [AI-Review] Test that VoiceSettings component renders within SettingsPanel
  it("renders VoiceSettings component with Voice Settings header", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for all async loading to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_voice_profile", { userId: "default" });
    });

    // VoiceSettings should render with its header
    expect(screen.getByText("Voice Settings")).toBeInTheDocument();
  });

  // [AI-Review] Test that VoiceSettings sliders are accessible in SettingsPanel
  it("renders VoiceSettings sliders within SettingsPanel", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_voice_profile", { userId: "default" });
    });

    // All three voice sliders should be present
    expect(screen.getByLabelText(/tone.*formal to casual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/length.*brief to detailed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/technical depth.*simple to expert/i)).toBeInTheDocument();
  });

  // [AI-Review] Test that VoiceSettings info message is visible
  it("displays VoiceSettings info message in SettingsPanel", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_voice_profile", { userId: "default" });
    });

    expect(screen.getByText(/changes will affect future proposals/i)).toBeInTheDocument();
  });
});

describe("SettingsPanel - Privacy & Telemetry (Story 8.14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default mocks
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_setting") {
        // Story 8.14: crash_reporting_enabled defaults to null (not set)
        if (args?.key === "crash_reporting_enabled") {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      }
      if (command === "set_setting") {
        return Promise.resolve();
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // Task 6.1: Privacy indicator renders with correct text
  it("renders Privacy section with zero telemetry indicator", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for component to mount
    await flushPromises();

    // Check Privacy section exists
    expect(screen.getByText("Privacy")).toBeInTheDocument();

    // Check zero telemetry indicator text
    expect(screen.getByText("Zero Telemetry")).toBeInTheDocument();
    expect(screen.getByText(/no usage data, analytics, or crash reports/i)).toBeInTheDocument();
    expect(screen.getByText(/all data stays on your device/i)).toBeInTheDocument();
  });

  // Task 6.2: Crash reporting toggle defaults to OFF
  it("crash reporting toggle defaults to OFF when setting is not set", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for settings to load
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_setting", {
        key: "crash_reporting_enabled",
      });
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("crash reporting toggle shows OFF when setting is 'false'", async () => {
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "get_setting" && args?.key === "crash_reporting_enabled") {
        return Promise.resolve("false");
      }
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });
      expect(checkbox).not.toBeChecked();
    });
  });

  // Task 6.3: Crash reporting toggle persists to settings store
  it("persists crash reporting toggle to settings when enabled", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for initial load
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_setting", {
        key: "crash_reporting_enabled",
      });
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });

    // Enable crash reporting
    await act(async () => {
      fireEvent.click(checkbox);
      await flushPromises();
    });

    // Verify set_setting was called with correct args
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "crash_reporting_enabled",
        value: "true",
      });
    });

    expect(checkbox).toBeChecked();
  });

  it("persists crash reporting toggle to settings when disabled", async () => {
    // Start with crash reporting enabled
    mockInvoke.mockImplementation((command: string, args?: any) => {
      if (command === "get_setting" && args?.key === "crash_reporting_enabled") {
        return Promise.resolve("true");
      }
      if (command === "set_setting") {
        return Promise.resolve();
      }
      if (command === "get_safety_threshold") {
        return Promise.resolve(180);
      }
      if (command === "get_user_rate_config") {
        return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      }
      if (command === "get_user_skills") {
        return Promise.resolve([]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<SettingsPanel />);
    });

    // Wait for initial load - checkbox should be checked
    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });
      expect(checkbox).toBeChecked();
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });

    // Disable crash reporting
    await act(async () => {
      fireEvent.click(checkbox);
      await flushPromises();
    });

    // Verify set_setting was called with false
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
        key: "crash_reporting_enabled",
        value: "false",
      });
    });
  });

  // Task 6.4: Privacy section is visible in settings view
  it("displays Privacy section above Humanization section", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await flushPromises();

    const privacyHeading = screen.getByText("Privacy");
    const humanizationHeading = screen.getByText("Humanization");

    expect(privacyHeading).toBeInTheDocument();
    expect(humanizationHeading).toBeInTheDocument();

    // Verify Privacy comes before Humanization in DOM order
    const allHeadings = screen.getAllByRole("heading", { level: 3 });
    const privacyIndex = allHeadings.indexOf(privacyHeading);
    const humanizationIndex = allHeadings.indexOf(humanizationHeading);

    expect(privacyIndex).toBeLessThan(humanizationIndex);
  });

  it("displays warning text for crash reporting", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await flushPromises();

    expect(screen.getByText(/when enabled, anonymous crash data may be sent/i)).toBeInTheDocument();
    expect(screen.getByText(/disabled by default for maximum privacy/i)).toBeInTheDocument();
  });

  it("reverts crash reporting toggle on save failure", async () => {
    // Start with crash reporting disabled (default)
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_setting", {
        key: "crash_reporting_enabled",
      });
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });
    expect(checkbox).not.toBeChecked();

    // Make set_setting fail
    mockInvoke.mockImplementation((command: string) => {
      if (command === "set_setting") {
        return Promise.reject(new Error("Database write failed"));
      }
      if (command === "get_safety_threshold") return Promise.resolve(180);
      if (command === "get_user_rate_config") return Promise.resolve({ hourly_rate: null, project_rate_min: null });
      if (command === "get_user_skills") return Promise.resolve([]);
      return Promise.resolve(null);
    });

    // Try to enable - should fail and revert
    await act(async () => {
      fireEvent.click(checkbox);
      await flushPromises();
    });

    // Checkbox should revert to unchecked
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });

    // Error message should be displayed
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
  });

  it("disables crash reporting checkbox while saving", async () => {
    await act(async () => {
      render(<SettingsPanel />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_setting", {
        key: "crash_reporting_enabled",
      });
    });

    const checkbox = screen.getByRole("checkbox", { name: /enable crash reporting/i });

    // Mock slow save operation
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });

    mockInvoke.mockImplementation((command: string) => {
      if (command === "set_setting") {
        return savePromise;
      }
      return Promise.resolve(null);
    });

    // Click checkbox
    await act(async () => {
      fireEvent.click(checkbox);
    });

    // Checkbox should be disabled during save
    expect(checkbox).toBeDisabled();

    // Resolve save
    await act(async () => {
      resolveSave!();
      await flushPromises();
    });

    // Checkbox should be enabled again
    await waitFor(() => {
      expect(checkbox).not.toBeDisabled();
    });
  });
});
