// Tests for timing measurement utilities

import { describe, it, expect, vi } from 'vitest';
import { measureTiming, assertTiming, TimingResult } from './timing';

describe('timing utilities', () => {
  describe('measureTiming', () => {
    it('measures execution time with multiple iterations', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);

      const result = await measureTiming(
        'Test Operation',
        mockFn,
        1000,
        3
      );

      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(result.name).toBe('Test Operation');
      expect(result.threshold).toBe(1000);
      expect(result.iterations).toHaveLength(3);
      expect(typeof result.durationMs).toBe('number');
    });

    it('uses median of iterations', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        const delays = [100, 50, 150]; // Median should be 100
        await new Promise(r => setTimeout(r, delays[callCount++]));
      });

      const result = await measureTiming('Median Test', mockFn, 500, 3);

      // Timing can vary on CI, use generous tolerance
      expect(result.durationMs).toBeGreaterThanOrEqual(90);
      expect(result.durationMs).toBeLessThanOrEqual(120);

      // Verify iterations array has 3 values
      expect(result.iterations).toHaveLength(3);

      // Verify median calculation - should be middle value when sorted
      const sorted = [...result.iterations].sort((a, b) => a - b);
      expect(result.durationMs).toBe(sorted[1]);
    });

    it('marks as passed when under threshold', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);

      const result = await measureTiming('Fast Operation', mockFn, 1000, 1);

      expect(result.passed).toBe(true);
      expect(result.durationMs).toBeLessThan(result.threshold);
    });

    it('marks as failed when over threshold', async () => {
      const mockFn = vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 150));
      });

      const result = await measureTiming('Slow Operation', mockFn, 100, 1);

      expect(result.passed).toBe(false);
      expect(result.durationMs).toBeGreaterThan(result.threshold);
    });
  });

  describe('assertTiming', () => {
    it('does not throw when timing passed', () => {
      const result: TimingResult = {
        name: 'Fast Op',
        durationMs: 50,
        threshold: 100,
        passed: true,
        iterations: [50],
      };

      expect(() => assertTiming(result)).not.toThrow();
    });

    it('throws detailed error when timing failed', () => {
      const result: TimingResult = {
        name: 'Slow Op',
        durationMs: 150,
        threshold: 100,
        passed: false,
        iterations: [150],
      };

      expect(() => assertTiming(result)).toThrow(
        /Performance threshold exceeded.*Slow Op.*150.*100/
      );
    });
  });
});
