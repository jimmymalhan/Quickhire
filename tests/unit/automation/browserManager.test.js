const BrowserManager = require('../../../src/automation/browserManager');
const { BROWSER_ENGINES } = require('../../../src/automation/browserManager');

// Mock puppeteer and playwright
jest.mock('puppeteer', () => {
  const mockPage = {
    setUserAgent: jest.fn().mockResolvedValue(undefined),
    setViewport: jest.fn().mockResolvedValue(undefined),
    setDefaultTimeout: jest.fn(),
    goto: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html></html>'),
    evaluate: jest.fn().mockResolvedValue(null),
  };
  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    launch: jest.fn().mockResolvedValue(mockBrowser),
    __mockPage: mockPage,
    __mockBrowser: mockBrowser,
  };
}, { virtual: true });

jest.mock('playwright', () => {
  const mockPage = {
    setDefaultTimeout: jest.fn(),
    goto: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    content: jest.fn().mockResolvedValue('<html></html>'),
    evaluate: jest.fn().mockResolvedValue(null),
  };
  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
  };
  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
    __mockPage: mockPage,
    __mockBrowser: mockBrowser,
  };
}, { virtual: true });

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('BrowserManager', () => {
  let manager;

  afterEach(async () => {
    if (manager && manager.isRunning()) {
      await manager.close();
    }
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      manager = new BrowserManager();
      expect(manager.engine).toBe(BROWSER_ENGINES.PUPPETEER);
      expect(manager.headless).toBe(true);
      expect(manager.timeout).toBe(30000);
      expect(manager.browser).toBeNull();
      expect(manager.page).toBeNull();
    });

    it('should accept custom options', () => {
      manager = new BrowserManager({
        engine: 'playwright',
        headless: false,
        timeout: 60000,
        userAgent: 'CustomAgent',
      });
      expect(manager.engine).toBe('playwright');
      expect(manager.headless).toBe(false);
      expect(manager.timeout).toBe(60000);
      expect(manager.userAgent).toBe('CustomAgent');
    });
  });

  describe('launch with Puppeteer', () => {
    beforeEach(() => {
      manager = new BrowserManager({ engine: 'puppeteer' });
    });

    it('should launch browser and create page', async () => {
      const page = await manager.launch();
      expect(page).toBeTruthy();
      expect(manager.browser).toBeTruthy();
      expect(manager.page).toBeTruthy();
      expect(manager.isRunning()).toBe(true);
    });

    it('should set user agent', async () => {
      await manager.launch();
      expect(manager.page.setUserAgent).toHaveBeenCalledWith(manager.userAgent);
    });

    it('should set viewport', async () => {
      await manager.launch();
      expect(manager.page.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
      });
    });

    it('should set default timeout', async () => {
      await manager.launch();
      expect(manager.page.setDefaultTimeout).toHaveBeenCalledWith(30000);
    });
  });

  describe('launch with Playwright', () => {
    beforeEach(() => {
      manager = new BrowserManager({ engine: 'playwright' });
    });

    it('should launch browser with playwright', async () => {
      const page = await manager.launch();
      expect(page).toBeTruthy();
      expect(manager.isRunning()).toBe(true);
    });
  });

  describe('navigate', () => {
    beforeEach(async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
    });

    it('should navigate to URL', async () => {
      await manager.navigate('https://example.com');
      expect(manager.page.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });

    it('should throw if browser not launched', async () => {
      const newManager = new BrowserManager();
      await expect(newManager.navigate('https://example.com')).rejects.toThrow(
        'Browser not launched'
      );
    });
  });

  describe('waitForSelector', () => {
    beforeEach(async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
    });

    it('should wait for selector', async () => {
      await manager.waitForSelector('.test-class');
      expect(manager.page.waitForSelector).toHaveBeenCalledWith('.test-class', {
        timeout: 30000,
      });
    });

    it('should use custom timeout', async () => {
      await manager.waitForSelector('.test', 5000);
      expect(manager.page.waitForSelector).toHaveBeenCalledWith('.test', {
        timeout: 5000,
      });
    });

    it('should throw if browser not launched', async () => {
      const newManager = new BrowserManager();
      await expect(newManager.waitForSelector('.test')).rejects.toThrow(
        'Browser not launched'
      );
    });
  });

  describe('getContent', () => {
    beforeEach(async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
    });

    it('should return page content', async () => {
      const content = await manager.getContent();
      expect(content).toBe('<html></html>');
    });

    it('should throw if browser not launched', async () => {
      const newManager = new BrowserManager();
      await expect(newManager.getContent()).rejects.toThrow('Browser not launched');
    });
  });

  describe('evaluate', () => {
    beforeEach(async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
    });

    it('should evaluate function in page context', async () => {
      const fn = () => document.title;
      await manager.evaluate(fn);
      expect(manager.page.evaluate).toHaveBeenCalledWith(fn);
    });

    it('should throw if browser not launched', async () => {
      const newManager = new BrowserManager();
      await expect(newManager.evaluate(() => {})).rejects.toThrow('Browser not launched');
    });
  });

  describe('scrollToBottom', () => {
    beforeEach(async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
    });

    it('should call evaluate for scrolling', async () => {
      // Mock evaluate to return different heights then same height
      let callCount = 0;
      manager.page.evaluate.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {return 1000;}
        return 1000; // same height = stop
      });

      await manager.scrollToBottom(2, 10);
      expect(manager.page.evaluate).toHaveBeenCalled();
    });
  });

  describe('humanDelay', () => {
    it('should delay within range', async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      const start = Date.now();
      await manager.humanDelay(10, 50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(9);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('close', () => {
    it('should close browser', async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
      expect(manager.isRunning()).toBe(true);

      await manager.close();
      expect(manager.browser).toBeNull();
      expect(manager.page).toBeNull();
      expect(manager.isRunning()).toBe(false);
    });

    it('should be safe to call when not running', async () => {
      manager = new BrowserManager();
      await expect(manager.close()).resolves.toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      manager = new BrowserManager();
      expect(manager.isRunning()).toBe(false);
    });

    it('should return true after launch', async () => {
      manager = new BrowserManager({ engine: 'puppeteer' });
      await manager.launch();
      expect(manager.isRunning()).toBe(true);
    });
  });

  describe('_loadLibrary', () => {
    it('should fall back to puppeteer when playwright unavailable', async () => {
      // Reset modules to test fallback
      jest.resetModules();
      jest.doMock('playwright', () => {
        throw new Error('not installed');
      }, { virtual: true });
      jest.doMock('puppeteer', () => ({
        launch: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue({
            setUserAgent: jest.fn(),
            setViewport: jest.fn(),
            setDefaultTimeout: jest.fn(),
          }),
          close: jest.fn(),
        }),
      }), { virtual: true });

      const BM = require('../../../src/automation/browserManager');
      const m = new BM({ engine: 'playwright' });
      await m.launch();
      expect(m.engine).toBe('puppeteer');
      await m.close();
    });
  });

  describe('BROWSER_ENGINES', () => {
    it('should export engine constants', () => {
      expect(BROWSER_ENGINES.PUPPETEER).toBe('puppeteer');
      expect(BROWSER_ENGINES.PLAYWRIGHT).toBe('playwright');
    });
  });
});
