import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with status role', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible loading text', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies size class', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('h-12')).toBe(true);
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="mt-4" />);
    const wrapper = screen.getByRole('status');
    expect(wrapper.classList.contains('mt-4')).toBe(true);
  });
});
