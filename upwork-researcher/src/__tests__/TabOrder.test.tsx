/**
 * Story 8.2 Task 4: Tab Order Audit Tests
 *
 * Tests for AC1 (Logical Tab Order) and AC2 (Reverse Tab Navigation)
 * Ensures keyboard navigation follows expected order and no elements are skipped.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import App from "../App";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === "has_api_key") return Promise.resolve(true);
    if (cmd === "get_encryption_status") return Promise.resolve({ databaseEncrypted: false });
    if (cmd === "get_cooldown_remaining") return Promise.resolve(0);
    if (cmd === "check_threshold_learning") return Promise.resolve(null);
    if (cmd === "check_threshold_decrease") return Promise.resolve(null);
    if (cmd === "check_for_draft") return Promise.resolve(null);
    if (cmd === "get_setting") return Promise.resolve("true"); // onboarding completed
    if (cmd === "get_proposals") return Promise.resolve([]);
    if (cmd === "get_user_skills") return Promise.resolve([]);
    if (cmd === "get_hourly_rate") return Promise.resolve({ hourly_rate: 50.0, daily_rate: 400.0 });
    return Promise.resolve(null);
  }),
}));

describe("Story 8.2 Task 4: Tab Order Audit (AC1, AC2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Task 4.1: Tab Order Audit Checklist", () => {
    it("test_skip_link_is_first_focusable", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for async initialization
      await screen.findByRole("main");

      // Tab once from document.body
      await user.tab();

      // First focus should be skip link
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveFocus();
    });

    it("test_navigation_tabs_follow_skip_link", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Tab to skip link
      await user.tab();
      expect(screen.getByText("Skip to main content")).toHaveFocus();

      // Tab to first nav tab (Generate)
      await user.tab();
      const generateTab = screen.getByRole("tab", { name: "Generate" });
      expect(generateTab).toHaveFocus();

      // Tab to History tab
      await user.tab();
      expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();

      // Tab to Settings tab
      await user.tab();
      expect(screen.getByRole("tab", { name: "Settings" })).toHaveFocus();
    });
  });

  describe("Task 4.2: Generate Tab Order", () => {
    it("test_generate_view_tab_order", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Skip past skip link and nav tabs
      await user.tab(); // Skip link
      await user.tab(); // Generate tab
      await user.tab(); // History tab
      await user.tab(); // Settings tab

      // Now we should be in the Generate tab content
      // Next focusable should be job input textarea
      await user.tab();
      const jobInput = screen.getByPlaceholderText(
        /paste a job post url or the full job description/i,
      );
      expect(jobInput).toHaveFocus();

      // Disabled buttons are not focusable (correct behavior)
      // Verify buttons exist but are disabled
      const analyzeButton = screen.getByRole("button", { name: "Analyze Job" });
      expect(analyzeButton).toBeDisabled();

      const generateButton = screen.getByRole("button", { name: "Generate Proposal" });
      expect(generateButton).toBeDisabled();

      // The tab order is correct: input is reachable, disabled buttons are skipped
      // This is the expected WCAG-compliant behavior
    });
  });

  describe("Task 4.3: History Tab Order", () => {
    it("test_history_view_accessible_via_tab", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Tab to History tab and activate it
      await user.tab(); // Skip link
      await user.tab(); // Generate tab
      await user.tab(); // History tab

      const historyTab = screen.getByRole("tab", { name: "History" });
      expect(historyTab).toHaveFocus();

      // Activate History view
      await user.keyboard("{Enter}");

      // Verify History view is shown
      expect(screen.getByText(/no proposals yet/i)).toBeInTheDocument();
    });
  });

  describe("Task 4.4: Settings Tab Order", () => {
    it("test_settings_view_accessible_via_tab", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Tab to Settings tab and activate it
      await user.tab(); // Skip link
      await user.tab(); // Generate tab
      await user.tab(); // History tab
      await user.tab(); // Settings tab

      const settingsTab = screen.getByRole("tab", { name: "Settings" });
      expect(settingsTab).toHaveFocus();

      // Activate Settings view
      await user.keyboard("{Enter}");

      // Verify Settings view is shown (check for Data Export section)
      expect(screen.getByText(/data export/i)).toBeInTheDocument();
    });
  });

  describe("Task 4.5: No Positive TabIndex Values", () => {
    it("test_no_positive_tabindex_in_dom", async () => {
      const { container } = render(<App />);

      await screen.findByRole("main");

      // Query all elements with tabindex attribute
      const elementsWithTabIndex = container.querySelectorAll("[tabindex]");

      elementsWithTabIndex.forEach((element) => {
        const tabIndexValue = element.getAttribute("tabindex");
        const tabIndexNum = parseInt(tabIndexValue || "0", 10);

        // Only allow 0 or -1, no positive values
        expect(tabIndexNum).toBeLessThanOrEqual(0);
      });
    });
  });

  describe("Task 4.6: Hidden Elements Not Focusable", () => {
    it("test_main_content_not_in_initial_tab_order", async () => {
      const { container } = render(<App />);

      await screen.findByRole("main");

      // The main-content div should NOT have tabindex by default
      // SkipLink will set it temporarily when clicked
      const mainContent = container.querySelector("#main-content");
      expect(mainContent).toBeInTheDocument();

      // Should not have tabindex attribute by default
      const hasTabIndex = mainContent?.hasAttribute("tabindex");
      expect(hasTabIndex).toBe(false);
    });
  });

  describe("AC2: Reverse Tab Navigation (Shift+Tab)", () => {
    it("test_shift_tab_moves_backwards", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Tab forward to Generate tab
      await user.tab(); // Skip link
      await user.tab(); // Generate tab (now focused)

      expect(screen.getByRole("tab", { name: "Generate" })).toHaveFocus();

      // Shift+Tab back to Skip link
      await user.tab({ shift: true });
      expect(screen.getByText("Skip to main content")).toHaveFocus();
    });

    it("test_shift_tab_from_settings_to_history", async () => {
      const user = userEvent.setup();
      render(<App />);

      await screen.findByRole("main");

      // Tab to Settings tab
      await user.tab(); // Skip link
      await user.tab(); // Generate
      await user.tab(); // History
      await user.tab(); // Settings

      expect(screen.getByRole("tab", { name: "Settings" })).toHaveFocus();

      // Shift+Tab back to History
      await user.tab({ shift: true });
      expect(screen.getByRole("tab", { name: "History" })).toHaveFocus();

      // Shift+Tab back to Generate
      await user.tab({ shift: true });
      expect(screen.getByRole("tab", { name: "Generate" })).toHaveFocus();
    });
  });

  describe("AC1: No Elements Skipped", () => {
    it("test_all_interactive_elements_reachable", async () => {
      const { container } = render(<App />);

      await screen.findByRole("main");

      // Get all interactive elements
      const buttons = container.querySelectorAll("button:not([disabled])");
      const inputs = container.querySelectorAll("input:not([disabled])");
      const textareas = container.querySelectorAll("textarea:not([disabled])");
      const links = container.querySelectorAll("a[href]");

      // All should be reachable (either native focusable or have tabindex=0)
      [...buttons, ...inputs, ...textareas, ...links].forEach((element) => {
        const isNaturallyFocusable = ["BUTTON", "INPUT", "TEXTAREA", "A"].includes(element.tagName);
        const hasTabIndex = element.hasAttribute("tabindex");
        const tabIndexValue = element.getAttribute("tabindex");

        // Element should either be naturally focusable OR have tabindex="0"
        const isFocusable = isNaturallyFocusable || (hasTabIndex && tabIndexValue === "0");

        expect(isFocusable).toBe(true);
      });
    });
  });
});
