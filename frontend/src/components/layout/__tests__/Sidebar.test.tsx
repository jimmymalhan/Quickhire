import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  it('renders Quickhire branding', () => {
    render(<Sidebar />);
    expect(screen.getByText('Quickhire')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('has main navigation aria label', () => {
    render(<Sidebar />);
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument();
  });

  it('renders nav links with correct href', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/');
    expect(screen.getByText('Applications').closest('a')).toHaveAttribute('href', '/applications');
    expect(screen.getByText('Analytics').closest('a')).toHaveAttribute('href', '/analytics');
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
  });
});
