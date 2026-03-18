import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('provides theme value', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBeDefined();
  });

  it('defaults to light theme when no stored preference', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('uses stored theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme switches from light to dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
  });

  it('toggleTheme switches from dark to light', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
  });

  it('persists theme to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('adds theme class to document element', () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('throws when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');
  });

  it('provides toggleTheme function', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(typeof result.current.toggleTheme).toBe('function');
  });
});
