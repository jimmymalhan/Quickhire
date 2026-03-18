import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../context/AuthContext';

const mockedUseAuth = vi.mocked(useAuth);

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      handleAuthCallback: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      handleAuthCallback: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    mockedUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      handleAuthCallback: vi.fn(),
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Content</div>
      </ProtectedRoute>,
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
