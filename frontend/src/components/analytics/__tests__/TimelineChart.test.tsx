import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import TimelineChart from '../TimelineChart';

describe('TimelineChart', () => {
  it('renders title', () => {
    render(<TimelineChart title="Timeline" data={[]} />);
    expect(screen.getByText('Timeline')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<TimelineChart title="Timeline" data={[]} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders bars for data points', () => {
    const data = [
      { date: '2026-01-01', count: 5 },
      { date: '2026-01-02', count: 10 },
    ];
    render(<TimelineChart title="Timeline" data={data} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
