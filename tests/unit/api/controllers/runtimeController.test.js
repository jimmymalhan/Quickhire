jest.mock('../../../../src/utils/config', () => ({
  runtime: {
    stateDir: '/tmp/test-local-agent-runtime-state',
  },
}));

const fs = require('fs');
const path = require('path');

const TEST_STATE_DIR = '/tmp/test-local-agent-runtime-state';
const TEST_PROGRESS = {
  task: 'Quickhire runtime integration',
  current_stage: 'runtime-ui',
  started_at: '2026-03-10T02:30:00.000Z',
  updated_at: '2026-03-10T02:45:00.000Z',
  overall: { status: 'running', percent: 40, remaining_percent: 60 },
  stages: [
    {
      id: 'repo-stabilization',
      label: 'Repo stabilization',
      status: 'completed',
      percent: 100,
      weight: 30,
      started_at: '2026-03-10T02:30:00.000Z',
      completed_at: '2026-03-10T02:35:00.000Z',
    },
    {
      id: 'runtime-ui',
      label: 'Runtime UI',
      status: 'running',
      percent: 50,
      weight: 70,
      started_at: '2026-03-10T02:35:00.000Z',
    },
  ],
};

const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

beforeAll(() => {
  fs.existsSync = jest.fn((filePath) => {
    if (filePath === path.join(TEST_STATE_DIR, 'progress.json')) {
      return true;
    }
    return originalExistsSync(filePath);
  });

  fs.readFileSync = jest.fn((filePath, encoding) => {
    if (filePath === path.join(TEST_STATE_DIR, 'progress.json')) {
      return JSON.stringify(TEST_PROGRESS);
    }
    // Return empty JSON objects for other state files so they parse cleanly
    if (typeof filePath === 'string' && filePath.startsWith(TEST_STATE_DIR)) {
      return '{}';
    }
    return originalReadFileSync(filePath, encoding);
  });
});

afterAll(() => {
  fs.readFileSync = originalReadFileSync;
  fs.existsSync = originalExistsSync;
});

const {
  getRuntimeProgress,
  streamRuntimeProgress,
  getRuntimeControl,
} = require('../../../../src/api/controllers/runtimeController');

describe('runtimeController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {};
    res = {
      json: jest.fn(),
    };
  });

  it('returns a local-agent-runtime compatible snapshot', async () => {
    await getRuntimeProgress(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        code: 200,
        data: expect.objectContaining({
          overallProgress: expect.any(Number),
          tasks: expect.any(Array),
          sessions: expect.any(Array),
          blockers: expect.any(Array),
          orchestration: expect.objectContaining({
            controller: expect.objectContaining({
              preferredLane: expect.any(String),
            }),
            pendingCommands: expect.any(Array),
          }),
          source: expect.objectContaining({
            provider: 'local-agent-runtime',
            connected: true,
          }),
        }),
      }),
    );
  });

  it('maps seeded runtime stages into visible tasks', async () => {
    await getRuntimeProgress(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.data.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'repo-stabilization',
        }),
        expect.objectContaining({
          id: 'runtime-ui',
        }),
      ]),
    );
  });

  it('returns orchestration controls for the clawbot runtime', async () => {
    await getRuntimeControl(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        code: 200,
        data: expect.objectContaining({
          controller: expect.objectContaining({
            preferredProvider: 'local',
            preferredLane: expect.any(String),
          }),
          toolLinks: expect.any(Array),
        }),
      }),
    );
  });

  it('streams progress events and cleans up on close', async () => {
    const streamRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    let closeHandler;
    const streamReq = {
      on: jest.fn((event, handler) => {
        if (event === 'close') {
          closeHandler = handler;
        }
      }),
    };
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await streamRuntimeProgress(streamReq, streamRes);

    expect(streamRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(streamRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(streamRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(streamRes.write).toHaveBeenCalledWith('event: progress\n');
    expect(
      streamRes.write.mock.calls.some((call) =>
        String(call[0]).includes('local-agent-runtime'),
      ),
    ).toBe(true);
    expect(setIntervalSpy).toHaveBeenCalled();

    closeHandler();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(streamRes.end).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });
});
