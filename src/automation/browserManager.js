/**
 * Browser Manager
 * Manages Puppeteer/Playwright browser instances for scraping
 * Supports both engines with automatic fallback
 */
const logger = require('../utils/logger');

const BROWSER_ENGINES = {
  PUPPETEER: 'puppeteer',
  PLAYWRIGHT: 'playwright',
};

class BrowserManager {
  constructor(options = {}) {
    this.engine = options.engine || BROWSER_ENGINES.PUPPETEER;
    this.headless = options.headless !== false;
    this.userAgent =
      options.userAgent ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = options.timeout || 30000;
    this.browser = null;
    this.page = null;
    this._lib = null;
  }

  /**
   * Load the browser library dynamically
   */
  async _loadLibrary() {
    if (this._lib) {return this._lib;}

    if (this.engine === BROWSER_ENGINES.PLAYWRIGHT) {
      try {
        this._lib = require('playwright');
        return this._lib;
      } catch (err) {
        logger.warn('Playwright not available, falling back to Puppeteer');
        this.engine = BROWSER_ENGINES.PUPPETEER;
      }
    }

    try {
      this._lib = require('puppeteer');
      return this._lib;
    } catch (err) {
      throw new Error(
        'No browser automation library available. Install puppeteer or playwright.'
      );
    }
  }

  /**
   * Launch browser instance
   */
  async launch() {
    const lib = await this._loadLibrary();

    const launchOptions = {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    };

    if (this.engine === BROWSER_ENGINES.PLAYWRIGHT) {
      this.browser = await lib.chromium.launch(launchOptions);
      const context = await this.browser.newContext({
        userAgent: this.userAgent,
        viewport: { width: 1920, height: 1080 },
      });
      this.page = await context.newPage();
    } else {
      this.browser = await lib.launch(launchOptions);
      this.page = await this.browser.newPage();
      await this.page.setUserAgent(this.userAgent);
      await this.page.setViewport({ width: 1920, height: 1080 });
    }

    this.page.setDefaultTimeout(this.timeout);
    logger.info('Browser launched', { engine: this.engine, headless: this.headless });
    return this.page;
  }

  /**
   * Navigate to URL with retry logic
   */
  async navigate(url) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const waitUntil =
      this.engine === BROWSER_ENGINES.PLAYWRIGHT ? 'domcontentloaded' : 'domcontentloaded';

    await this.page.goto(url, {
      waitUntil,
      timeout: this.timeout,
    });

    logger.debug('Navigated to URL', { url });
    return this.page;
  }

  /**
   * Wait for a selector to appear
   */
  async waitForSelector(selector, timeout) {
    if (!this.page) {
      throw new Error('Browser not launched');
    }
    return this.page.waitForSelector(selector, { timeout: timeout || this.timeout });
  }

  /**
   * Get page content (HTML)
   */
  async getContent() {
    if (!this.page) {
      throw new Error('Browser not launched');
    }
    return this.page.content();
  }

  /**
   * Evaluate JavaScript in the page context
   */
  async evaluate(fn, ...args) {
    if (!this.page) {throw new Error('Browser not launched');}
    return this.page.evaluate(fn, ...args);
  }

  /**
   * Scroll down to trigger lazy loading
   */
  async scrollToBottom(maxScrolls = 10, delayMs = 1000) {
    if (!this.page) {throw new Error('Browser not launched');}

    for (let i = 0; i < maxScrolls; i++) {
      const previousHeight = await this.evaluate(() => document.body.scrollHeight);

      await this.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this._delay(delayMs);

      const newHeight = await this.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        break;
      }
    }
  }

  /**
   * Add a random delay to mimic human behavior
   */
  async humanDelay(minMs = 500, maxMs = 2000) {
    const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
    await this._delay(delay);
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.debug('Browser closed');
    }
  }

  /**
   * Check if browser is running
   */
  isRunning() {
    return this.browser !== null;
  }

  async _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = BrowserManager;
module.exports.BROWSER_ENGINES = BROWSER_ENGINES;
