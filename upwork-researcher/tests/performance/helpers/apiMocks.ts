// Claude API mocking utilities for performance benchmarks
//
// IMPORTANT: This module provides mock *configuration* and simulated data for
// benchmarks. It does NOT intercept live HTTP requests or Tauri IPC calls.
// Actual API interception requires either:
//   1. Mocking at the Tauri command layer (intercept generate_proposal in Rust)
//   2. Using a test HTTP server that simulates the Claude API
//   3. Playwright request interception in E2E tests (Story 8.9)
//
// The mock configuration returned here can be used by E2E test harnesses to
// set up appropriate latency simulation when the full app is running.

export interface MockApiConfig {
  /** Delay in ms before the first token arrives (simulates network + API processing) */
  firstTokenDelayMs: number;
  /** Streaming rate in tokens per second (Claude typically streams at 30-80 tok/s) */
  tokensPerSecond: number;
  /** Total number of tokens in the generated response */
  totalTokens: number;
}

export interface MockApiSetup {
  /** The configuration used for this mock */
  config: MockApiConfig;
  /** Calculated total duration in ms for the full streaming response */
  totalDurationMs: number;
  /** Calculated delay between each token in ms */
  interTokenDelayMs: number;
  /** Pre-generated mock proposal text matching the token count */
  mockProposalText: string;
  /** Simulated streaming chunks for test consumption */
  streamingChunks: StreamingChunk[];
}

export interface StreamingChunk {
  /** The text content of this chunk */
  text: string;
  /** Delay in ms before this chunk should be emitted */
  delayMs: number;
  /** Cumulative time from start in ms */
  cumulativeMs: number;
}

/**
 * Configures a mock Claude API with realistic latency simulation.
 *
 * Returns a MockApiSetup object containing:
 * - Calculated timing values derived from the config
 * - Pre-generated mock proposal text
 * - Simulated streaming chunks with per-chunk timing
 *
 * This is a mock *configuration*, not a live interceptor. To use in benchmarks:
 * - E2E tests (Story 8.9): Use Playwright's page.route() to intercept API calls
 *   and respond with the streaming chunks at the specified timing intervals.
 * - Integration tests: Use this config to set up a local test HTTP server that
 *   streams responses at the configured rate.
 * - Unit tests: Use the pre-generated text directly without streaming simulation.
 */
export function mockClaudeAPIWithLatency(config: MockApiConfig): MockApiSetup {
  const { firstTokenDelayMs, tokensPerSecond, totalTokens } = config;

  // Calculate timing parameters
  const interTokenDelayMs = 1000 / tokensPerSecond;
  const streamingDurationMs = (totalTokens / tokensPerSecond) * 1000;
  const totalDurationMs = firstTokenDelayMs + streamingDurationMs;

  // Generate the full mock proposal
  const mockProposalText = generateMockProposal(totalTokens);

  // Break into streaming chunks (simulate ~5 tokens per chunk, which is
  // typical for Claude's streaming behavior)
  const tokensPerChunk = 5;
  const chunks: StreamingChunk[] = [];
  const words = mockProposalText.split(' ');
  const wordsPerChunk = Math.max(1, Math.floor(tokensPerChunk * 0.75)); // ~0.75 words per token

  let cumulativeMs = firstTokenDelayMs;
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    const chunkDelayMs = i === 0 ? firstTokenDelayMs : interTokenDelayMs * tokensPerChunk;

    if (i > 0) {
      cumulativeMs += chunkDelayMs;
    }

    chunks.push({
      text: chunkWords.join(' ') + ' ',
      delayMs: chunkDelayMs,
      cumulativeMs,
    });
  }

  console.log(
    `[PERF] Mock API configured: ${totalTokens} tokens, ` +
    `${firstTokenDelayMs}ms first token, ${tokensPerSecond} tok/s, ` +
    `~${totalDurationMs.toFixed(0)}ms total, ${chunks.length} chunks`
  );

  return {
    config,
    totalDurationMs,
    interTokenDelayMs,
    mockProposalText,
    streamingChunks: chunks,
  };
}

/**
 * Generates realistic mock proposal text for benchmarks.
 *
 * Produces text that resembles an Upwork proposal with appropriate structure
 * (greeting, experience, approach, closing) matching the expected token count.
 *
 * @param tokens - Target number of tokens (approximate: 1 token ~ 0.75 words)
 */
export function generateMockProposal(tokens: number): string {
  // Approximate: 1 token ~ 0.75 words (standard GPT/Claude tokenization)
  const targetWords = Math.floor(tokens * 0.75);

  // Proposal building blocks for realistic text
  const greeting = 'Hi, I read your job posting carefully and understand your requirements.';
  const experienceIntro = 'I have extensive experience delivering similar projects.';

  const sentencePool = [
    'My approach focuses on clean architecture and maintainable code.',
    'I prioritize clear communication and regular progress updates.',
    'I have successfully completed over 50 similar projects on Upwork.',
    'My expertise includes full-stack development with modern frameworks.',
    'I can deliver a high-quality solution within your timeline.',
    'I follow best practices for testing and code review.',
    'Security and performance are always top priorities in my work.',
    'I would love to discuss the technical details further.',
    'My previous clients have consistently rated my work 5 stars.',
    'I can start working on this project immediately.',
    'I will provide daily progress updates and demos.',
    'The proposed solution will be scalable and well-documented.',
    'I understand the importance of meeting deadlines and budgets.',
    'I bring both technical depth and practical project experience.',
    'Let me outline my proposed approach for your project.',
    'I have worked with similar tech stacks in production environments.',
    'Quality assurance is built into every step of my development process.',
    'I am confident I can exceed your expectations on this project.',
  ];

  const closing = 'Looking forward to discussing this opportunity with you. Best regards.';

  // Build proposal to target word count
  const parts: string[] = [greeting, experienceIntro];
  let wordCount = greeting.split(' ').length + experienceIntro.split(' ').length;

  let sentenceIndex = 0;
  while (wordCount < targetWords - closing.split(' ').length) {
    const sentence = sentencePool[sentenceIndex % sentencePool.length];
    parts.push(sentence);
    wordCount += sentence.split(' ').length;
    sentenceIndex++;
  }

  parts.push(closing);

  return parts.join(' ');
}
