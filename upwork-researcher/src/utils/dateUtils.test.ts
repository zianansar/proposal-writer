// src/utils/dateUtils.test.ts
// Tests for date formatting utilities (Story 6.3)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime } from './dateUtils';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Mock current time to 2024-01-01 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for less than 1 minute ago', () => {
    const timestamp = new Date('2024-01-01T11:59:30Z').toISOString();
    expect(formatRelativeTime(timestamp)).toBe('Just now');
  });

  it('returns "X minutes ago" for 1-59 minutes', () => {
    const timestamp1 = new Date('2024-01-01T11:59:00Z').toISOString();
    expect(formatRelativeTime(timestamp1)).toBe('1 minute ago');

    const timestamp5 = new Date('2024-01-01T11:55:00Z').toISOString();
    expect(formatRelativeTime(timestamp5)).toBe('5 minutes ago');

    const timestamp30 = new Date('2024-01-01T11:30:00Z').toISOString();
    expect(formatRelativeTime(timestamp30)).toBe('30 minutes ago');
  });

  it('returns "X hours ago" for 1-23 hours', () => {
    const timestamp1 = new Date('2024-01-01T11:00:00Z').toISOString();
    expect(formatRelativeTime(timestamp1)).toBe('1 hour ago');

    const timestamp5 = new Date('2024-01-01T07:00:00Z').toISOString();
    expect(formatRelativeTime(timestamp5)).toBe('5 hours ago');

    const timestamp23 = new Date('2023-12-31T13:00:00Z').toISOString();
    expect(formatRelativeTime(timestamp23)).toBe('23 hours ago');
  });

  it('returns "Yesterday at X:XX" for 24-48 hours', () => {
    const timestamp = new Date('2023-12-31T11:45:00Z').toISOString();
    const result = formatRelativeTime(timestamp);
    expect(result).toMatch(/^Yesterday at \d{1,2}:\d{2}/);
  });

  it('returns "X days ago" for 2-6 days', () => {
    const timestamp2 = new Date('2023-12-30T12:00:00Z').toISOString();
    expect(formatRelativeTime(timestamp2)).toBe('2 days ago');

    const timestamp5 = new Date('2023-12-27T12:00:00Z').toISOString();
    expect(formatRelativeTime(timestamp5)).toBe('5 days ago');
  });

  it('returns full date for 7+ days ago', () => {
    const timestamp = new Date('2023-12-20T12:00:00Z').toISOString();
    const result = formatRelativeTime(timestamp);
    // Accept either "Dec 20, 2023" (US) or "20 Dec 2023" (UK)
    expect(result).toMatch(/(Dec \d{1,2}, \d{4}|\d{1,2} Dec \d{4})/);
  });

  it('handles timestamps in the future gracefully', () => {
    const futureTimestamp = new Date('2024-01-02T12:00:00Z').toISOString();
    // M3 fix: Future timestamps should return a formatted date
    const result = formatRelativeTime(futureTimestamp);
    // Should return a date string, not "Just now" or negative time
    expect(result).toMatch(/(Jan \d{1,2}, \d{4}|\d{1,2} Jan \d{4})/);
  });
});
