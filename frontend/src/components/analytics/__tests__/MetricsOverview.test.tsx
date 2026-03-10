import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import MetricsOverview from '../MetricsOverview';
import type { DashboardMetrics } from '../../../types';

const mockMetrics: DashboardMetrics = {
  totalApplications: 150,
  pendingApplications: 30,
  viewedApplications: 45,
  interviewsScheduled: 12,
  offersReceived: 3,
  successRate: 8.5,
};

describe('MetricsOverview', () => {
  it('renders all metric cards', () => {
    render(<MetricsOverview metrics={mockMetrics} />);
    expect(screen.getByText('Total Applied')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Offers')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
  });

  it('displays formatted values', () => {
    render(<MetricsOverview metrics={mockMetrics} />);
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('8.5%')).toBeInTheDocument();
  });
});
