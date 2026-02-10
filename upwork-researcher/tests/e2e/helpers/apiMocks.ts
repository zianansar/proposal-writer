/**
 * API mocking utilities for E2E tests
 *
 * Provides deterministic Claude API responses for reliable testing:
 * - Consistent proposal text
 * - Predictable perplexity scores
 * - No API costs during test runs
 * - Faster test execution
 * - Offline test capability
 */

import { Page } from '@playwright/test';

/**
 * Mock types for different test scenarios
 */
export type MockScenario =
  | 'standard' // Normal proposal generation
  | 'high-perplexity' // Triggers safety warning (>150)
  | 'streaming' // Realistic streaming behavior
  | 'error'; // API error response

/**
 * Configure Claude API mocking for the page
 *
 * Intercepts requests to /v1/messages and returns mock responses
 */
export async function mockClaudeAPI(
  page: Page,
  scenario: MockScenario = 'standard'
): Promise<void> {
  await page.route('**/v1/messages', async (route) => {
    const request = route.request();

    // Log for debugging
    console.log(`[API Mock] Intercepted request: ${request.method()} ${request.url()}`);

    // Generate response based on scenario
    const response = generateMockResponse(scenario);

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: response,
    });
  });

  console.log(`[API Mock] Configured with scenario: ${scenario}`);
}

/**
 * Disable API mocking (restore real API calls)
 */
export async function disableMocking(page: Page): Promise<void> {
  await page.unroute('**/v1/messages');
  console.log('[API Mock] Mocking disabled');
}

/**
 * Generate mock response based on scenario
 */
function generateMockResponse(scenario: MockScenario): string {
  switch (scenario) {
    case 'standard':
      return createStreamingResponse(MOCK_PROPOSAL_STANDARD);

    case 'high-perplexity':
      return createStreamingResponse(MOCK_PROPOSAL_HIGH_PERPLEXITY);

    case 'streaming':
      return createStreamingResponse(MOCK_PROPOSAL_STANDARD, { chunkSize: 20 });

    case 'error':
      return createErrorResponse();

    default:
      return createStreamingResponse(MOCK_PROPOSAL_STANDARD);
  }
}

/**
 * Convert text to SSE streaming format
 */
function createStreamingResponse(
  text: string,
  options: { chunkSize?: number } = {}
): string {
  const { chunkSize = 50 } = options;

  // Split text into chunks
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  // Build SSE response
  const events = chunks.map((chunk) => {
    const event = {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: chunk,
      },
    };
    return `data: ${JSON.stringify(event)}\n\n`;
  });

  // Add completion event
  events.push('data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n');
  events.push('data: [DONE]\n\n');

  return events.join('');
}

/**
 * Create error response
 */
function createErrorResponse(): string {
  const error = {
    type: 'error',
    error: {
      type: 'rate_limit_error',
      message: 'Rate limit exceeded',
    },
  };

  return `data: ${JSON.stringify(error)}\n\n`;
}

/**
 * Mock proposal texts
 */

const MOCK_PROPOSAL_STANDARD = `Hi there,

I noticed your React dashboard project and it aligns perfectly with my recent work. I've spent the last 5 years building data-heavy interfaces for fintech and SaaS companies.

What caught my eye about your requirements:
• Real-time data visualization needs
• TypeScript requirement (my preferred stack)
• Emphasis on clean, maintainable code

I recently completed a similar project for a fintech client where I built a real-time trading dashboard handling 10k+ data points with D3 and React. The architecture used WebSocket connections for live updates and implemented proper memoization to keep renders under 60fps.

Technical approach I'd suggest:
1. Component architecture audit in week 1
2. Core visualization components (Chart.js or D3 based on complexity)
3. API integration with proper error boundaries
4. Comprehensive test coverage (Jest + React Testing Library)

Available 30+ hours/week starting immediately. Rate: $65/hr.

Would you be open to a brief call to discuss the data sources and visualization requirements in more detail?

Best,
Alex`;

const MOCK_PROPOSAL_HIGH_PERPLEXITY = `Dear Hiring Manager,

I am writing to express my strong interest in the React dashboard developer position you have posted. I believe I would be an excellent fit for this role.

I have extensive experience in React development and have successfully completed numerous projects involving data visualization and real-time updates. My skills include proficiency in TypeScript, REST API integration, and modern CSS frameworks.

I am confident that my technical expertise and professional approach would contribute significantly to the success of your project. I am highly motivated and committed to delivering exceptional results that exceed expectations.

I would welcome the opportunity to discuss how my qualifications align with your needs. Please feel free to contact me at your earliest convenience.

Thank you for considering my application. I look forward to hearing from you soon.

Sincerely,
Professional Developer`;

/**
 * Mock perplexity analysis responses
 */
export async function mockPerplexityAnalysis(
  page: Page,
  score: number
): Promise<void> {
  // Mock the rehumanize command that returns perplexity score
  await page.exposeFunction('mockPerplexityScore', () => score);

  console.log(`[API Mock] Perplexity analysis mocked with score: ${score}`);
}
