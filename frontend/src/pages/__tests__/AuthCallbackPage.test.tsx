import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCallbackPage from '../AuthCallbackPage';

const mockNavigate = vi.fn();
const mockHandleAuthCallback = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    handleAuthCallback: mockHandleAuthCallback,
    isAuthenticated: false,
    isLoading: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner with auth code', () => {
    mockHandleAuthCallback.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Completing sign in...')).toBeInTheDocument();
  });

  it('shows error when no code in URL', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('No authorization code received')).toBeInTheDocument();
  });

  it('shows error when error param present', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?error=access_denied']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('LinkedIn authentication was denied')).toBeInTheDocument();
  });

  it('shows Back to Login button on error', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?error=denied']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
  });

  it('has alert role on error', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?error=denied']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls handleAuthCallback with code', async () => {
    mockHandleAuthCallback.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=abc123']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockHandleAuthCallback).toHaveBeenCalledWith('abc123');
    });
  });

  it('navigates to / on success', async () => {
    mockHandleAuthCallback.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=abc123']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows error on auth failure', async () => {
    mockHandleAuthCallback.mockRejectedValue(new Error('fail'));
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=bad-code']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows Authentication Error heading on failure', async () => {
    mockHandleAuthCallback.mockRejectedValue(new Error('fail'));
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=bad']}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    });
  });
});
