/**
 * Daily Cap Enforcer
 * Respects user-configured daily application limits
 * Tracks applications per user per day and enforces caps
 * Supports timezone-aware midnight resets and cap-approaching warnings
 */
const logger = require('../utils/logger');
const config = require('../utils/config');

const DEFAULT_CAP = 25;
const WARNING_THRESHOLD = 0.8; // Warn at 80% usage

class DailyCapEnforcer {
  constructor(options = {}) {
    this.defaultCap = options.defaultCap || config.application.maxPerDay || DEFAULT_CAP;
    this.warningThreshold = options.warningThreshold || WARNING_THRESHOLD;
    this.userCaps = new Map(); // userId -> { cap, count, resetDate, timezone }
  }

  /**
   * Set a user's daily cap
   * @param {string} userId
   * @param {number} cap - Max applications per day
   * @param {string} timezone - IANA timezone string (e.g. 'America/New_York')
   */
  setUserCap(userId, cap, timezone) {
    if (typeof cap !== 'number' || cap < 0) {
      throw new Error('Cap must be a non-negative number');
    }
    const existing = this.userCaps.get(userId);
    if (existing) {
      existing.cap = cap;
      if (timezone) {
        existing.timezone = timezone;
      }
    } else {
      this.userCaps.set(userId, {
        cap,
        count: 0,
        resetDate: this._getTodayString(timezone),
        timezone: timezone || null,
      });
    }
    logger.debug('User daily cap set', { userId, cap, timezone });
  }

  /**
   * Check if a user can submit another application today
   * @param {string} userId
   * @param {number} userDailyLimit - Optional override from user preferences
   * @returns {{ allowed: boolean, remaining: number, cap: number, count: number, warning: boolean, warningMessage: string|null }}
   */
  canApply(userId, userDailyLimit) {
    const entry = this._getOrCreateEntry(userId, userDailyLimit);
    this._resetIfNewDay(entry);

    const cap = userDailyLimit || entry.cap;
    const remaining = Math.max(0, cap - entry.count);
    const percentUsed = cap > 0 ? entry.count / cap : 0;
    const approaching = percentUsed >= this.warningThreshold && entry.count < cap;

    const result = {
      allowed: entry.count < cap,
      remaining,
      cap,
      count: entry.count,
      warning: approaching,
      warningMessage: null,
    };

    if (approaching) {
      result.warningMessage = `Approaching daily cap: ${entry.count}/${cap} applications used (${Math.round(percentUsed * 100)}%)`;
      logger.warn('User approaching daily cap', {
        userId,
        count: entry.count,
        cap,
        percentUsed: Math.round(percentUsed * 100),
      });
    }

    return result;
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
    const percentUsed = cap > 0 ? (entry.count / cap) * 100 : 0;
    return {
      userId,
      count: entry.count,
      cap,
      remaining: Math.max(0, cap - entry.count),
      resetDate: entry.resetDate,
      percentUsed,
      approaching: percentUsed >= this.warningThreshold * 100,
      timezone: entry.timezone || null,
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
        timezone: null,
      });
    }
    return this.userCaps.get(userId);
  }

  _resetIfNewDay(entry) {
    const today = this._getTodayString(entry.timezone);
    if (entry.resetDate !== today) {
      entry.count = 0;
      entry.resetDate = today;
    }
  }

  /**
   * Get today's date string, optionally in a specific timezone
   * @param {string} timezone - IANA timezone (e.g. 'America/New_York')
   * @returns {string} Date string in YYYY-MM-DD format
   */
  _getTodayString(timezone) {
    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return formatter.format(new Date());
      } catch (_err) {
        // Fall back to UTC if timezone is invalid
      }
    }
    return new Date().toISOString().split('T')[0];
  }
}

module.exports = { DailyCapEnforcer, DEFAULT_CAP, WARNING_THRESHOLD };
