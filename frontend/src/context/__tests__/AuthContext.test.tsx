import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import type { ReactNode } from 'react';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '../../services/apiClient';

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with loading state', () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('sets user on successful auth check', async () => {
    const mockUser = {
      id: '1',
      email: 'test@test.com',
      firstName: 'John',
      lastName: 'Doe',
      linkedinId: 'li-1',
      profilePicUrl: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    mockedGet.mockResolvedValue({ data: { data: mockUser } } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('sets unauthenticated on failed auth check', async () => {
    mockedGet.mockRejectedValue(new Error('401'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('provides login function', async () => {
    mockedGet.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.login).toBe('function');
  });

  it('provides logout function', async () => {
    mockedGet.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.logout).toBe('function');
  });

  it('logout clears user state', async () => {
    const mockUser = {
      id: '1', email: 'test@test.com', firstName: 'John',
      lastName: 'Doe', linkedinId: 'li-1', profilePicUrl: null,
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    };
    mockedGet.mockResolvedValue({ data: { data: mockUser } } as never);
    mockedPost.mockResolvedValue({} as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logout clears state even if API fails', async () => {
    const mockUser = {
      id: '1', email: 'test@test.com', firstName: 'John',
      lastName: 'Doe', linkedinId: 'li-1', profilePicUrl: null,
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    };
    mockedGet.mockResolvedValue({ data: { data: mockUser } } as never);
    mockedPost.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      // logout uses try/finally so the rejection is caught internally,
      // but act may still surface the unhandled promise rejection
      try {
        await result.current.logout();
      } catch {
        // expected - the API post was rejected
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('handleAuthCallback sets user on success', async () => {
    mockedGet.mockRejectedValue(new Error('401'));
    const mockUser = {
      id: '1', email: 'test@test.com', firstName: 'John',
      lastName: 'Doe', linkedinId: 'li-1', profilePicUrl: null,
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    };
    mockedPost.mockResolvedValue({ data: { data: mockUser } } as never);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleAuthCallback('test-code');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('handleAuthCallback throws on failure', async () => {
    mockedGet.mockRejectedValue(new Error('401'));
    mockedPost.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.handleAuthCallback('bad-code');
      }),
    ).rejects.toThrow('Authentication failed');
  });

  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('provides handleAuthCallback function', async () => {
    mockedGet.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.handleAuthCallback).toBe('function');
  });
});
