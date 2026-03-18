import { useState, useCallback, useEffect } from 'react';
import type {
  SavedJob,
  SavedJobFilters,
  SavedJobStats,
} from '../types/savedJobs';
import {
  savedJobsService,
  type SaveJobData,
} from '../services/savedJobsService';

export function useSavedJobs() {
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [stats, setStats] = useState<SavedJobStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filters, setFilters] = useState<SavedJobFilters>({});

  const loadSavedJobs = useCallback(
    async (filterParams: SavedJobFilters, page = 1) => {
      setIsLoading(true);
      setError(null);
      setHasLoaded(true);
      try {
        const response = await savedJobsService.getSavedJobs({
          ...filterParams,
          page,
          pageSize: 20,
        });
        setSavedJobs(response.data || []);
        setTotalPages(
          response.meta
            ? Math.ceil(response.meta.total / response.meta.pageSize)
            : 0,
        );
        setCurrentPage(page);
      } catch {
        setSavedJobs([]);
        setError('Unable to load saved jobs. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadStats = useCallback(async () => {
    try {
      const response = await savedJobsService.getSavedJobStats();
      if (response.data) {
        setStats(response.data);
      }
    } catch {
      // Stats are non-critical, fail silently
    }
  }, []);

  const applyFilters = useCallback(
    (newFilters: SavedJobFilters) => {
      setFilters(newFilters);
      loadSavedJobs(newFilters, 1);
    },
    [loadSavedJobs],
  );

  const changePage = useCallback(
    (page: number) => {
      loadSavedJobs(filters, page);
    },
    [filters, loadSavedJobs],
  );

  const saveJob = useCallback(
    async (jobId: string, data?: SaveJobData) => {
      try {
        const response = await savedJobsService.saveJob(jobId, data);
        if (response.data) {
          setSavedJobs((prev) => [response.data!, ...prev]);
        }
        loadStats();
        return true;
      } catch {
        setError('Unable to save job. Please try again.');
        return false;
      }
    },
    [loadStats],
  );

  const updateSavedJob = useCallback(
    async (id: string, data: Partial<SaveJobData>) => {
      // Optimistic update
      setSavedJobs((prev) =>
        prev.map((job) => (job.id === id ? { ...job, ...data } : job)),
      );
      try {
        await savedJobsService.updateSavedJob(id, data);
        return true;
      } catch {
        // Revert on failure
        loadSavedJobs(filters, currentPage);
        setError('Unable to update job. Please try again.');
        return false;
      }
    },
    [filters, currentPage, loadSavedJobs],
  );

  const removeSavedJob = useCallback(
    async (id: string) => {
      // Optimistic removal
      const previousJobs = savedJobs;
      setSavedJobs((prev) => prev.filter((job) => job.id !== id));
      try {
        await savedJobsService.removeSavedJob(id);
        loadStats();
        return true;
      } catch {
        // Revert on failure
        setSavedJobs(previousJobs);
        setError('Unable to remove job. Please try again.');
        return false;
      }
    },
    [savedJobs, loadStats],
  );

  useEffect(() => {
    loadSavedJobs({}, 1);
    loadStats();
  }, [loadSavedJobs, loadStats]);

  return {
    savedJobs,
    stats,
    isLoading,
    error,
    hasLoaded,
    currentPage,
    totalPages,
    applyFilters,
    changePage,
    saveJob,
    updateSavedJob,
    removeSavedJob,
    refresh: () => {
      loadSavedJobs(filters, currentPage);
      loadStats();
    },
  };
}
