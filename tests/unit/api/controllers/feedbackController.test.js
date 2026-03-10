const { submitFeedback, submitNPS, voteFeature, listFeatureRequests } = require('../../../../src/api/controllers/feedbackController');

describe('feedbackController', () => {
  let req, res;

  beforeEach(() => {
    req = { user: { id: 'user-1' }, body: {}, params: {}, query: {} };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('submitFeedback', () => {
    it('returns 201 for valid feedback', async () => {
      req.body = {
        category: 'bug',
        description: 'This is a valid bug report with enough characters',
        priority: 'high',
        allow_contact: true,
      };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' })
      );
    });

    it('returns 400 when category missing', async () => {
      req.body = { description: 'Some description here with enough chars' };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when description missing', async () => {
      req.body = { category: 'bug' };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid category', async () => {
      req.body = { category: 'invalid', description: 'Some description with enough characters' };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts all valid categories', async () => {
      for (const category of ['bug', 'feature_request', 'improvement', 'other']) {
        res.status.mockClear();
        res.json.mockClear();
        req.body = { category, description: 'Valid description with enough characters' };

        await submitFeedback(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
      }
    });

    it('returns 400 when description too short', async () => {
      req.body = { category: 'bug', description: 'short' };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when description too long', async () => {
      req.body = { category: 'bug', description: 'x'.repeat(2001) };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts description at exactly 10 characters', async () => {
      req.body = { category: 'bug', description: 'x'.repeat(10) };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('accepts description at exactly 2000 characters', async () => {
      req.body = { category: 'bug', description: 'x'.repeat(2000) };

      await submitFeedback(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('submitNPS', () => {
    it('returns 201 for valid NPS score', async () => {
      req.body = { score: 8 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('accepts score of 0', async () => {
      req.body = { score: 0 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('accepts score of 10', async () => {
      req.body = { score: 10 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects score below 0', async () => {
      req.body = { score: -1 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects score above 10', async () => {
      req.body = { score: 11 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects non-integer score', async () => {
      req.body = { score: 5.5 };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects missing score', async () => {
      req.body = {};

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('accepts optional reason', async () => {
      req.body = { score: 9, reason: 'Great product!' };

      await submitNPS(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('voteFeature', () => {
    it('returns 200 for valid vote', async () => {
      req.params = { id: 'feature-1' };

      await voteFeature(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ feature_id: 'feature-1' }),
        })
      );
    });
  });

  describe('listFeatureRequests', () => {
    it('returns empty array with pagination meta', async () => {
      await listFeatureRequests(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data).toEqual([]);
      expect(response.meta).toHaveProperty('page');
      expect(response.meta).toHaveProperty('total');
    });

    it('respects pagination params', async () => {
      req.query = { page: '2', per_page: '10' };

      await listFeatureRequests(req, res);
      const response = res.json.mock.calls[0][0];
      expect(response.meta.page).toBe(2);
      expect(response.meta.per_page).toBe(10);
    });
  });
});
