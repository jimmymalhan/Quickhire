import { useState, useCallback } from 'react';

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setState({ data: null, error: null, isLoading: true });
      try {
        const result = await apiFunction(...args);
        setState({ data: result, error: null, isLoading: false });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An error occurred';
        setState({ data: null, error: message, isLoading: false });
        return null;
      }
    },
    [apiFunction],
  );

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}
