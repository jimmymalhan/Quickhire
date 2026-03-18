jest.mock('../../../../src/utils/config', () => ({
  runtime: {
    stateDir: '/tmp/non-existent-local-agent-runtime-state',
  },
}));

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
