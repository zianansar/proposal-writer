import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock Tauri core API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string, args?: Record<string, unknown>) => {
    if (command === "save_proposal") {
      return Promise.resolve({ id: 1, saved: true });
    }
    if (command === "generate_proposal_streaming") {
      return Promise.resolve("Generated proposal text");
    }
    if (command === "get_proposals") {
      return Promise.resolve([
        { id: 1, jobContent: "Test job content 1", createdAt: "2026-02-04T10:30:00Z" },
        { id: 2, jobContent: "Test job content 2", createdAt: "2026-02-04T11:00:00Z" },
      ]);
    }
    if (command === "has_api_key") {
      return Promise.resolve(true); // Default to having API key for most tests
    }
    if (command === "set_api_key") {
      return Promise.resolve();
    }
    if (command === "get_api_key_masked") {
      return Promise.resolve("sk-ant-...1234");
    }
    if (command === "validate_api_key") {
      const apiKey = args?.apiKey as string;
      if (apiKey && apiKey.startsWith("sk-ant-") && apiKey.length >= 20) {
        return Promise.resolve();
      }
      return Promise.reject("Invalid API key format");
    }
    if (command === "analyze_perplexity") {
      // Default: safe score (below threshold) so copy proceeds normally
      return Promise.resolve({ score: 120.0, threshold: 180, flaggedSentences: [] });
    }
    return Promise.resolve(null);
  }),
}));

// Mock Tauri event system before any imports
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})), // Returns unlisten function
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock Tauri clipboard plugin
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(() => Promise.resolve()),
  readText: vi.fn(() => Promise.resolve("")),
}));

afterEach(() => {
  cleanup();
});
