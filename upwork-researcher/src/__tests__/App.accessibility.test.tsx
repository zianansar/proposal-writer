/**
 * App Accessibility Tests (Story 8.3)
 * Tests screen reader support and WCAG AA compliance
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { axe } from "vitest-axe";

import App from "../App";

// Mock Tauri API with comprehensive responses
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string) => {
    // Return appropriate mock data based on command
    switch (command) {
      case "has_api_key":
        return Promise.resolve(true);
      case "check_for_draft":
        return Promise.resolve(null); // No draft recovery
      case "get_encryption_status":
        return Promise.resolve({
          databaseEncrypted: true,
          keyStored: true,
          algorithm: "AES-256-GCM",
        });
      case "get_cooldown_remaining":
        return Promise.resolve(0);
      case "check_threshold_learning":
        return Promise.resolve(null);
      case "check_threshold_decrease":
        return Promise.resolve(null);
      case "get_setting":
        return Promise.resolve("true"); // onboarding_completed
      case "get_settings":
        return Promise.resolve({
          humanizationIntensity: "medium",
          perplexityThreshold: 180,
        });
      case "get_user_skills":
        return Promise.resolve([]);
      default:
        return Promise.resolve(null);
    }
  }),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

describe("App Accessibility (Story 8.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC5: Semantic Landmarks", () => {
    it("has header landmark with role=banner", async () => {
      render(<App />);

      // Wait for app to load
      const header = await screen.findByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header.tagName).toBe("HEADER");
    });

    it("has navigation landmark", async () => {
      render(<App />);

      const nav = await screen.findByRole("navigation");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("aria-label", "Main navigation");
    });

    it("has main content landmark", async () => {
      render(<App />);

      // Wait for app to fully load
      await screen.findByRole("banner");

      // Find main element by id (JSDOM may not recognize implicit main role)
      const main = document.getElementById("main-content");
      expect(main).toBeInTheDocument();
      expect(main?.tagName).toBe("MAIN");
      expect(main).toHaveAttribute("role", "main");
    });
  });

  describe("AC4: Heading Hierarchy", () => {
    it("has exactly one h1 per page", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const headings = screen.getAllByRole("heading", { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("Upwork Research Agent");
    });

    it("has h2 for each tab section", async () => {
      render(<App />);

      await screen.findByRole("banner");

      // Should have h2 headings for main sections
      const h2Headings = screen.getAllByRole("heading", { level: 2 });
      expect(h2Headings.length).toBeGreaterThanOrEqual(1);
    });

    it("does not skip heading levels", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const allHeadings = screen.getAllByRole("heading");
      const levels = allHeadings.map((h) => {
        const tag = h.tagName.toLowerCase();
        return parseInt(tag.charAt(1), 10);
      });

      // Check that levels increase by at most 1
      for (let i = 1; i < levels.length; i++) {
        const diff = levels[i] - levels[i - 1];
        expect(diff).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("AC1: Button Accessibility", () => {
    it("all buttons have accessible names", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const buttons = screen.getAllByRole("button");

      buttons.forEach((button) => {
        const name = button.getAttribute("aria-label") || button.textContent;
        expect(name).toBeTruthy();
        expect(name?.trim()).not.toBe("");
      });
    });
  });

  describe("AC2: Form Field Accessibility", () => {
    it("textarea has associated label", async () => {
      render(<App />);

      const textarea = await screen.findByRole("textbox");
      const label = screen.getByText("Job Post");

      expect(textarea).toHaveAttribute("id");
      expect(label).toHaveAttribute("for", textarea.getAttribute("id")!);
    });

    it("required field has aria-required", async () => {
      render(<App />);

      const textarea = await screen.findByRole("textbox");
      expect(textarea).toHaveAttribute("aria-required", "true");
    });
  });

  describe("AC3: Live Region Announcements", () => {
    it("has polite live region with role=status", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const statusRegions = screen.getAllByRole("status");
      const politeRegion = statusRegions.find(
        (region) => region.getAttribute("aria-live") === "polite",
      );

      expect(politeRegion).toBeInTheDocument();
      expect(politeRegion).toHaveAttribute("aria-atomic", "true");
      expect(politeRegion).toHaveClass("sr-only");
    });

    it("has assertive live region with role=alert", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const alertRegion = screen.getByRole("alert");
      expect(alertRegion).toHaveAttribute("aria-live", "assertive");
      expect(alertRegion).toHaveAttribute("aria-atomic", "true");
      expect(alertRegion).toHaveClass("sr-only");
    });
  });

  describe("AC6: Icons and Decorative Elements", () => {
    it("decorative icons have aria-hidden", async () => {
      render(<App />);

      await screen.findByRole("banner");

      const doc = document.body;
      const decorativeIcons = doc.querySelectorAll('[aria-hidden="true"]');

      // Should have at least some decorative elements
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe("WCAG AA Compliance (axe-core)", () => {
    it("should have no critical accessibility violations", async () => {
      const { container } = render(<App />);

      // Wait for app to load
      await screen.findByRole("banner");

      const results = await axe(container);

      // Check for violations
      expect(results.violations).toHaveLength(0);
    });
  });
});
