import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('applies correct color for submitted status', () => {
    render(<StatusBadge status="submitted" />);
    const badge = screen.getByText('submitted');
    expect(badge.className).toContain('bg-blue-100');
  });

  it('applies correct color for rejected status', () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText('rejected');
    expect(badge.className).toContain('bg-red-100');
  });

  it('falls back to pending color for unknown status', () => {
    render(<StatusBadge status="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge.className).toContain('bg-yellow-100');
  });

  it('applies custom className', () => {
    render(<StatusBadge status="viewed" className="ml-2" />);
    const badge = screen.getByText('viewed');
    expect(badge.className).toContain('ml-2');
  });
});
