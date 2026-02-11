/**
 * Tauri E2E Test Driver (C5/C6/M4 fixes)
 *
 * Manages Tauri app lifecycle for E2E tests using tauri-driver:
 * 1. Launches `tauri-driver` which wraps the app binary and exposes WebDriver protocol
 * 2. Playwright connects to the WebView via the WebDriver endpoint
 * 3. Proper readiness check via WebDriver /status endpoint (replaces time-based heuristic)
 * 4. Clean shutdown with exit listener attached before kill signal (fixes race condition)
 *
 * For CI: Uses built binary via `tauri-driver`
 * For local dev: Uses `cargo tauri dev` with WebDriver enabled
 */

import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import { getDirname } from './esm-utils';
import { getMockApiBaseUrl } from './mockApiServer';

const __dirname = getDirname(import.meta.url);

let tauriDriverProcess: ChildProcess | null = null;
let tauriAppProcess: ChildProcess | null = null;

/** Port for tauri-driver WebDriver endpoint */
const WEBDRIVER_PORT = 4444;

interface LaunchOptions {
  /** Use built binary instead of dev server */
  useBuild?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Timeout in ms for app readiness (default: 30000) */
  timeout?: number;
  /** Use mock API server for deterministic responses */
  useMockApi?: boolean;
}

/**
 * Launch Tauri app and wait for it to be ready
 */
export async function launchTauriApp(options: LaunchOptions = {}): Promise<void> {
  const {
    useBuild = process.env.CI === 'true',
    env = {},
    timeout = 30_000,
    useMockApi = true,
  } = options;

  if (tauriDriverProcess || tauriAppProcess) {
    console.warn('Tauri app already running. Skipping launch.');
    return;
  }

  const projectRoot = resolve(__dirname, '../../../');

  // Build environment with mock API URL if enabled
  const appEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...env,
    TAURI_ENV_DEBUG: 'true',
  };

  if (useMockApi) {
    appEnv.ANTHROPIC_API_BASE_URL = getMockApiBaseUrl();
  }

  if (useBuild) {
    // Launch via tauri-driver (WebDriver protocol wrapper)
    console.log('Launching Tauri app via tauri-driver...');

    const binaryPath = getBinaryPath();
    tauriDriverProcess = spawn('tauri-driver', [], {
      cwd: projectRoot,
      env: {
        ...appEnv,
        TAURI_WEBDRIVER_BINARY: binaryPath,
      },
      stdio: 'pipe',
    });

    attachProcessLogging(tauriDriverProcess, 'tauri-driver');
  } else {
    // Launch app in dev mode
    console.log('Launching Tauri app in dev mode...');

    tauriAppProcess = spawn('npm', ['run', 'tauri', 'dev'], {
      cwd: projectRoot,
      env: { ...appEnv, BROWSER: 'none' },
      stdio: 'pipe',
      shell: true,
    });

    attachProcessLogging(tauriAppProcess, 'tauri-dev');
  }

  // C6: Proper readiness check via WebDriver /status endpoint or stdout signals
  await waitForAppReady(timeout);
  console.log('Tauri app is ready for testing');
}

/**
 * Close the Tauri app cleanly (M4: listener attached before kill signal)
 */
export async function closeTauriApp(): Promise<void> {
  const processToClose = tauriDriverProcess || tauriAppProcess;
  if (!processToClose) {
    return;
  }

  console.log('Closing Tauri app...');

  return new Promise<void>((resolvePromise) => {
    // M4 FIX: Attach exit listener BEFORE sending kill signal
    processToClose.on('exit', () => {
      tauriDriverProcess = null;
      tauriAppProcess = null;
      console.log('Tauri app closed');
      resolvePromise();
    });

    // Send graceful shutdown signal
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', processToClose.pid!.toString(), '/f', '/t']);
    } else {
      processToClose.kill('SIGTERM');
    }

    // Force kill after 5s if graceful shutdown fails
    setTimeout(() => {
      if (processToClose && !processToClose.killed) {
        console.warn('Force killing Tauri app after timeout');
        processToClose.kill('SIGKILL');
        tauriDriverProcess = null;
        tauriAppProcess = null;
        resolvePromise();
      }
    }, 5000);
  });
}

/**
 * C6: Wait for Tauri app to be responsive
 *
 * Uses WebDriver /status endpoint for tauri-driver mode,
 * or stdout signal detection for dev mode.
 * Replaces the previous 3s-alive + 1s-sleep heuristic.
 */
async function waitForAppReady(timeout: number): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  // If using tauri-driver, poll WebDriver /status endpoint
  if (tauriDriverProcess) {
    while (Date.now() - startTime < timeout) {
      if (!tauriDriverProcess || tauriDriverProcess.killed) {
        throw new Error('tauri-driver process terminated unexpectedly');
      }
      try {
        const response = await fetch(`http://localhost:${WEBDRIVER_PORT}/status`);
        if (response.ok) {
          const data = await response.json();
          if (data.value?.ready !== false) {
            return;
          }
        }
      } catch {
        // Server not ready yet, continue polling
      }
      await sleep(pollInterval);
    }
    throw new Error(`Tauri app failed to respond at WebDriver port within ${timeout}ms`);
  }

  // Dev mode: wait for stdout signal indicating app is ready
  if (tauriAppProcess) {
    return new Promise<void>((resolvePromise, reject) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Tauri dev server failed to start within ${timeout}ms`));
        }
      }, timeout);

      const onData = (data: Buffer) => {
        const output = data.toString();
        // Tauri dev mode emits these messages when the window is ready
        if (
          output.includes('Running on') ||
          output.includes('Watching') ||
          output.includes('Window created') ||
          output.includes('localhost')
        ) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            // Brief settle for WebView initialization
            setTimeout(resolvePromise, 500);
          }
        }
      };

      tauriAppProcess!.stdout?.on('data', onData);
      tauriAppProcess!.stderr?.on('data', onData);

      tauriAppProcess!.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(new Error(`Tauri process exited unexpectedly with code ${code}`));
        }
      });
    });
  }

  throw new Error('No Tauri process launched');
}

/**
 * Get the WebDriver endpoint URL for Playwright connection
 */
export function getWebDriverUrl(): string {
  return `http://localhost:${WEBDRIVER_PORT}`;
}

/**
 * Get path to built Tauri binary based on platform
 */
function getBinaryPath(): string {
  const platform = process.platform;
  const projectRoot = resolve(__dirname, '../../../');

  if (platform === 'darwin') {
    return resolve(
      projectRoot,
      'src-tauri/target/release/bundle/macos/Upwork Research Agent.app/Contents/MacOS/upwork-research-agent'
    );
  } else if (platform === 'win32') {
    return resolve(projectRoot, 'src-tauri/target/release/upwork-research-agent.exe');
  } else {
    return resolve(projectRoot, 'src-tauri/target/release/upwork-research-agent');
  }
}

/**
 * Check if app is currently running
 */
export function isAppRunning(): boolean {
  const proc = tauriDriverProcess || tauriAppProcess;
  return proc !== null && !proc.killed;
}

/**
 * Attach stdout/stderr logging to a child process
 */
function attachProcessLogging(proc: ChildProcess, label: string): void {
  proc.stdout?.on('data', (data: Buffer) => {
    console.log(`[${label} stdout]: ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    console.error(`[${label} stderr]: ${data.toString().trim()}`);
  });

  proc.on('error', (err) => {
    console.error(`[${label}] Process error:`, err);
  });

  proc.on('exit', (code, signal) => {
    console.log(`[${label}] Process exited with code ${code}, signal ${signal}`);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
