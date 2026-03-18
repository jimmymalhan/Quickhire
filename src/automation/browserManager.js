/**
 * Browser Manager
 * Manages Puppeteer/Playwright browser instances for scraping
 * Supports both engines with automatic fallback
 */
const logger = require('../utils/logger');

const BROWSER_ENGINES = {
  MOCK: 'mock',
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
    this.fixtureHtml = options.fixtureHtml || '';
    this.browser = null;
    this.page = null;
    this._lib = null;
    this._mockState = null;
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
    if (this.engine === BROWSER_ENGINES.MOCK) {
      this._mockState = {
        html: this.fixtureHtml || '<html><head><title>Mock Browser</title></head><body></body></html>',
        url: 'about:blank',
        userAgent: this.userAgent,
        viewport: { width: 1920, height: 1080 },
        timeout: this.timeout,
      };

      this.page = this._createMockPage();
      this.browser = {
        close: async () => {
          this.browser = null;
          this.page = null;
          this._mockState = null;
        },
      };

      logger.info('Mock browser launched', { engine: this.engine, headless: this.headless });
      return this.page;
    }

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
      const previousHeight = await this.evaluate(() => globalThis.document.body.scrollHeight);

      await this.evaluate(() => globalThis.window.scrollTo(0, globalThis.document.body.scrollHeight));
      await this._delay(delayMs);

      const newHeight = await this.evaluate(() => globalThis.document.body.scrollHeight);
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
      this._mockState = null;
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

  _createMockPage() {
    const manager = this;

    return {
      setUserAgent: async (userAgent) => {
        manager._mockState.userAgent = userAgent;
      },
      setViewport: async (viewport) => {
        manager._mockState.viewport = viewport;
      },
      setDefaultTimeout: (timeout) => {
        manager._mockState.timeout = timeout;
      },
      goto: async (url) => {
        manager._mockState.url = url;
        return undefined;
      },
      waitForSelector: async (selector) => {
        if (!manager._selectorExists(selector)) {
          throw new Error(`Selector not found: ${selector}`);
        }
        return undefined;
      },
      content: async () => manager._mockState.html,
      evaluate: async (fn, ...args) => manager._evaluateInMockContext(fn, args),
    };
  }

  _selectorExists(selector) {
    const html = this._mockState?.html || '';
    if (!selector) {return false;}

    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    }

    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      return html.includes(`class="${className}`) || html.includes(`class='${className}`);
    }

    if (selector.startsWith('[') && selector.endsWith(']')) {
      return html.includes(selector.replace(/\s+/g, ''));
    }

    return html.includes(`<${selector}`) || html.includes(`</${selector}>`);
  }

  _evaluateInMockContext(fn, args) {
    const previousDocument = global.document;
    const previousWindow = global.window;
    const document = {
      title: this._extractTitle(),
      body: {
        scrollHeight: this._mockState?.html ? this._mockState.html.length : 0,
      },
      querySelector: (selector) => (
        this._selectorExists(selector)
          ? { selector }
          : null
      ),
    };
    const window = {
      scrollTo: () => undefined,
    };

    try {
      global.document = document;
      global.window = window;
      return fn(...args);
    } finally {
      global.document = previousDocument;
      global.window = previousWindow;
    }
  }

  _extractTitle() {
    const html = this._mockState?.html || '';
    const match = html.match(/<title>(.*?)<\/title>/i);
    return match ? match[1] : '';
  }
}

module.exports = BrowserManager;
module.exports.BROWSER_ENGINES = BROWSER_ENGINES;
