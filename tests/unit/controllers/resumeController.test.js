jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockParse = jest.fn();
const mockValidate = jest.fn();
const mockCustomize = jest.fn();
const mockExtractKeywords = jest.fn();
const mockMatchSkills = jest.fn();
const mockScoreFit = jest.fn();
const mockGenerateCoverLetter = jest.fn();

jest.mock('../../../src/automation/resumeParser', () => ({
  ResumeParser: jest.fn().mockImplementation(() => ({
    parse: mockParse,
    validate: mockValidate,
  })),
}));

jest.mock('../../../src/automation/resumeCustomizer', () => ({
  ResumeCustomizer: jest.fn().mockImplementation(() => ({
    customize: mockCustomize,
    extractKeywords: mockExtractKeywords,
    matchSkills: mockMatchSkills,
    scoreFit: mockScoreFit,
    generateCoverLetter: mockGenerateCoverLetter,
  })),
}));

const {
  uploadResume,
  getResumes,
  customizeForJob,
  previewCustomization,
  deleteResume,
  generateCoverLetter,
  _resetStore,
} = require('../../../src/api/controllers/resumeController');

const makeReq = (overrides = {}) => ({
  user: { id: 'user-1' },
  body: {},
  params: {},
  headers: { 'x-request-id': 'req-1' },
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('resumeController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetStore();
    req = makeReq();
    res = makeRes();
    next = jest.fn();

    mockParse.mockReturnValue({ contact: { name: 'Jimmy' }, skills: ['Node.js'] });
    mockValidate.mockReturnValue({ valid: true, errors: [] });
    mockCustomize.mockReturnValue({
      content: { skills: ['Node.js'] },
      customization: { fitScore: { overall: 88 } },
    });
    mockExtractKeywords.mockReturnValue(['node.js', 'react']);
    mockMatchSkills.mockReturnValue({
      matched: ['node.js'],
      missing: ['react'],
      score: 50,
    });
    mockScoreFit.mockReturnValue({
      overall: 80,
      skills: 50,
      experience: 90,
      education: 70,
    });
    mockGenerateCoverLetter.mockReturnValue('Cover letter text');
  });

  describe('uploadResume', () => {
    it('uploads a valid resume', async () => {
      req.body = { content: '{"name":"Jimmy"}', format: 'json', name: 'Main Resume' };

      await uploadResume(req, res, next);

      expect(mockParse).toHaveBeenCalledWith('{"name":"Jimmy"}', 'json');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          code: 201,
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'Main Resume',
            format: 'json',
          }),
          traceId: 'req-1',
        }),
      );
    });

    it('defaults the format to json', async () => {
      req.body = { content: '{"name":"Jimmy"}', name: 'Resume' };

      await uploadResume(req, res, next);

      expect(mockParse).toHaveBeenCalledWith('{"name":"Jimmy"}', 'json');
    });

    it('rejects missing content', async () => {
      req.body = { name: 'Resume' };

      await uploadResume(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resume content is required' }),
      );
    });

    it('rejects missing name', async () => {
      req.body = { content: '{}' };

      await uploadResume(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resume name is required' }),
      );
    });

    it('rejects invalid parsed resume', async () => {
      req.body = { content: '{}', name: 'Resume' };
      mockValidate.mockReturnValue({ valid: false, errors: ['missing skills'] });

      await uploadResume(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid resume: missing skills' }),
      );
    });
  });

  describe('getResumes', () => {
    it('returns uploaded resumes for the user', async () => {
      req.body = { content: '{}', name: 'Resume' };
      await uploadResume(req, makeRes(), jest.fn());

      await getResumes(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Resume' }),
          ]),
          meta: { total: 1 },
        }),
      );
    });
  });

  describe('customizeForJob', () => {
    it('customizes a stored resume for a job', async () => {
      const uploadRes = makeRes();
      req.body = { content: '{}', name: 'Resume' };
      await uploadResume(req, uploadRes, next);
      const uploaded = uploadRes.json.mock.calls[0][0].data;

      req = makeReq({
        params: { id: uploaded.id },
        body: { job: { title: 'Backend Engineer', company: 'Acme' } },
      });

      await customizeForJob(req, res, next);

      expect(mockCustomize).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 200,
          data: expect.objectContaining({
            customization: expect.objectContaining({
              fitScore: expect.objectContaining({ overall: 88 }),
            }),
          }),
        }),
      );
    });

    it('rejects missing job data', async () => {
      req.params = { id: 'resume-1' };

      await customizeForJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Job posting data is required' }),
      );
    });

    it('rejects unknown resume ids', async () => {
      req.params = { id: 'missing' };
      req.body = { job: { title: 'Role' } };

      await customizeForJob(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resume not found' }),
      );
    });
  });

  describe('previewCustomization', () => {
    it('returns keyword and fit preview data', async () => {
      const uploadRes = makeRes();
      req.body = { content: '{}', name: 'Resume' };
      await uploadResume(req, uploadRes, next);
      const uploaded = uploadRes.json.mock.calls[0][0].data;

      req = makeReq({
        params: { id: uploaded.id },
        body: { job: { title: 'Backend Engineer' } },
      });

      await previewCustomization(req, res, next);

      expect(mockExtractKeywords).toHaveBeenCalled();
      expect(mockMatchSkills).toHaveBeenCalled();
      expect(mockScoreFit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumeId: uploaded.id,
            keywords: ['node.js', 'react'],
            matchedSkills: ['node.js'],
            missingSkills: ['react'],
          }),
        }),
      );
    });
  });

  describe('deleteResume', () => {
    it('deletes an existing resume', async () => {
      const uploadRes = makeRes();
      req.body = { content: '{}', name: 'Resume' };
      await uploadResume(req, uploadRes, next);
      const uploaded = uploadRes.json.mock.calls[0][0].data;

      req = makeReq({ params: { id: uploaded.id } });

      await deleteResume(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deleted: true, id: uploaded.id },
        }),
      );
    });

    it('rejects deleting an unknown resume', async () => {
      req.params = { id: 'missing' };

      await deleteResume(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Resume not found' }),
      );
    });
  });

  describe('generateCoverLetter', () => {
    it('generates a cover letter for a saved resume', async () => {
      const uploadRes = makeRes();
      req.body = { content: '{}', name: 'Resume' };
      await uploadResume(req, uploadRes, next);
      const uploaded = uploadRes.json.mock.calls[0][0].data;

      req = makeReq({
        params: { id: uploaded.id },
        body: { job: { title: 'Backend Engineer', company: 'Acme' }, options: { tone: 'casual' } },
      });

      await generateCoverLetter(req, res, next);

      expect(mockGenerateCoverLetter).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ title: 'Backend Engineer' }),
        { tone: 'casual' },
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coverLetter: 'Cover letter text',
            resumeId: uploaded.id,
          }),
        }),
      );
    });
  });
});
