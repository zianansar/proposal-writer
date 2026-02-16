/**
 * API mocking utilities for E2E tests (C4 fix)
 *
 * Two-layer mocking strategy:
 *
 * 1. **Rust-side (primary)**: mockApiServer.ts runs a local HTTP server.
 *    The Tauri app connects to it via ANTHROPIC_API_BASE_URL env var.
 *    This intercepts actual API calls from the Rust backend.
 *
 * 2. **Browser-side (supplementary)**: page.route() intercepts any
 *    browser-originated requests (e.g., perplexity analysis if done client-side).
 *
 * For most tests, use startMockApiServer() from mockApiServer.ts (started
 * automatically by launchTauriApp when useMockApi=true). Use the browser-side
 * mocks below only for browser-originated requests or UI-specific overrides.
 */

import { Page } from "@playwright/test";

// Re-export server-side mock controls for convenience
export { startMockApiServer, stopMockApiServer, setMockScenario } from "./mockApiServer";
export type { MockScenario } from "./mockApiServer";

/**
 * Configure browser-side request interception for supplementary mocking
 *
 * Note: This only intercepts requests originating from the browser/WebView.
 * Claude API calls from the Rust backend are NOT intercepted here —
 * use mockApiServer.ts for those (see C4 fix documentation above).
 */
export async function mockBrowserRequests(
  page: Page,
  scenario: "standard" | "high-perplexity" | "error" = "standard",
): Promise<void> {
  // Intercept any browser-originated API calls (e.g., client-side validation)
  await page.route("**/v1/messages", async (route) => {
    console.log(`[Browser Mock] Intercepted: ${route.request().method()} ${route.request().url()}`);

    if (scenario === "error") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          type: "error",
          error: { type: "rate_limit_error", message: "Rate limit exceeded" },
        }),
      });
      return;
    }

    const text =
      scenario === "high-perplexity" ? MOCK_PROPOSAL_HIGH_PERPLEXITY : MOCK_PROPOSAL_STANDARD;

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: createStreamingResponse(text),
    });
  });

  console.log(`[Browser Mock] Configured with scenario: ${scenario}`);
}

/**
 * Disable browser-side mocking
 */
export async function disableBrowserMocking(page: Page): Promise<void> {
  await page.unroute("**/v1/messages");
  console.log("[Browser Mock] Disabled");
}

/**
 * Legacy compatibility wrapper — calls both server-side scenario change
 * and browser-side mock setup
 */
export async function mockClaudeAPI(
  page: Page,
  scenario: "standard" | "high-perplexity" | "streaming" | "error" = "standard",
): Promise<void> {
  const { setMockScenario } = await import("./mockApiServer");
  setMockScenario(scenario);
  await mockBrowserRequests(page, scenario === "streaming" ? "standard" : scenario);
}

/**
 * Mock perplexity analysis (browser-side function injection)
 */
export async function mockPerplexityAnalysis(page: Page, score: number): Promise<void> {
  await page.exposeFunction("mockPerplexityScore", () => score);
  console.log(`[Browser Mock] Perplexity analysis mocked with score: ${score}`);
}

function createStreamingResponse(text: string): string {
  const chunkSize = 50;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  const events = chunks.map((chunk) => {
    const event = {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: chunk },
    };
    return `data: ${JSON.stringify(event)}\n\n`;
  });

  events.push('data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n');
  events.push("data: [DONE]\n\n");

  return events.join("");
}

const MOCK_PROPOSAL_STANDARD = `Hi there,

I noticed your React dashboard project and it aligns perfectly with my recent work. I've spent the last 5 years building data-heavy interfaces for fintech and SaaS companies.

What caught my eye about your requirements:
- Real-time data visualization needs
- TypeScript requirement (my preferred stack)
- Emphasis on clean, maintainable code

I recently completed a similar project for a fintech client where I built a real-time trading dashboard handling 10k+ data points with D3 and React.

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
