import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/testUtils';
import JobDetailModal from '../JobDetailModal';
import type { Job } from '../../../types';

const mockJob: Job = {
  id: 'j1',
  linkedinJobId: 'li-j1',
  title: 'Frontend Developer',
  company: 'WebCo',
  location: 'San Francisco',
  salaryMin: 120000,
  salaryMax: 180000,
  description: 'Build amazing UIs',
  jobLevel: 'Senior',
  experienceYears: 5,
  postedAt: '2024-06-01T00:00:00Z',
  url: 'https://linkedin.com/jobs/1',
  createdAt: '2024-01-01',
};

describe('JobDetailModal', () => {
  const defaultProps = {
    job: mockJob,
    onClose: vi.fn(),
    onApply: vi.fn(),
  };

  it('renders nothing when job is null', () => {
    const { container } = render(<JobDetailModal {...defaultProps} job={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders job title', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
  });

  it('renders company and location', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText(/WebCo/)).toBeInTheDocument();
    expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
  });

  it('renders salary range', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('$120k - $180k')).toBeInTheDocument();
  });

  it('renders job level', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('Senior')).toBeInTheDocument();
  });

  it('renders experience years', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('5+ years')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('Build amazing UIs')).toBeInTheDocument();
  });

  it('renders Apply Now button', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('Apply Now')).toBeInTheDocument();
  });

  it('renders Already Applied when isApplied', () => {
    render(<JobDetailModal {...defaultProps} isApplied />);
    expect(screen.getByText('Already Applied')).toBeInTheDocument();
  });

  it('Apply button is disabled when isApplied', () => {
    render(<JobDetailModal {...defaultProps} isApplied />);
    expect(screen.getByText('Already Applied')).toBeDisabled();
  });

  it('calls onApply with job id', () => {
    render(<JobDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Apply Now'));
    expect(defaultProps.onApply).toHaveBeenCalledWith('j1');
  });

  it('calls onClose when close button clicked', () => {
    render(<JobDetailModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    render(<JobDetailModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders View on LinkedIn link when url exists', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByText('View on LinkedIn')).toBeInTheDocument();
  });

  it('hides View on LinkedIn when no url', () => {
    const jobNoUrl = { ...mockJob, url: '' };
    render(<JobDetailModal {...defaultProps} job={jobNoUrl} />);
    expect(screen.queryByText('View on LinkedIn')).not.toBeInTheDocument();
  });

  it('has dialog role', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    render(<JobDetailModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
