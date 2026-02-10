// Memory measurement utilities for performance benchmarks

import { invoke } from '@tauri-apps/api/core';

export interface MemorySnapshot {
  rssBytes: number;
  heapUsedBytes: number;
  timestamp: number;
}

/**
 * Gets current memory usage from both Rust and JavaScript heaps
 * Requires 'get_memory_usage' Tauri command to be implemented
 */
export async function getMemoryUsage(): Promise<MemorySnapshot> {
  // Get Rust-side memory via Tauri command
  const rustMemory = await invoke<{ rss_bytes: number }>('get_memory_usage');

  // Get JS heap usage (if available in browser/webview)
  const jsMemory = (performance as any).memory?.usedJSHeapSize ?? 0;

  return {
    rssBytes: rustMemory.rss_bytes,
    heapUsedBytes: jsMemory,
    timestamp: Date.now(),
  };
}

/**
 * Converts bytes to megabytes
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

/**
 * Measures memory delta before and after executing a function
 * Forces GC if available for more accurate measurements
 */
export async function measureMemoryDelta(
  fn: () => Promise<void>
): Promise<{ before: MemorySnapshot; after: MemorySnapshot; deltaMB: number }> {
  // Force GC if available (requires --expose-gc flag in Node/V8)
  if (typeof (global as any).gc === 'function') (global as any).gc();

  const before = await getMemoryUsage();
  await fn();

  // Allow cleanup
  await new Promise(r => setTimeout(r, 100));
  if (typeof (global as any).gc === 'function') (global as any).gc();

  const after = await getMemoryUsage();

  return {
    before,
    after,
    deltaMB: bytesToMB(after.rssBytes - before.rssBytes),
  };
}
