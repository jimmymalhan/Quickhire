import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/testUtils';
import MobileNav from '../MobileNav';

describe('MobileNav', () => {
  const onClose = vi.fn();

  it('renders nothing when closed', () => {
    const { container } = render(<MobileNav isOpen={false} onClose={onClose} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nav when open', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByLabelText('Mobile navigation', { selector: 'aside' })).toBeInTheDocument();
  });

  it('renders Quickhire branding', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByText('Quickhire')).toBeInTheDocument();
  });

  it('renders nav links', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close menu'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay clicked', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close navigation'));
    expect(onClose).toHaveBeenCalled();
  });

  it('has dialog role on aside', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when nav link clicked', () => {
    render(<MobileNav isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Dashboard'));
    expect(onClose).toHaveBeenCalled();
  });
});
