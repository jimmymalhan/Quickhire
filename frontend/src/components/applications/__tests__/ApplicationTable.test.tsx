import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/testUtils';
import ApplicationTable from '../ApplicationTable';
import type { Application } from '../../../types';

const mockApplications: Application[] = [
  {
    id: 'a1',
    userId: 'u1',
    jobId: 'j1',
    job: { id: 'j1', linkedinJobId: 'li-1', title: 'Engineer', company: 'Google', location: 'Remote', salaryMin: null, salaryMax: null, description: '', jobLevel: '', experienceYears: null, postedAt: '', url: '', createdAt: '' },
    status: 'pending',
    appliedAt: '2024-06-01T00:00:00Z',
    responseReceivedAt: null,
    submissionAttempts: 1,
    errorMessage: null,
    resumeVersion: 1,
    createdAt: '2024-06-01',
    updatedAt: '2024-06-01',
  },
  {
    id: 'a2',
    userId: 'u1',
    jobId: 'j2',
    job: { id: 'j2', linkedinJobId: 'li-2', title: 'Designer', company: 'Meta', location: 'NYC', salaryMin: null, salaryMax: null, description: '', jobLevel: '', experienceYears: null, postedAt: '', url: '', createdAt: '' },
    status: 'submitted',
    appliedAt: null,
    responseReceivedAt: null,
    submissionAttempts: 2,
    errorMessage: null,
    resumeVersion: 1,
    createdAt: '2024-06-02',
    updatedAt: '2024-06-02',
  },
];

describe('ApplicationTable', () => {
  const defaultProps = {
    applications: mockApplications,
    onViewDetail: vi.fn(),
    onBulkAction: vi.fn(),
  };

  it('renders table with grid role', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('Job')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Attempts')).toBeInTheDocument();
  });

  it('renders job titles', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('Engineer')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();
  });

  it('renders company names', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Meta')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });

  it('renders submission attempts', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders -- for null appliedAt', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('calls onViewDetail when job title clicked', () => {
    render(<ApplicationTable {...defaultProps} />);
    fireEvent.click(screen.getByText('Engineer'));
    expect(defaultProps.onViewDetail).toHaveBeenCalledWith(mockApplications[0]);
  });

  it('renders select-all checkbox', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByLabelText('Select all applications')).toBeInTheDocument();
  });

  it('renders per-row checkboxes', () => {
    render(<ApplicationTable {...defaultProps} />);
    expect(screen.getByLabelText('Select application Engineer')).toBeInTheDocument();
    expect(screen.getByLabelText('Select application Designer')).toBeInTheDocument();
  });

  it('shows bulk actions when items selected', () => {
    render(<ApplicationTable {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Select application Engineer'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('select all selects all rows', () => {
    render(<ApplicationTable {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Select all applications'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('calls onBulkAction with archive', () => {
    render(<ApplicationTable {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Select all applications'));
    fireEvent.click(screen.getByText('Archive'));
    expect(defaultProps.onBulkAction).toHaveBeenCalledWith('archive', ['a1', 'a2']);
  });

  it('shows Unknown Position when job is missing', () => {
    const appsNoJob: Application[] = [{
      ...mockApplications[0],
      job: undefined,
    }];
    render(<ApplicationTable {...defaultProps} applications={appsNoJob} />);
    expect(screen.getByText('Unknown Position')).toBeInTheDocument();
  });
});
