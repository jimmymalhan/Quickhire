import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import PageLoader from '../PageLoader';

describe('PageLoader', () => {
  it('renders loading spinner', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders loading text', () => {
    render(<PageLoader />);
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThanOrEqual(1);
  });
});
