/**
 * Mock API Server for E2E Tests (C4 fix)
 *
 * Runs a local HTTP server that mimics the Anthropic Claude API.
 * The Tauri app connects to this server when ANTHROPIC_API_BASE_URL
 * environment variable is set, solving the limitation of page.route()
 * which only intercepts browser-level requests (not Rust-side HTTP calls).
 *
 * Usage:
 *   const url = await startMockApiServer('standard');
 *   // Launch Tauri app with: ANTHROPIC_API_BASE_URL=url
 *   await stopMockApiServer();
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';

let server: Server | null = null;
let currentScenario: MockScenario = 'standard';

export type MockScenario =
  | 'standard'
  | 'high-perplexity'
  | 'streaming'
  | 'error';

const MOCK_PORT = 18932;

/**
 * Get the mock API base URL for configuring the Tauri app
 */
export function getMockApiBaseUrl(): string {
  return `http://127.0.0.1:${MOCK_PORT}`;
}

/**
 * Start the mock API server
 * @returns The base URL to configure as ANTHROPIC_API_BASE_URL
 */
export async function startMockApiServer(scenario: MockScenario = 'standard'): Promise<string> {
  currentScenario = scenario;

  if (server) {
    console.log('[Mock API] Server already running, updating scenario');
    return getMockApiBaseUrl();
  }

  return new Promise((resolve, reject) => {
    server = createServer(handleRequest);
    server.listen(MOCK_PORT, '127.0.0.1', () => {
      const url = getMockApiBaseUrl();
      console.log(`[Mock API] Server started at ${url} (scenario: ${scenario})`);
      resolve(url);
    });
    server.on('error', reject);
  });
}

/**
 * Stop the mock API server
 */
export async function stopMockApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => {
      server = null;
      console.log('[Mock API] Server stopped');
      resolve();
    });
  });
}

/**
 * Change the active mock scenario without restarting
 */
export function setMockScenario(scenario: MockScenario): void {
  currentScenario = scenario;
  console.log(`[Mock API] Scenario changed to: ${scenario}`);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const url = req.url ?? '';
    console.log(`[Mock API] ${req.method} ${url}`);

    // CORS headers for any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /v1/messages — Claude API messages endpoint
    if (url.includes('/v1/messages') && req.method === 'POST') {
      handleMessagesEndpoint(res);
      return;
    }

    // Health check
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', scenario: currentScenario }));
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

function handleMessagesEndpoint(res: ServerResponse): void {
  if (currentScenario === 'error') {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'Rate limit exceeded' },
    }));
    return;
  }

  const text = currentScenario === 'high-perplexity'
    ? MOCK_PROPOSAL_HIGH_PERPLEXITY
    : MOCK_PROPOSAL_STANDARD;

  const chunkSize = currentScenario === 'streaming' ? 20 : 50;

  // Stream SSE response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  // Write chunks with small delays for realistic streaming
  let index = 0;
  const interval = setInterval(() => {
    if (index < chunks.length) {
      const event = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: chunks[index] },
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      index++;
    } else {
      res.write('data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      clearInterval(interval);
    }
  }, 10);
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
