import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  APPLICATION_STATUSES,
  STATUS_COLORS,
  SORT_OPTIONS,
  EXPERIENCE_LEVELS,
  PAGE_SIZES,
  NAV_ITEMS,
} from '../constants';

describe('constants', () => {
  describe('APP_NAME', () => {
    it('defaults to Quickhire', () => {
      expect(APP_NAME).toBe('Quickhire');
    });
  });

  describe('APPLICATION_STATUSES', () => {
    it('contains all expected statuses', () => {
      expect(APPLICATION_STATUSES).toContain('pending');
      expect(APPLICATION_STATUSES).toContain('submitted');
      expect(APPLICATION_STATUSES).toContain('viewed');
      expect(APPLICATION_STATUSES).toContain('rejected');
      expect(APPLICATION_STATUSES).toContain('archived');
    });

    it('has exactly 5 statuses', () => {
      expect(APPLICATION_STATUSES).toHaveLength(5);
    });
  });

  describe('STATUS_COLORS', () => {
    it('has a color for each status', () => {
      for (const status of APPLICATION_STATUSES) {
        expect(STATUS_COLORS[status]).toBeDefined();
      }
    });

    it('pending has yellow classes', () => {
      expect(STATUS_COLORS.pending).toContain('yellow');
    });

    it('submitted has blue classes', () => {
      expect(STATUS_COLORS.submitted).toContain('blue');
    });

    it('viewed has green classes', () => {
      expect(STATUS_COLORS.viewed).toContain('green');
    });

    it('rejected has red classes', () => {
      expect(STATUS_COLORS.rejected).toContain('red');
    });

    it('archived has gray classes', () => {
      expect(STATUS_COLORS.archived).toContain('gray');
    });

    it('includes dark mode variants', () => {
      for (const status of APPLICATION_STATUSES) {
        expect(STATUS_COLORS[status]).toContain('dark:');
      }
    });
  });

  describe('SORT_OPTIONS', () => {
    it('has newest, relevance, salary options', () => {
      const values = SORT_OPTIONS.map((o) => o.value);
      expect(values).toContain('newest');
      expect(values).toContain('relevance');
      expect(values).toContain('salary');
    });

    it('each option has value and label', () => {
      for (const option of SORT_OPTIONS) {
        expect(option.value).toBeDefined();
        expect(option.label).toBeDefined();
      }
    });

    it('has 3 options', () => {
      expect(SORT_OPTIONS).toHaveLength(3);
    });
  });

  describe('EXPERIENCE_LEVELS', () => {
    it('contains expected levels', () => {
      expect(EXPERIENCE_LEVELS).toContain('Entry Level');
      expect(EXPERIENCE_LEVELS).toContain('Senior');
      expect(EXPERIENCE_LEVELS).toContain('Lead');
      expect(EXPERIENCE_LEVELS).toContain('Director');
      expect(EXPERIENCE_LEVELS).toContain('Executive');
    });

    it('has 6 levels', () => {
      expect(EXPERIENCE_LEVELS).toHaveLength(6);
    });
  });

  describe('PAGE_SIZES', () => {
    it('contains expected sizes', () => {
      expect(PAGE_SIZES).toContain(10);
      expect(PAGE_SIZES).toContain(20);
      expect(PAGE_SIZES).toContain(50);
      expect(PAGE_SIZES).toContain(100);
    });

    it('is sorted ascending', () => {
      for (let i = 1; i < PAGE_SIZES.length; i++) {
        expect(PAGE_SIZES[i]).toBeGreaterThan(PAGE_SIZES[i - 1]);
      }
    });
  });

  describe('NAV_ITEMS', () => {
    it('has dashboard, applications, analytics, settings', () => {
      const labels = NAV_ITEMS.map((n) => n.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Applications');
      expect(labels).toContain('Analytics');
      expect(labels).toContain('Settings');
    });

    it('each item has path, label, and icon', () => {
      for (const item of NAV_ITEMS) {
        expect(item.path).toBeDefined();
        expect(item.label).toBeDefined();
        expect(item.icon).toBeDefined();
      }
    });

    it('dashboard path is /', () => {
      const dashboard = NAV_ITEMS.find((n) => n.label === 'Dashboard');
      expect(dashboard?.path).toBe('/');
    });

    it('has 4 nav items', () => {
      expect(NAV_ITEMS).toHaveLength(4);
    });
  });
});
