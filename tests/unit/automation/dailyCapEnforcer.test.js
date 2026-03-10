jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/config', () => ({
  application: { maxPerDay: 50 },
}));

const { DailyCapEnforcer } = require('../../../src/automation/dailyCapEnforcer');

describe('DailyCapEnforcer', () => {
  let enforcer;

  beforeEach(() => {
    enforcer = new DailyCapEnforcer({ defaultCap: 10 });
  });

  describe('constructor', () => {
    it('uses provided default cap', () => {
      expect(enforcer.defaultCap).toBe(10);
    });

    it('uses config default when no cap provided', () => {
      const e = new DailyCapEnforcer();
      expect(e.defaultCap).toBe(50);
    });

    it('starts with empty user caps', () => {
      expect(enforcer.userCaps.size).toBe(0);
    });
  });

  describe('setUserCap', () => {
    it('sets cap for new user', () => {
      enforcer.setUserCap('user-1', 20);
      const status = enforcer.getStatus('user-1');
      expect(status.cap).toBe(20);
    });

    it('updates cap for existing user', () => {
      enforcer.setUserCap('user-1', 20);
      enforcer.setUserCap('user-1', 30);
      const status = enforcer.getStatus('user-1');
      expect(status.cap).toBe(30);
    });

    it('throws for invalid cap', () => {
      expect(() => enforcer.setUserCap('user-1', -1)).toThrow('non-negative');
      expect(() => enforcer.setUserCap('user-1', 'abc')).toThrow('non-negative');
    });

    it('allows zero cap (disabled)', () => {
      enforcer.setUserCap('user-1', 0);
      const check = enforcer.canApply('user-1');
      expect(check.allowed).toBe(false);
    });
  });

  describe('canApply', () => {
    it('allows when under cap', () => {
      const result = enforcer.canApply('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('blocks when at cap', () => {
      for (let i = 0; i < 10; i++) {
        enforcer.recordApplication('user-1');
      }
      const result = enforcer.canApply('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('respects user daily limit override', () => {
      for (let i = 0; i < 5; i++) {
        enforcer.recordApplication('user-1', 5);
      }
      const result = enforcer.canApply('user-1', 5);
      expect(result.allowed).toBe(false);
    });

    it('returns correct count', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-1');
      const result = enforcer.canApply('user-1');
      expect(result.count).toBe(2);
      expect(result.remaining).toBe(8);
    });

    it('creates entry for new user', () => {
      enforcer.canApply('new-user');
      expect(enforcer.userCaps.has('new-user')).toBe(true);
    });
  });

  describe('recordApplication', () => {
    it('increments count', () => {
      const result = enforcer.recordApplication('user-1');
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(9);
    });

    it('returns correct remaining', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-1');
      const result = enforcer.recordApplication('user-1');
      expect(result.count).toBe(3);
      expect(result.remaining).toBe(7);
    });

    it('tracks per-user independently', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-2');
      enforcer.recordApplication('user-2');

      expect(enforcer.canApply('user-1').count).toBe(1);
      expect(enforcer.canApply('user-2').count).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('returns full status for user', () => {
      enforcer.recordApplication('user-1');
      const status = enforcer.getStatus('user-1');
      expect(status.userId).toBe('user-1');
      expect(status.count).toBe(1);
      expect(status.cap).toBe(10);
      expect(status.remaining).toBe(9);
      expect(status.percentUsed).toBe(10);
      expect(status.resetDate).toBeDefined();
    });

    it('calculates percent correctly', () => {
      for (let i = 0; i < 5; i++) {
        enforcer.recordApplication('user-1');
      }
      const status = enforcer.getStatus('user-1');
      expect(status.percentUsed).toBe(50);
    });

    it('handles zero cap', () => {
      enforcer.setUserCap('user-1', 0);
      const status = enforcer.getStatus('user-1');
      expect(status.percentUsed).toBe(0);
    });
  });

  describe('getAllStatus', () => {
    it('returns all user statuses', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-2');
      const all = enforcer.getAllStatus();
      expect(Object.keys(all)).toHaveLength(2);
      expect(all['user-1'].count).toBe(1);
      expect(all['user-2'].count).toBe(1);
    });

    it('returns empty object when no users', () => {
      expect(enforcer.getAllStatus()).toEqual({});
    });
  });

  describe('resetUser', () => {
    it('resets specific user count', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-1');
      enforcer.resetUser('user-1');
      expect(enforcer.canApply('user-1').count).toBe(0);
    });

    it('does not affect other users', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-2');
      enforcer.resetUser('user-1');
      expect(enforcer.canApply('user-2').count).toBe(1);
    });

    it('handles non-existent user', () => {
      expect(() => enforcer.resetUser('nonexistent')).not.toThrow();
    });
  });

  describe('resetAll', () => {
    it('clears all user data', () => {
      enforcer.recordApplication('user-1');
      enforcer.recordApplication('user-2');
      enforcer.resetAll();
      expect(enforcer.userCaps.size).toBe(0);
    });
  });

  describe('day rollover', () => {
    it('resets count on new day', () => {
      enforcer.recordApplication('user-1');
      const entry = enforcer.userCaps.get('user-1');
      // Simulate yesterday
      entry.resetDate = '2020-01-01';
      const result = enforcer.canApply('user-1');
      expect(result.count).toBe(0);
    });
  });
});
