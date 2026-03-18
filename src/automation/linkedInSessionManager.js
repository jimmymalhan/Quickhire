/* eslint-disable no-undef */
/**
 * LinkedIn Session Manager
 * Manages LinkedIn login, session persistence, and re-authentication
 * Supports mock mode for development/testing (LINKEDIN_MOCK=true)
 *
 * SECURITY: Never logs LINKEDIN_EMAIL or LINKEDIN_PASSWORD
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login';
const LINKEDIN_FEED_URL = 'https://www.linkedin.com/feed/';
const SESSION_FILE = path.resolve(__dirname, '../../state/linkedin-session.json');

const MOCK_SESSION = {
  mock: true,
  cookies: [
    { name: 'li_at', value: 'mock_li_at_token', domain: '.linkedin.com', path: '/' },
    { name: 'JSESSIONID', value: 'mock_jsessionid', domain: '.linkedin.com', path: '/' },
  ],
  savedAt: new Date().toISOString(),
  userAgent: 'MockBrowser/1.0',
};

/**
 * LinkedIn Session Manager
 * Handles login, session persistence, session restoration, and expiry detection.
 */
class LinkedInSessionManager {
  constructor(options = {}) {
    this.mockMode =
      options.mockMode !== undefined
        ? options.mockMode
        : process.env.LINKEDIN_MOCK === 'true';
    this.sessionFile = options.sessionFile || SESSION_FILE;
    this._session = null;
  }

  /**
   * Login to LinkedIn using LINKEDIN_EMAIL and LINKEDIN_PASSWORD from env.
   * In mock mode, returns a mock session without touching the network.
   * @param {BrowserManager} browserManager
   * @returns {Object} session object
   */
  async login(browserManager) {
    if (this.mockMode) {
      logger.info('LinkedInSessionManager: mock login, skipping real auth');
      this._session = { ...MOCK_SESSION, savedAt: new Date().toISOString() };
      return this._session;
    }

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in environment for real login',
      );
    }

    logger.info('LinkedInSessionManager: starting real LinkedIn login');

    const page = browserManager.page;
    if (!page) {
      throw new Error('BrowserManager must be launched before calling login()');
    }

    try {
      await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await browserManager.humanDelay(800, 1500);

      // Fill email field — NEVER log credentials
      // TODO: verify selector — LinkedIn may use id="username" or name="session_key"
      await page.fill('#username', email).catch(() => page.type('#username', email));
      await browserManager.humanDelay(300, 700);

      // Fill password field — NEVER log credentials
      // TODO: verify selector — LinkedIn may use id="password" or name="session_password"
      await page.fill('#password', password).catch(() => page.type('#password', password));
      await browserManager.humanDelay(400, 900);

      // TODO: verify selector — submit button may be [type="submit"] or .login__form_action_container button
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
        page.click('[type="submit"]'),
      ]);

      const loggedIn = await this.isLoggedIn(page);
      if (!loggedIn) {
        throw new Error(
          'Login failed: LinkedIn did not redirect to feed after credential submission',
        );
      }

      await this.saveSession(page, browserManager);
      logger.info('LinkedInSessionManager: login successful, session saved');
      return this._session;
    } catch (err) {
      logger.error('LinkedInSessionManager: login failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Restore a saved session from disk into the browser context.
   * If no session file exists, falls back to login().
   * @param {BrowserManager} browserManager
   * @returns {Object} session object or null
   */
  async restoreSession(browserManager) {
    if (this.mockMode) {
      logger.info('LinkedInSessionManager: mock restoreSession');
      this._session = { ...MOCK_SESSION, savedAt: new Date().toISOString() };
      return this._session;
    }

    const saved = this.loadSession();
    if (!saved) {
      logger.info('LinkedInSessionManager: no saved session, attempting login');
      return this.login(browserManager);
    }

    const page = browserManager.page;
    if (!page) {
      throw new Error('BrowserManager must be launched before calling restoreSession()');
    }

    try {
      // Inject cookies into browser context
      // TODO: Playwright uses context.addCookies(); Puppeteer uses page.setCookie()
      if (typeof page.context === 'function') {
        // Playwright path
        await page.context().addCookies(saved.cookies);
      } else if (typeof page.setCookie === 'function') {
        // Puppeteer path
        await page.setCookie(...saved.cookies);
      } else {
        logger.warn('LinkedInSessionManager: cannot inject cookies — unknown page API');
      }

      // Verify session is still valid
      await page.goto(LINKEDIN_FEED_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const valid = await this.isLoggedIn(page);

      if (!valid) {
        logger.info('LinkedInSessionManager: saved session expired, re-authenticating');
        return this.login(browserManager);
      }

      this._session = saved;
      logger.info('LinkedInSessionManager: session restored from disk');
      return this._session;
    } catch (err) {
      logger.warn('LinkedInSessionManager: session restore failed, attempting login', {
        error: err.message,
      });
      return this.login(browserManager);
    }
  }

  /**
   * Check whether the current page is a logged-in LinkedIn session.
   * Detects redirect to login page as session expiry indicator.
   * @param {Object} page - Playwright/Puppeteer page object
   * @returns {boolean}
   */
  async isLoggedIn(page) {
    if (this.mockMode) {
      return true;
    }

    try {
      // TODO: verify — LinkedIn feed URL vs login redirect is reliable signal
      const url = page.url ? page.url() : await page.evaluate(() => window.location.href);
      if (typeof url === 'string' && url.includes('/login')) {
        return false;
      }

      // Secondary check: presence of global nav indicates logged-in state
      // TODO: verify selector — may be .global-nav or #global-nav
      const navPresent = await page
        .waitForSelector('#global-nav', { timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      return navPresent;
    } catch (err) {
      logger.warn('LinkedInSessionManager: isLoggedIn check failed', { error: err.message });
      return false;
    }
  }

  /**
   * Save the current browser session cookies to disk.
   * @param {Object} page - Playwright/Puppeteer page object
   * @param {BrowserManager} browserManager
   */
  async saveSession(page, browserManager) {
    if (this.mockMode) {
      logger.debug('LinkedInSessionManager: mock saveSession, no-op');
      return;
    }

    try {
      let cookies = [];

      // TODO: Playwright context vs Puppeteer page cookie extraction
      if (typeof page.context === 'function') {
        // Playwright path
        cookies = await page.context().cookies();
      } else if (typeof page.cookies === 'function') {
        // Puppeteer path
        cookies = await page.cookies();
      }

      const session = {
        cookies,
        savedAt: new Date().toISOString(),
        userAgent: browserManager ? browserManager.userAgent : 'unknown',
      };

      this._ensureStateDir();
      fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2), 'utf8');
      this._session = session;
      logger.info('LinkedInSessionManager: session saved to disk', { file: this.sessionFile });
    } catch (err) {
      logger.error('LinkedInSessionManager: failed to save session', { error: err.message });
      throw err;
    }
  }

  /**
   * Load a previously saved session from disk.
   * @returns {Object|null} session object or null if not found / invalid
   */
  loadSession() {
    try {
      if (!fs.existsSync(this.sessionFile)) {
        return null;
      }
      const raw = fs.readFileSync(this.sessionFile, 'utf8');
      const session = JSON.parse(raw);

      if (!session || !Array.isArray(session.cookies) || session.cookies.length === 0) {
        logger.warn('LinkedInSessionManager: session file invalid or empty');
        return null;
      }

      // Treat sessions older than 24 hours as stale (require re-auth)
      const ageMs = Date.now() - new Date(session.savedAt).getTime();
      const maxAgeMs = 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        logger.info('LinkedInSessionManager: session older than 24h, will re-authenticate');
        return null;
      }

      return session;
    } catch (err) {
      logger.warn('LinkedInSessionManager: could not load session file', { error: err.message });
      return null;
    }
  }

  /**
   * Ensure the state directory exists before writing session file.
   */
  _ensureStateDir() {
    const dir = path.dirname(this.sessionFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Clear the persisted session from disk.
   */
  clearSession() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
        logger.info('LinkedInSessionManager: session file cleared');
      }
    } catch (err) {
      logger.warn('LinkedInSessionManager: could not clear session file', { error: err.message });
    }
    this._session = null;
  }
}

module.exports = { LinkedInSessionManager, LINKEDIN_LOGIN_URL, LINKEDIN_FEED_URL };
