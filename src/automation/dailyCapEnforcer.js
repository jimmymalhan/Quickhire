/**
 * Daily Cap Enforcer
 * Respects user-configured daily application limits
 * Tracks applications per user per day and enforces caps
 */
const logger = require('../utils/logger');
const config = require('../utils/config');

class DailyCapEnforcer {
  constructor(options = {}) {
    this.defaultCap = options.defaultCap || config.application.maxPerDay || 50;
    this.userCaps = new Map(); // userId -> { cap, count, resetDate }
  }

  /**
   * Set a user's daily cap
   * @param {string} userId
   * @param {number} cap - Max applications per day
   */
  setUserCap(userId, cap) {
    if (typeof cap !== 'number' || cap < 0) {
      throw new Error('Cap must be a non-negative number');
    }
    const existing = this.userCaps.get(userId);
    if (existing) {
      existing.cap = cap;
    } else {
      this.userCaps.set(userId, {
        cap,
        count: 0,
        resetDate: this._getTodayString(),
      });
    }
    logger.debug('User daily cap set', { userId, cap });
  }

  /**
   * Check if a user can submit another application today
   * @param {string} userId
   * @param {number} userDailyLimit - Optional override from user preferences
   * @returns {{ allowed: boolean, remaining: number, cap: number, count: number }}
   */
  canApply(userId, userDailyLimit) {
    const entry = this._getOrCreateEntry(userId, userDailyLimit);
    this._resetIfNewDay(entry);

    const cap = userDailyLimit || entry.cap;
    const remaining = Math.max(0, cap - entry.count);

    return {
      allowed: entry.count < cap,
      remaining,
      cap,
      count: entry.count,
    };
  }

  /**
   * Record an application for a user
   * @param {string} userId
   * @param {number} userDailyLimit - Optional override
   * @returns {{ count: number, remaining: number, cap: number }}
   */
  recordApplication(userId, userDailyLimit) {
    const entry = this._getOrCreateEntry(userId, userDailyLimit);
    this._resetIfNewDay(entry);

    entry.count++;
    const cap = userDailyLimit || entry.cap;

    logger.debug('Application recorded for daily cap', {
      userId,
      count: entry.count,
      cap,
      remaining: Math.max(0, cap - entry.count),
    });

    return {
      count: entry.count,
      remaining: Math.max(0, cap - entry.count),
      cap,
    };
  }

  /**
   * Get status for a user
   * @param {string} userId
   * @param {number} userDailyLimit
   */
  getStatus(userId, userDailyLimit) {
    const entry = this._getOrCreateEntry(userId, userDailyLimit);
    this._resetIfNewDay(entry);

    const cap = userDailyLimit || entry.cap;
    return {
      userId,
      count: entry.count,
      cap,
      remaining: Math.max(0, cap - entry.count),
      resetDate: entry.resetDate,
      percentUsed: cap > 0 ? (entry.count / cap) * 100 : 0,
    };
  }

  /**
   * Get status for all tracked users
   */
  getAllStatus() {
    const statuses = {};
    for (const [userId, entry] of this.userCaps.entries()) {
      this._resetIfNewDay(entry);
      statuses[userId] = {
        count: entry.count,
        cap: entry.cap,
        remaining: Math.max(0, entry.cap - entry.count),
      };
    }
    return statuses;
  }

  /**
   * Reset a specific user's daily count
   */
  resetUser(userId) {
    const entry = this.userCaps.get(userId);
    if (entry) {
      entry.count = 0;
      entry.resetDate = this._getTodayString();
    }
  }

  /**
   * Reset all users
   */
  resetAll() {
    this.userCaps.clear();
  }

  _getOrCreateEntry(userId, userDailyLimit) {
    if (!this.userCaps.has(userId)) {
      this.userCaps.set(userId, {
        cap: userDailyLimit || this.defaultCap,
        count: 0,
        resetDate: this._getTodayString(),
      });
    }
    return this.userCaps.get(userId);
  }

  _resetIfNewDay(entry) {
    const today = this._getTodayString();
    if (entry.resetDate !== today) {
      entry.count = 0;
      entry.resetDate = today;
    }
  }

  _getTodayString() {
    return new Date().toISOString().split('T')[0];
  }
}

module.exports = { DailyCapEnforcer };
