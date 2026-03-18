import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial value when no stored value', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when present', () => {
    localStorage.setItem('key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  it('updates value and localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(JSON.parse(localStorage.getItem('key')!)).toBe('new-value');
  });

  it('supports function updater', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('handles objects', () => {
    const { result } = renderHook(() =>
      useLocalStorage('obj', { name: 'test' }),
    );

    act(() => {
      result.current[1]({ name: 'updated' });
    });

    expect(result.current[0]).toEqual({ name: 'updated' });
  });
});
