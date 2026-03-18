import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import NotificationBadge from '../NotificationBadge';

describe('NotificationBadge', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for negative count', () => {
    const { container } = render(<NotificationBadge count={-1} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the count', () => {
    render(<NotificationBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ for large counts', () => {
    render(<NotificationBadge count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<NotificationBadge count={3} />);
    expect(screen.getByLabelText('3 notifications')).toBeInTheDocument();
  });
});
