import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import BarChart from '../BarChart';

describe('BarChart', () => {
  it('renders title', () => {
    render(<BarChart title="Test Chart" data={[]} />);
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('renders data labels and values', () => {
    const data = [
      { label: 'Google', value: 10 },
      { label: 'Meta', value: 5 },
    ];
    render(<BarChart title="Companies" data={data} />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders progress bars with aria attributes', () => {
    const data = [{ label: 'Item', value: 7 }];
    render(<BarChart title="Test" data={data} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '7');
  });
});
