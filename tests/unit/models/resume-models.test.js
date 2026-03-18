jest.mock('../../../src/database/connection', () => ({
  query: jest.fn(),
}));

const { query } = require('../../../src/database/connection');
const Resume = require('../../../src/database/models/Resume');
const CustomizedResume = require('../../../src/database/models/CustomizedResume');

describe('Resume model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findById returns the first row or null', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] });
    await expect(Resume.findById('resume-1')).resolves.toEqual({ id: 'resume-1' });

    query.mockResolvedValueOnce({ rows: [] });
    await expect(Resume.findById('missing')).resolves.toBeNull();
  });

  it('findByUser returns rows ordered by default and update time', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] });
    await expect(Resume.findByUser('user-1')).resolves.toEqual([{ id: 'resume-1' }]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY is_default DESC, updated_at DESC'),
      ['user-1'],
    );
  });

  it('getDefault returns one row or null', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'resume-1', is_default: true }] });
    await expect(Resume.getDefault('user-1')).resolves.toEqual(
      expect.objectContaining({ id: 'resume-1' }),
    );
  });

  it('create unsets an existing default when requested', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'resume-2', is_default: true }] });

    const result = await Resume.create('user-1', {
      name: 'Resume',
      content: { skills: ['node'] },
      isDefault: true,
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE resumes SET is_default = false'),
      ['user-1'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO resumes'),
      ['user-1', 'Resume', JSON.stringify({ skills: ['node'] }), 'json', true],
    );
    expect(result).toEqual({ id: 'resume-2', is_default: true });
  });

  it('update returns current row when no fields change', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] });

    await expect(Resume.update('resume-1', {})).resolves.toEqual({ id: 'resume-1' });
  });

  it('update clears other defaults when setting a new default', async () => {
    jest.spyOn(Resume, 'findById').mockResolvedValueOnce({ id: 'resume-1', user_id: 'user-1' });
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'resume-1', is_default: true }] });

    const result = await Resume.update('resume-1', { isDefault: true, name: 'New Name' });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE resumes SET is_default = false'),
      ['user-1', 'resume-1'],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE resumes'),
      ['resume-1', 'New Name', true],
    );
    expect(result).toEqual({ id: 'resume-1', is_default: true });
    Resume.findById.mockRestore();
  });

  it('delete returns deleted row or null', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] });
    await expect(Resume.delete('resume-1')).resolves.toEqual({ id: 'resume-1' });
  });
});

describe('CustomizedResume model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('findById returns joined row or null', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'custom-1' }] });
    await expect(CustomizedResume.findById('custom-1')).resolves.toEqual({ id: 'custom-1' });
  });

  it('findByUserAndJob returns rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'custom-1' }] });
    await expect(CustomizedResume.findByUserAndJob('user-1', 'job-1')).resolves.toEqual([
      { id: 'custom-1' },
    ]);
  });

  it('findByUser returns rows', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'custom-1' }] });
    await expect(CustomizedResume.findByUser('user-1')).resolves.toEqual([{ id: 'custom-1' }]);
  });

  it('create stores JSON content and defaults', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'custom-1' }] });
    const result = await CustomizedResume.create({
      resumeId: 'resume-1',
      jobId: 'job-1',
      userId: 'user-1',
      customizedContent: { summary: 'Tailored' },
      coverLetter: 'Hello',
      fitScore: 88,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO customized_resumes'),
      ['resume-1', 'job-1', 'user-1', JSON.stringify({ summary: 'Tailored' }), 'Hello', 88],
    );
    expect(result).toEqual({ id: 'custom-1' });
  });

  it('delete returns deleted row or null', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'custom-1' }] });
    await expect(CustomizedResume.delete('custom-1')).resolves.toEqual({ id: 'custom-1' });
  });
});
