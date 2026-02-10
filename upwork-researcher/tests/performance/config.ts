// Performance test configuration with NFR thresholds
// Source: prd.md Section 6 Non-Functional Requirements

export const NFR_THRESHOLDS = {
  // NFR-1: Startup
  STARTUP_COLD_MS: 2000,

  // NFR-2: Memory
  MEMORY_PEAK_MB: 300,
  MEMORY_IDLE_MB: 200,
  MEMORY_PER_PROPOSAL_MB: 5,

  // NFR-4: UI Response
  UI_RESPONSE_MS: 100,

  // NFR-5: First Token
  FIRST_TOKEN_MS: 1500,

  // NFR-6: Full Generation
  FULL_GENERATION_MS: 8000,

  // NFR-17: Database Queries
  QUERY_PROPOSAL_HISTORY_MS: 500,
  QUERY_JOB_QUEUE_MS: 500,
  QUERY_VOICE_PROFILE_MS: 100,
  QUERY_SETTINGS_MS: 50,
} as const;

export const BENCHMARK_CONFIG = {
  // Number of iterations for statistical reliability
  ITERATIONS: 5,

  // Use median instead of mean (more robust to outliers)
  USE_MEDIAN: true,

  // Seed data for database benchmarks
  SEED_PROPOSAL_COUNT: 500,
  SEED_JOB_COUNT: 100,

  // Tolerance for regression detection (10% above baseline)
  REGRESSION_TOLERANCE: 0.10,
} as const;
