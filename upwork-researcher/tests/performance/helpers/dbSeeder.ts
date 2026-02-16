// Database seeding utilities for performance benchmarks

import { invoke } from "@tauri-apps/api/core";

export interface SeedOptions {
  proposals?: number;
  jobs?: number;
}

/**
 * Seeds the database with test data for performance benchmarks
 * Creates realistic data matching production schemas
 */
export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const proposalCount = options.proposals ?? 0;
  const jobCount = options.jobs ?? 0;

  console.log(`[PERF] Seeding database: ${proposalCount} proposals, ${jobCount} jobs`);

  // Seed proposals
  if (proposalCount > 0) {
    await invoke("seed_proposals", { count: proposalCount });
  }

  // Seed job posts
  if (jobCount > 0) {
    await invoke("seed_job_posts", { count: jobCount });
  }

  console.log("[PERF] Database seeding complete");
}

/**
 * Clears all test data from the database
 * Use with caution - only for test databases
 */
export async function clearDatabase(): Promise<void> {
  console.log("[PERF] Clearing database");
  await invoke("clear_test_data");
  console.log("[PERF] Database cleared");
}
