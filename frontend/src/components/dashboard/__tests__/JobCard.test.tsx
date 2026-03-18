import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import userEvent from '@testing-library/user-event';
import JobCard from '../JobCard';
import type { Job } from '../../../types';

const mockJob: Job = {
  id: 'j1',
  linkedinJobId: 'li-j1',
  title: 'Software Engineer',
  company: 'TechCorp',
  location: 'Remote',
  salaryMin: 100000,
  salaryMax: 150000,
  description: 'Great role',
  jobLevel: 'Senior',
  experienceYears: 5,
  postedAt: new Date().toISOString(),
  url: 'https://linkedin.com/jobs/1',
  createdAt: '2024-01-01',
};

describe('JobCard', () => {
  const defaultProps = {
    job: mockJob,
    onApply: vi.fn(),
    onBookmark: vi.fn(),
    onViewDetails: vi.fn(),
  };

  it('renders job title', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('renders company name', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('TechCorp')).toBeInTheDocument();
  });

  it('renders location', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('Remote')).toBeInTheDocument();
  });

  it('renders salary range', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('$100k - $150k')).toBeInTheDocument();
  });

  it('renders job level', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('Senior')).toBeInTheDocument();
  });

  it('renders Quick Apply button when not applied', () => {
    render(<JobCard {...defaultProps} />);
    expect(screen.getByText('Quick Apply')).toBeInTheDocument();
  });

  it('renders Applied button when applied', () => {
    render(<JobCard {...defaultProps} isApplied />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('Apply button is disabled when applied', () => {
    render(<JobCard {...defaultProps} isApplied />);
    expect(screen.getByText('Applied')).toBeDisabled();
  });

  it('calls onApply with job id', async () => {
    const user = userEvent.setup();
    render(<JobCard {...defaultProps} />);
    await user.click(screen.getByText('Quick Apply'));
    expect(defaultProps.onApply).toHaveBeenCalledWith('j1');
  });

  it('calls onBookmark with job id', async () => {
    const user = userEvent.setup();
    render(<JobCard {...defaultProps} />);
    await user.click(screen.getByLabelText('Bookmark job'));
    expect(defaultProps.onBookmark).toHaveBeenCalledWith('j1');
  });

  it('calls onViewDetails with job', async () => {
    const user = userEvent.setup();
    render(<JobCard {...defaultProps} />);
    await user.click(screen.getByText('Software Engineer'));
    expect(defaultProps.onViewDetails).toHaveBeenCalledWith(mockJob);
  });

  it('shows Remove bookmark label when bookmarked', () => {
    render(<JobCard {...defaultProps} isBookmarked />);
    expect(screen.getByLabelText('Remove bookmark')).toBeInTheDocument();
  });

  it('hides salary when not specified', () => {
    const jobNoSalary = { ...mockJob, salaryMin: null, salaryMax: null };
    render(<JobCard {...defaultProps} job={jobNoSalary} />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('hides location when empty', () => {
    const jobNoLocation = { ...mockJob, location: '' };
    render(<JobCard {...defaultProps} job={jobNoLocation} />);
    // Remote text should not appear
    expect(screen.queryByText('Remote')).not.toBeInTheDocument();
  });

  it('hides job level when empty', () => {
    const jobNoLevel = { ...mockJob, jobLevel: '' };
    render(<JobCard {...defaultProps} job={jobNoLevel} />);
    expect(screen.queryByText('Senior')).not.toBeInTheDocument();
  });
});
