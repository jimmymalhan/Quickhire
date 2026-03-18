jest.mock('../../../src/database/connection');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../src/utils/config', () => ({
  db: { host: 'localhost', port: 5432, name: 'test' },
  redis: { host: 'localhost', port: 6379 },
  logging: { level: 'error' },
}));

const { query } = require('../../../src/database/connection');
const SavedJob = require('../../../src/database/models/SavedJob');

describe('SavedJob model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns saved job with joined job data when found', async () => {
      const row = {
        id: 'sj-1',
        user_id: 'user-1',
        job_id: 'job-1',
        job_title: 'Engineer',
        job_company: 'Acme',
        job_location: 'Remote',
        salary_min: 80000,
        salary_max: 120000,
      };
      query.mockResolvedValue({ rows: [row] });

      const result = await SavedJob.findById('sj-1');

      expect(result).toEqual(row);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE sj.id = $1'), ['sj-1']);
    });

    it('returns null when not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('joins on jobs table', async () => {
      query.mockResolvedValue({ rows: [] });

      await SavedJob.findById('sj-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN jobs j ON sj.job_id = j.id'),
        expect.any(Array),
      );
    });
  });

  describe('findByUser', () => {
    it('returns paginated saved jobs for a user', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'sj-1', job_title: 'Engineer' },
            { id: 'sj-2', job_title: 'Designer' },
            { id: 'sj-3', job_title: 'PM' },
          ],
        });

      const result = await SavedJob.findByUser('user-1');

      expect(result).toEqual({
        savedJobs: expect.any(Array),
        total: 3,
        page: 1,
        limit: 20,
      });
      expect(result.savedJobs).toHaveLength(3);
    });

    it('uses default page 1 and limit 20', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await SavedJob.findByUser('user-1');

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters by status when provided', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'sj-1' }] });

      await SavedJob.findByUser('user-1', { status: 'saved' });

      expect(query.mock.calls[0][0]).toContain('sj.status = $2');
      expect(query.mock.calls[0][1]).toContain('saved');
    });

    it('filters by priority when provided', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'sj-1' }, { id: 'sj-2' }] });

      await SavedJob.findByUser('user-1', { priority: 'high' });

      expect(query.mock.calls[0][0]).toContain('sj.priority = $2');
      expect(query.mock.calls[0][1]).toContain('high');
    });

    it('applies both status and priority filters', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'sj-1' }] });

      await SavedJob.findByUser('user-1', { status: 'saved', priority: 'high' });

      const countQuery = query.mock.calls[0][0];
      expect(countQuery).toContain('sj.status = $2');
      expect(countQuery).toContain('sj.priority = $3');
    });

    it('calculates offset from page and limit', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      await SavedJob.findByUser('user-1', { page: 3, limit: 10 });

      // offset = (3-1)*10 = 20
      const dataParams = query.mock.calls[1][1];
      expect(dataParams).toContain(10); // limit
      expect(dataParams).toContain(20); // offset
    });

    it('orders by priority then saved_at DESC', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await SavedJob.findByUser('user-1');

      const dataQuery = query.mock.calls[1][0];
      expect(dataQuery).toContain("CASE sj.priority WHEN 'high' THEN 1");
      expect(dataQuery).toContain('sj.saved_at DESC');
    });

    it('returns empty list when no saved jobs', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await SavedJob.findByUser('user-1');

      expect(result.savedJobs).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('save', () => {
    it('inserts a new saved job and returns it', async () => {
      const saved = { id: 'sj-1', user_id: 'user-1', job_id: 'job-1', priority: 'medium' };
      query.mockResolvedValue({ rows: [saved] });

      const result = await SavedJob.save('user-1', 'job-1');

      expect(result).toEqual(saved);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO saved_jobs'),
        ['user-1', 'job-1', '', null, 'medium'],
      );
    });

    it('returns null on duplicate (ON CONFLICT DO NOTHING)', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.save('user-1', 'job-1');

      expect(result).toBeNull();
    });

    it('passes notes, customResumeId, and priority', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.save('user-1', 'job-1', {
        notes: 'Great company',
        customResumeId: 'resume-5',
        priority: 'high',
      });

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['user-1', 'job-1', 'Great company', 'resume-5', 'high'],
      );
    });

    it('uses default values when data is empty', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.save('user-1', 'job-1', {});

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['user-1', 'job-1', '', null, 'medium'],
      );
    });

    it('uses ON CONFLICT clause for idempotency', async () => {
      query.mockResolvedValue({ rows: [] });

      await SavedJob.save('user-1', 'job-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (user_id, job_id) DO NOTHING'),
        expect.any(Array),
      );
    });
  });

  describe('update', () => {
    it('updates notes field', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1', notes: 'updated' }] });

      const result = await SavedJob.update('sj-1', 'user-1', { notes: 'updated' });

      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('notes = $3'),
        expect.arrayContaining(['sj-1', 'user-1', 'updated']),
      );
    });

    it('updates priority field', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1', priority: 'high' }] });

      await SavedJob.update('sj-1', 'user-1', { priority: 'high' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('priority = $3'),
        expect.arrayContaining(['high']),
      );
    });

    it('updates status field', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1', status: 'skipped' }] });

      await SavedJob.update('sj-1', 'user-1', { status: 'skipped' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('status = $3'),
        expect.arrayContaining(['skipped']),
      );
    });

    it('updates customResumeId field', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.update('sj-1', 'user-1', { customResumeId: 'resume-3' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('custom_resume_id = $3'),
        expect.arrayContaining(['resume-3']),
      );
    });

    it('updates multiple fields at once', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.update('sj-1', 'user-1', { notes: 'new note', priority: 'low' });

      const sql = query.mock.calls[0][0];
      expect(sql).toContain('notes = $3');
      expect(sql).toContain('priority = $4');
    });

    it('always sets updated_at = NOW()', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.update('sj-1', 'user-1', { notes: 'x' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array),
      );
    });

    it('returns null when saved job not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.update('nonexistent', 'user-1', { notes: 'x' });

      expect(result).toBeNull();
    });

    it('scopes update to user_id', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.update('sj-1', 'user-1', { notes: 'x' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        expect.any(Array),
      );
    });
  });

  describe('remove', () => {
    it('deletes saved job by userId and jobId', async () => {
      const removed = { id: 'sj-1', user_id: 'user-1', job_id: 'job-1' };
      query.mockResolvedValue({ rows: [removed] });

      const result = await SavedJob.remove('user-1', 'job-1');

      expect(result).toEqual(removed);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2'),
        ['user-1', 'job-1'],
      );
    });

    it('returns null when nothing to delete', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.remove('user-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('removeById', () => {
    it('deletes saved job by id and userId', async () => {
      const removed = { id: 'sj-1' };
      query.mockResolvedValue({ rows: [removed] });

      const result = await SavedJob.removeById('sj-1', 'user-1');

      expect(result).toEqual(removed);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM saved_jobs WHERE id = $1 AND user_id = $2'),
        ['sj-1', 'user-1'],
      );
    });

    it('returns null when id not found for user', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.removeById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('markApplied', () => {
    it('sets status to applied and updates applied_at', async () => {
      const updated = { id: 'sj-1', status: 'applied' };
      query.mockResolvedValue({ rows: [updated] });

      const result = await SavedJob.markApplied('sj-1', 'user-1');

      expect(result).toEqual(updated);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'applied', applied_at = NOW()"),
        ['sj-1', 'user-1'],
      );
    });

    it('scopes to user_id for security', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.markApplied('sj-1', 'user-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND user_id = $2'),
        ['sj-1', 'user-1'],
      );
    });

    it('returns null when saved job not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.markApplied('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('also updates updated_at timestamp', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.markApplied('sj-1', 'user-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = NOW()'),
        expect.any(Array),
      );
    });
  });

  describe('getStats', () => {
    it('returns aggregated stats for user', async () => {
      query.mockResolvedValue({
        rows: [
          {
            total: '10',
            saved_count: '5',
            applied_count: '3',
            skipped_count: '2',
            high_priority: '4',
            medium_priority: '3',
            low_priority: '3',
          },
        ],
      });

      const result = await SavedJob.getStats('user-1');

      expect(result).toEqual({
        total: 10,
        byStatus: { saved: 5, applied: 3, skipped: 2 },
        byPriority: { high: 4, medium: 3, low: 3 },
      });
    });

    it('handles zero stats', async () => {
      query.mockResolvedValue({
        rows: [
          {
            total: '0',
            saved_count: '0',
            applied_count: '0',
            skipped_count: '0',
            high_priority: '0',
            medium_priority: '0',
            low_priority: '0',
          },
        ],
      });

      const result = await SavedJob.getStats('user-1');

      expect(result.total).toBe(0);
      expect(result.byStatus.saved).toBe(0);
      expect(result.byPriority.high).toBe(0);
    });

    it('parses string counts as integers', async () => {
      query.mockResolvedValue({
        rows: [
          {
            total: '15',
            saved_count: '7',
            applied_count: '5',
            skipped_count: '3',
            high_priority: '6',
            medium_priority: '5',
            low_priority: '4',
          },
        ],
      });

      const result = await SavedJob.getStats('user-1');

      expect(typeof result.total).toBe('number');
      expect(typeof result.byStatus.saved).toBe('number');
      expect(typeof result.byPriority.high).toBe('number');
    });

    it('queries with correct userId parameter', async () => {
      query.mockResolvedValue({
        rows: [
          {
            total: '0',
            saved_count: '0',
            applied_count: '0',
            skipped_count: '0',
            high_priority: '0',
            medium_priority: '0',
            low_priority: '0',
          },
        ],
      });

      await SavedJob.getStats('user-42');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['user-42'],
      );
    });
  });

  describe('findSavedForBulkApply', () => {
    it('returns saved jobs with status saved', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 'sj-1', job_id: 'job-1', status: 'saved', job_title: 'Engineer' },
          { id: 'sj-2', job_id: 'job-2', status: 'saved', job_title: 'Designer' },
        ],
      });

      const result = await SavedJob.findSavedForBulkApply('user-1');

      expect(result).toHaveLength(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("sj.status = 'saved'"),
        expect.any(Array),
      );
    });

    it('filters by priority when provided', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      await SavedJob.findSavedForBulkApply('user-1', { priority: 'high' });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('sj.priority = $2'),
        expect.arrayContaining(['user-1', 'high']),
      );
    });

    it('uses default limit of 50', async () => {
      query.mockResolvedValue({ rows: [] });

      await SavedJob.findSavedForBulkApply('user-1');

      const params = query.mock.calls[0][1];
      expect(params).toContain(50);
    });

    it('accepts custom limit', async () => {
      query.mockResolvedValue({ rows: [] });

      await SavedJob.findSavedForBulkApply('user-1', { limit: 10 });

      const params = query.mock.calls[0][1];
      expect(params).toContain(10);
    });

    it('orders by priority then saved_at ASC', async () => {
      query.mockResolvedValue({ rows: [] });

      await SavedJob.findSavedForBulkApply('user-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('sj.saved_at ASC'),
        expect.any(Array),
      );
    });

    it('returns empty array when no eligible jobs', async () => {
      query.mockResolvedValue({ rows: [] });

      const result = await SavedJob.findSavedForBulkApply('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('findByUser handles no options argument', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await SavedJob.findByUser('user-1');

      expect(result).toBeDefined();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('update with no fields returns findById result', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1', notes: 'original' }] });

      const result = await SavedJob.update('sj-1', 'user-1', {});

      // Should call findById instead of UPDATE
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE sj.id = $1'),
        ['sj-1'],
      );
      expect(result).toBeDefined();
    });

    it('save with no data argument uses defaults', async () => {
      query.mockResolvedValue({ rows: [{ id: 'sj-1' }] });

      const result = await SavedJob.save('user-1', 'job-1');

      expect(result).toBeDefined();
      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        ['user-1', 'job-1', '', null, 'medium'],
      );
    });
  });
});
