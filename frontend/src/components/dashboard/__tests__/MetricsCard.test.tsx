import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import MetricsCard from '../MetricsCard';

describe('MetricsCard', () => {
  it('renders title and value', () => {
    render(<MetricsCard title="Total Applied" value={42} />);
    expect(screen.getByText('Total Applied')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<MetricsCard title="Status" value="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders positive change', () => {
    render(<MetricsCard title="Applied" value={10} change={15} icon="up" />);
    expect(screen.getByText('+15%')).toBeInTheDocument();
  });

  it('renders negative change', () => {
    render(<MetricsCard title="Rejected" value={5} change={-10} icon="down" />);
    expect(screen.getByText('-10%')).toBeInTheDocument();
  });

  it('renders zero change', () => {
    render(<MetricsCard title="Same" value={7} change={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
