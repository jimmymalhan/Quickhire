import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  formatSalary,
  formatNumber,
  formatPercentage,
  truncate,
} from '../formatters';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-01-15T10:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Just now');
  });

  it('returns minutes ago for recent times', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });

  it('returns formatted date for old dates', () => {
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(oldDate);
    expect(result).not.toContain('ago');
  });
});

describe('formatSalary', () => {
  it('formats salary range', () => {
    expect(formatSalary(80000, 120000)).toBe('$80k - $120k');
  });

  it('formats minimum salary only', () => {
    expect(formatSalary(100000, null)).toBe('From $100k');
  });

  it('formats maximum salary only', () => {
    expect(formatSalary(null, 150000)).toBe('Up to $150k');
  });

  it('returns "Not specified" when both are null', () => {
    expect(formatSalary(null, null)).toBe('Not specified');
  });

  it('handles small values', () => {
    expect(formatSalary(500, 900)).toBe('$500 - $900');
  });
});

describe('formatNumber', () => {
  it('formats millions', () => {
    expect(formatNumber(1500000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatNumber(2500)).toBe('2.5K');
  });

  it('returns small numbers as-is', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('formatPercentage', () => {
  it('formats with default decimals', () => {
    expect(formatPercentage(85.567)).toBe('85.6%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercentage(85.567, 2)).toBe('85.57%');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('Hi', 5)).toBe('Hi');
  });

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });
});
