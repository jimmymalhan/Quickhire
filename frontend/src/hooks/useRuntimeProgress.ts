import { useEffect, useState } from 'react';
import type { RuntimeProgressSnapshot } from '../types';
import { sampleRuntimeProgress } from '../data/sampleRuntimeProgress';
import { runtimeService } from '../services/runtimeService';

export function useRuntimeProgress() {
  const [runtimeProgress, setRuntimeProgress] = useState<RuntimeProgressSnapshot>(
    sampleRuntimeProgress,
  );

  useEffect(() => {
    let cancelled = false;
    let stopStream: () => void = () => {};
    let intervalId: number | null = null;

    const loadRuntimeProgress = async () => {
      try {
        const response = await runtimeService.getProgress();
        if (!cancelled && response.data) {
          setRuntimeProgress(response.data);
        }
      } catch {
        if (!cancelled) {
          setRuntimeProgress(sampleRuntimeProgress);
        }
      }
    };

    stopStream = runtimeService.streamProgress(
      (snapshot) => {
        if (!cancelled) {
          setRuntimeProgress(snapshot);
        }
      },
      () => {
        if (!cancelled && intervalId === null) {
          void loadRuntimeProgress();
          intervalId = window.setInterval(() => {
            void loadRuntimeProgress();
          }, 5000);
        }
      },
    );

    void loadRuntimeProgress();

    return () => {
      cancelled = true;
      stopStream();
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return runtimeProgress;
}
