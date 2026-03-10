jest.mock('bull', () => {
  return jest.fn().mockImplementation((name) => {
    const handlers = {};
    return {
      name,
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      process: jest.fn(),
      add: jest.fn(),
      _handlers: handlers,
    };
  });
});

jest.mock('../../../src/utils/config', () => ({
  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const Bull = require('bull');

describe('queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('creates three named queues', () => {
    const { jobScrapeQueue, applicationQueue, notificationQueue } = require('../../../src/scheduler/queue');
    expect(jobScrapeQueue).toBeDefined();
    expect(applicationQueue).toBeDefined();
    expect(notificationQueue).toBeDefined();
  });

  it('createQueue returns a Bull queue instance', () => {
    const { createQueue } = require('../../../src/scheduler/queue');
    const queue = createQueue('test-queue');
    expect(queue).toBeDefined();
    expect(Bull).toHaveBeenCalledWith('test-queue', expect.any(Object));
  });

  it('configures redis connection', () => {
    require('../../../src/scheduler/queue');
    const bullConfig = Bull.mock.calls[0][1];
    expect(bullConfig.redis).toEqual(
      expect.objectContaining({
        host: 'localhost',
        port: 6379,
      })
    );
  });

  it('sets default job options', () => {
    require('../../../src/scheduler/queue');
    const bullConfig = Bull.mock.calls[0][1];
    expect(bullConfig.defaultJobOptions).toEqual(
      expect.objectContaining({
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
      })
    );
  });

  it('registers error, failed, and completed event handlers', () => {
    const { jobScrapeQueue } = require('../../../src/scheduler/queue');
    expect(jobScrapeQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(jobScrapeQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
    expect(jobScrapeQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
  });
});
