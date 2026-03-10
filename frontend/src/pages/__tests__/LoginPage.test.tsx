import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    post: vi.fn(),
  },
}));

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>,
  );
}

describe('LoginPage', () => {
  it('renders login UI', async () => {
    renderLoginPage();
    // Wait for auth check to complete
    const heading = await screen.findByText('Quickhire');
    expect(heading).toBeInTheDocument();
  });

  it('renders sign in button', async () => {
    renderLoginPage();
    const button = await screen.findByText('Sign in with LinkedIn');
    expect(button).toBeInTheDocument();
  });

  it('renders description text', async () => {
    renderLoginPage();
    const desc = await screen.findByText(
      'Automate your job applications on LinkedIn',
    );
    expect(desc).toBeInTheDocument();
  });

  it('sign in button is clickable', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    const button = await screen.findByText('Sign in with LinkedIn');
    // Should not throw when clicked (redirects to LinkedIn)
    await user.click(button);
  });
});
