// Database query performance benchmarks (NFR-17)
// Tests query performance with 500+ records to ensure responsive UI
//
// NOTE: These tests require the actual Tauri runtime because they call Rust
// database commands (get_proposals, get_job_queue, etc.) via invoke(). They
// also need a seeded SQLCipher database with 500+ records. Skipped until the
// Tauri app can be built and run in the test environment. The database seeder
// commands (seed_proposals, seed_job_posts) are implemented in Rust but need
// the Tauri runtime to execute.

import { invoke } from "@tauri-apps/api/core";
import { describe, it, expect, beforeAll, vi } from "vitest";

import { NFR_THRESHOLDS, BENCHMARK_CONFIG } from "./config";
import { seedDatabase, clearDatabase } from "./helpers/dbSeeder";
import { measureTiming, assertTiming } from "./helpers/timing";

// Mock @tauri-apps/api/core since invoke() is not available in Vitest/Node.
// These benchmarks need the actual Tauri runtime + seeded SQLCipher database
// to produce meaningful results.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi
    .fn()
    .mockRejectedValue(
      new Error(
        "Tauri invoke() not available in Vitest - requires Tauri runtime and seeded database",
      ),
    ),
}));

describe.skip("NFR-17: Database Query Performance", () => {
  // Skipped: Requires Tauri runtime with seeded SQLCipher database.
  // The invoke() calls (get_proposals, get_job_queue, get_voice_profile,
  // get_all_settings) execute Rust commands that need a live Tauri backend.
  // The database must be seeded with 500 proposals and 100 jobs via the
  // seed_proposals and seed_job_posts Rust commands before benchmarks run.

  beforeAll(async () => {
    // Clear and seed database with benchmark data
    await clearDatabase();
    await seedDatabase({
      proposals: BENCHMARK_CONFIG.SEED_PROPOSAL_COUNT,
      jobs: BENCHMARK_CONFIG.SEED_JOB_COUNT,
    });
  });

  it("loads proposal history in <500ms", async () => {
    const result = await measureTiming(
      "Proposal History Query",
      async () => {
        await invoke("get_proposals", { limit: 50, offset: 0 });
      },
      NFR_THRESHOLDS.QUERY_PROPOSAL_HISTORY_MS,
    );

    assertTiming(result);
  });

  it("loads job queue sorted by score in <500ms", async () => {
    const result = await measureTiming(
      "Job Queue Query (sorted)",
      async () => {
        await invoke("get_job_queue", {
          sortBy: "Score",
          filter: "All",
          limit: 50,
          offset: 0,
        });
      },
      NFR_THRESHOLDS.QUERY_JOB_QUEUE_MS,
    );

    assertTiming(result);
  });

  it("loads voice profile in <100ms", async () => {
    const result = await measureTiming(
      "Voice Profile Query",
      async () => {
        await invoke("get_voice_profile");
      },
      NFR_THRESHOLDS.QUERY_VOICE_PROFILE_MS,
    );

    assertTiming(result);
  });

  it("loads settings in <50ms", async () => {
    const result = await measureTiming(
      "Settings Query",
      async () => {
        await invoke("get_all_settings");
      },
      NFR_THRESHOLDS.QUERY_SETTINGS_MS,
    );

    assertTiming(result);
  });

  it("query performance scales with large datasets", async () => {
    // Verify queries remain fast even with 500 proposals
    const proposalResult = await measureTiming(
      "Proposal Query at Scale",
      async () => {
        await invoke("get_proposals", { limit: 100, offset: 0 });
      },
      NFR_THRESHOLDS.QUERY_PROPOSAL_HISTORY_MS,
    );

    // Job queue with scoring calculations
    const jobResult = await measureTiming(
      "Job Queue Query at Scale",
      async () => {
        await invoke("get_job_queue", {
          sortBy: "Score",
          filter: "All",
          limit: 100,
          offset: 0,
        });
      },
      NFR_THRESHOLDS.QUERY_JOB_QUEUE_MS,
    );

    assertTiming(proposalResult);
    assertTiming(jobResult);
  });
});
