import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/testUtils';
import userEvent from '@testing-library/user-event';
import JobSearchFilters from '../JobSearchFilters';

describe('JobSearchFilters', () => {
  const onSearch = vi.fn();

  it('renders search form', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('renders location input', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
  });

  it('renders salary input', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByLabelText('Min Salary')).toBeInTheDocument();
  });

  it('renders experience select', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByLabelText('Experience')).toBeInTheDocument();
  });

  it('renders sort select', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByLabelText('Sort:')).toBeInTheDocument();
  });

  it('renders Search Jobs button', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByText('Search Jobs')).toBeInTheDocument();
  });

  it('shows Searching... when loading', () => {
    render(<JobSearchFilters onSearch={onSearch} isLoading />);
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(<JobSearchFilters onSearch={onSearch} isLoading />);
    expect(screen.getByText('Searching...')).toBeDisabled();
  });

  it('calls onSearch on form submit', async () => {
    const user = userEvent.setup();
    render(<JobSearchFilters onSearch={onSearch} />);

    await user.type(screen.getByLabelText('Search'), 'engineer');
    await user.click(screen.getByText('Search Jobs'));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'engineer' }),
    );
  });

  it('passes undefined for empty fields', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    fireEvent.submit(screen.getByRole('search'));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: undefined,
        location: undefined,
        salaryMin: undefined,
        experienceLevel: undefined,
      }),
    );
  });

  it('has experience level options', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByText('All levels')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
  });

  it('has sort options', () => {
    render(<JobSearchFilters onSearch={onSearch} />);
    expect(screen.getByText('Newest First')).toBeInTheDocument();
    expect(screen.getByText('Most Relevant')).toBeInTheDocument();
    expect(screen.getByText('Highest Salary')).toBeInTheDocument();
  });
});
