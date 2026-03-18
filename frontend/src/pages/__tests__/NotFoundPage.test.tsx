import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/testUtils';
import NotFoundPage from '../NotFoundPage';

describe('NotFoundPage', () => {
  it('renders 404 message', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('has a link back to dashboard', () => {
    render(<NotFoundPage />);
    const link = screen.getByText('Go to Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });
});
