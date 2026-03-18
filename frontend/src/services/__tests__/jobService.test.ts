import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jobService } from '../jobService';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedDelete = vi.mocked(apiClient.delete);

describe('jobService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchJobs', () => {
    it('calls GET /jobs with params', async () => {
      const mockResponse = { data: { status: 'success', data: [], meta: { page: 1, pageSize: 20, total: 0, timestamp: '' } } };
      mockedGet.mockResolvedValue(mockResponse as never);

      await jobService.searchJobs({ query: 'engineer' });

      expect(mockedGet).toHaveBeenCalledWith('/jobs', { params: { query: 'engineer' } });
    });

    it('returns paginated response data', async () => {
      const jobs = [{ id: '1', title: 'Engineer' }];
      const mockResponse = { data: { status: 'success', data: jobs, meta: { page: 1, pageSize: 20, total: 1, timestamp: '' } } };
      mockedGet.mockResolvedValue(mockResponse as never);

      const result = await jobService.searchJobs({});
      expect(result.data).toEqual(jobs);
    });

    it('passes all search params', async () => {
      mockedGet.mockResolvedValue({ data: { data: [] } } as never);

      await jobService.searchJobs({
        query: 'dev',
        location: 'Remote',
        salaryMin: 80000,
        salaryMax: 150000,
        experienceLevel: 'Senior',
        sortBy: 'salary',
        page: 2,
        pageSize: 50,
      });

      expect(mockedGet).toHaveBeenCalledWith('/jobs', {
        params: {
          query: 'dev',
          location: 'Remote',
          salaryMin: 80000,
          salaryMax: 150000,
          experienceLevel: 'Senior',
          sortBy: 'salary',
          page: 2,
          pageSize: 50,
        },
      });
    });
  });

  describe('getJob', () => {
    it('calls GET /jobs/:id', async () => {
      const job = { id: 'j1', title: 'Dev' };
      mockedGet.mockResolvedValue({ data: { data: job } } as never);

      const result = await jobService.getJob('j1');

      expect(mockedGet).toHaveBeenCalledWith('/jobs/j1');
      expect(result).toEqual(job);
    });
  });

  describe('getRecommendedJobs', () => {
    it('calls GET /jobs/recommended with defaults', async () => {
      mockedGet.mockResolvedValue({ data: { data: [] } } as never);

      await jobService.getRecommendedJobs();

      expect(mockedGet).toHaveBeenCalledWith('/jobs/recommended', { params: { page: 1, pageSize: 20 } });
    });

    it('passes custom page and pageSize', async () => {
      mockedGet.mockResolvedValue({ data: { data: [] } } as never);

      await jobService.getRecommendedJobs(3, 50);

      expect(mockedGet).toHaveBeenCalledWith('/jobs/recommended', { params: { page: 3, pageSize: 50 } });
    });
  });

  describe('bookmarkJob', () => {
    it('calls POST /jobs/:id/bookmark', async () => {
      mockedPost.mockResolvedValue({} as never);

      await jobService.bookmarkJob('j1');

      expect(mockedPost).toHaveBeenCalledWith('/jobs/j1/bookmark');
    });
  });

  describe('removeBookmark', () => {
    it('calls DELETE /jobs/:id/bookmark', async () => {
      mockedDelete.mockResolvedValue({} as never);

      await jobService.removeBookmark('j1');

      expect(mockedDelete).toHaveBeenCalledWith('/jobs/j1/bookmark');
    });
  });
});
