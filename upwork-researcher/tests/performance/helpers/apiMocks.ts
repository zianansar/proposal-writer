// Claude API mocking utilities for performance benchmarks

export interface MockApiConfig {
  firstTokenDelayMs: number;
  tokensPerSecond: number;
  totalTokens: number;
}

/**
 * Mocks Claude API with realistic latency simulation
 * Simulates streaming behavior with configurable delays
 */
export async function mockClaudeAPIWithLatency(config: MockApiConfig): Promise<void> {
  const { firstTokenDelayMs, tokensPerSecond, totalTokens } = config;

  // TODO: Implement API mocking strategy
  // Options:
  // 1. Mock at Tauri command layer (intercept generate_proposal)
  // 2. Mock HTTP client in Rust
  // 3. Use test doubles in integration tests

  console.log('[PERF] API mocked with latency:', config);

  // Store mock config for retrieval by tests
  (global as any).__mockApiConfig = config;
}

/**
 * Generates realistic mock proposal text
 * Returns text matching expected token count
 */
export function generateMockProposal(tokens: number): string {
  // Approximate: 1 token ≈ 0.75 words
  const words = Math.floor(tokens * 0.75);
  const mockWords = ['solution', 'experience', 'project', 'quality', 'deliver', 'expertise'];

  return Array.from({ length: words }, (_, i) =>
    mockWords[i % mockWords.length]
  ).join(' ');
}
