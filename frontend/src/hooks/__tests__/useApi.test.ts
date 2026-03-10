import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApi } from '../useApi';

describe('useApi', () => {
  it('starts with initial state', () => {
    const apiFunc = vi.fn();
    const { result } = renderHook(() => useApi(apiFunc));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets loading state during execution', async () => {
    let resolve: (v: string) => void;
    const apiFunc = vi.fn(
      () => new Promise<string>((r) => { resolve = r; }),
    );
    const { result } = renderHook(() => useApi(apiFunc));

    let executePromise: Promise<string | null>;
    act(() => {
      executePromise = result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve!('data');
      await executePromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('returns data on success', async () => {
    const apiFunc = vi.fn().mockResolvedValue({ name: 'test' });
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ name: 'test' });
    expect(result.current.error).toBeNull();
  });

  it('returns error message on failure', async () => {
    const apiFunc = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('handles non-Error rejections', async () => {
    const apiFunc = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBe('An error occurred');
  });

  it('execute returns data on success', async () => {
    const apiFunc = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() => useApi(apiFunc));

    let returnValue: number | null = null;
    await act(async () => {
      returnValue = await result.current.execute();
    });

    expect(returnValue).toBe(42);
  });

  it('execute returns null on failure', async () => {
    const apiFunc = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useApi(apiFunc));

    let returnValue: unknown = 'initial';
    await act(async () => {
      returnValue = await result.current.execute();
    });

    expect(returnValue).toBeNull();
  });

  it('passes arguments to api function', async () => {
    const apiFunc = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute('arg1', 'arg2');
    });

    expect(apiFunc).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('reset clears state', async () => {
    const apiFunc = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('data');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('clears previous data before new execution', async () => {
    const apiFunc = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const { result } = renderHook(() => useApi(apiFunc));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe('first');

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe('second');
  });
});
