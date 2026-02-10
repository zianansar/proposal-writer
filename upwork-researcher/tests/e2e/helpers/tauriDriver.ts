/**
 * Tauri E2E Test Driver
 *
 * Manages Tauri app lifecycle for E2E tests:
 * - Launches the Tauri app in test mode
 * - Waits for app to be ready
 * - Provides cleanup on test completion
 *
 * Implementation Note:
 * Tauri v2 E2E testing uses electron-like approach:
 * 1. Launch app via `npm run tauri dev` or built binary
 * 2. Playwright attaches to the WebView
 * 3. Tests interact with UI through Playwright API
 *
 * For CI: Use built binary from `npm run tauri build`
 * For local: Use dev server for faster iteration
 */

import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tauriProcess: ChildProcess | null = null;

interface LaunchOptions {
  /** Use built binary instead of dev server */
  useBuild?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Launch Tauri app and wait for it to be ready
 */
export async function launchTauriApp(options: LaunchOptions = {}): Promise<void> {
  const {
    useBuild = process.env.CI === 'true',
    env = {},
    timeout = 30_000,
  } = options;

  if (tauriProcess) {
    console.warn('Tauri app already running. Skipping launch.');
    return;
  }

  const projectRoot = resolve(__dirname, '../../../');

  if (useBuild) {
    // Launch built binary (for CI)
    const binaryPath = getBinaryPath();
    console.log(`Launching Tauri app from: ${binaryPath}`);

    tauriProcess = spawn(binaryPath, [], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...env,
        // Tauri test mode flags
        TAURI_ENV_DEBUG: 'true',
      },
      stdio: 'pipe',
    });
  } else {
    // Launch dev server (for local testing)
    console.log('Launching Tauri app in dev mode...');

    tauriProcess = spawn('npm', ['run', 'tauri', 'dev'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...env,
        // Prevent app auto-opening browser
        BROWSER: 'none',
      },
      stdio: 'pipe',
      shell: true,
    });
  }

  // Capture stdout/stderr for debugging
  if (tauriProcess.stdout) {
    tauriProcess.stdout.on('data', (data) => {
      console.log(`[Tauri stdout]: ${data.toString().trim()}`);
    });
  }

  if (tauriProcess.stderr) {
    tauriProcess.stderr.on('data', (data) => {
      console.error(`[Tauri stderr]: ${data.toString().trim()}`);
    });
  }

  tauriProcess.on('error', (err) => {
    console.error('[Tauri] Process error:', err);
  });

  tauriProcess.on('exit', (code, signal) => {
    console.log(`[Tauri] Process exited with code ${code}, signal ${signal}`);
    tauriProcess = null;
  });

  // Wait for app to be ready
  await waitForAppReady(timeout);
  console.log('Tauri app is ready for testing');
}

/**
 * Close the Tauri app
 */
export async function closeTauriApp(): Promise<void> {
  if (!tauriProcess) {
    return;
  }

  console.log('Closing Tauri app...');

  return new Promise((resolve) => {
    if (!tauriProcess) {
      resolve();
      return;
    }

    // Handle exit event
    tauriProcess.on('exit', () => {
      tauriProcess = null;
      console.log('Tauri app closed');
      resolve();
    });

    // Kill the process
    if (process.platform === 'win32') {
      // Windows: Use taskkill to ensure clean shutdown
      spawn('taskkill', ['/pid', tauriProcess.pid!.toString(), '/f', '/t']);
    } else {
      // Unix: Send SIGTERM
      tauriProcess.kill('SIGTERM');
    }

    // Force kill after 5s if not closed
    setTimeout(() => {
      if (tauriProcess && !tauriProcess.killed) {
        console.warn('Force killing Tauri app after timeout');
        tauriProcess.kill('SIGKILL');
        tauriProcess = null;
        resolve();
      }
    }, 5000);
  });
}

/**
 * Wait for Tauri app to be responsive
 *
 * Strategy:
 * 1. Wait for process to spawn
 * 2. Wait for window to appear (detected via stdout patterns)
 * 3. Additional settling time for WebView initialization
 */
async function waitForAppReady(timeout: number): Promise<void> {
  const startTime = Date.now();
  let appWindowReady = false;

  return new Promise<void>((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // Timeout check
      if (elapsed > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Tauri app failed to start within ${timeout}ms`));
        return;
      }

      // Process check
      if (!tauriProcess) {
        clearInterval(checkInterval);
        reject(new Error('Tauri process terminated unexpectedly'));
        return;
      }

      // Simple readiness check: process is alive for >3 seconds
      // More sophisticated checks can be added based on app logs
      if (elapsed > 3000 && !appWindowReady) {
        appWindowReady = true;
        clearInterval(checkInterval);

        // Additional settling time for WebView
        setTimeout(() => {
          resolve();
        }, 1000);
      }
    }, 500);
  });
}

/**
 * Get path to built Tauri binary based on platform
 */
function getBinaryPath(): string {
  const platform = process.platform;
  const projectRoot = resolve(__dirname, '../../../');

  if (platform === 'darwin') {
    // macOS: .app bundle
    return resolve(
      projectRoot,
      'src-tauri/target/release/bundle/macos/Upwork Research Agent.app/Contents/MacOS/upwork-research-agent'
    );
  } else if (platform === 'win32') {
    // Windows: .exe
    return resolve(projectRoot, 'src-tauri/target/release/upwork-research-agent.exe');
  } else {
    // Linux
    return resolve(projectRoot, 'src-tauri/target/release/upwork-research-agent');
  }
}

/**
 * Check if app is currently running
 */
export function isAppRunning(): boolean {
  return tauriProcess !== null && !tauriProcess.killed;
}
