import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/testUtils';
import userEvent from '@testing-library/user-event';
import ApplicationFilters from '../ApplicationFilters';

describe('ApplicationFilters', () => {
  const onFilter = vi.fn();

  it('renders filter form', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByLabelText('Application filters')).toBeInTheDocument();
  });

  it('renders status select', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('renders company input', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByLabelText('Company')).toBeInTheDocument();
  });

  it('renders date range inputs', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('renders Apply Filters button', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
  });

  it('renders Reset button', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(<ApplicationFilters onFilter={onFilter} isLoading />);
    expect(screen.getByText('Apply Filters')).toBeDisabled();
  });

  it('calls onFilter on submit', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    fireEvent.submit(screen.getByLabelText('Application filters'));
    expect(onFilter).toHaveBeenCalled();
  });

  it('calls onFilter with empty params on reset', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    fireEvent.click(screen.getByText('Reset'));
    expect(onFilter).toHaveBeenCalledWith({});
  });

  it('has all status options', () => {
    render(<ApplicationFilters onFilter={onFilter} />);
    expect(screen.getByText('All statuses')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });

  it('submits with selected status', async () => {
    const user = userEvent.setup();
    render(<ApplicationFilters onFilter={onFilter} />);

    await user.selectOptions(screen.getByLabelText('Status'), 'pending');
    await user.click(screen.getByText('Apply Filters'));

    expect(onFilter).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });
});
