import { useState, useCallback, useRef, useEffect } from 'react';
import type { AutoApplyProgress, AutoApplyState } from '../types/savedJobs';
import { savedJobsService } from '../services/savedJobsService';

const INITIAL_PROGRESS: AutoApplyProgress = {
  state: 'idle',
  totalJobs: 0,
  processedJobs: 0,
  successCount: 0,
  failCount: 0,
  skippedCount: 0,
  currentJob: null,
  etaSeconds: null,
  startedAt: null,
  error: null,
};

export function useAutoApply() {
  const [progress, setProgress] = useState<AutoApplyProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const connectStream = useCallback(() => {
    setError(null);
    const cleanup = savedJobsService.streamAutoApplyProgress(
      (update) => {
        setProgress(update);
      },
      () => {
        setError('Connection to auto-apply stream lost. Please try again.');
        setProgress((prev) => ({ ...prev, state: 'error' }));
      },
    );
    cleanupRef.current = cleanup;
  }, []);

  const start = useCallback(
    async (jobIds: string[], options?: { customResumeId?: string }) => {
      setError(null);
      setIsStarting(true);
      try {
        await savedJobsService.startBulkApply(jobIds, options);
        setProgress((prev) => ({
          ...prev,
          state: 'running',
          totalJobs: jobIds.length,
        }));
        connectStream();
        return true;
      } catch {
        setError('Unable to start auto-apply. Please try again.');
        return false;
      } finally {
        setIsStarting(false);
      }
    },
    [connectStream],
  );

  const pause = useCallback(async () => {
    try {
      await savedJobsService.pauseAutoApply();
      setProgress((prev) => ({ ...prev, state: 'paused' }));
    } catch {
      setError('Unable to pause auto-apply. Please try again.');
    }
  }, []);

  const resume = useCallback(async () => {
    try {
      await savedJobsService.resumeAutoApply();
      setProgress((prev) => ({ ...prev, state: 'running' }));
      connectStream();
    } catch {
      setError('Unable to resume auto-apply. Please try again.');
    }
  }, [connectStream]);

  const cancel = useCallback(async () => {
    try {
      await savedJobsService.cancelAutoApply();
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setProgress(INITIAL_PROGRESS);
    } catch {
      setError('Unable to cancel auto-apply. Please try again.');
    }
  }, []);

  const reset = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setError(null);
    setIsStarting(false);
    setProgress(INITIAL_PROGRESS);
  }, []);

  const percentComplete =
    progress.totalJobs > 0
      ? Math.round((progress.processedJobs / progress.totalJobs) * 100)
      : progress.state === 'completed'
        ? 100
        : 0;

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    progress,
    error,
    state: progress.state as AutoApplyState,
    start,
    pause,
    resume,
    cancel,
    reset,
    percentComplete,
    isStarting,
    isRunning: progress.state === 'running',
    isPaused: progress.state === 'paused',
    isCompleted: progress.state === 'completed',
    isIdle: progress.state === 'idle',
  };
}
