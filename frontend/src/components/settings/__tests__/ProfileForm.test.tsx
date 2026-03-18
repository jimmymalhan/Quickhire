import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/testUtils';
import userEvent from '@testing-library/user-event';
import ProfileForm from '../ProfileForm';

const initialData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
};

describe('ProfileForm', () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  it('renders profile heading', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders first name input with initial value', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText('First Name')).toHaveValue('John');
  });

  it('renders last name input with initial value', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
  });

  it('renders email input with initial value', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText('Email')).toHaveValue('john@example.com');
  });

  it('renders Save Profile button', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Save Profile')).toBeInTheDocument();
  });

  it('calls onSave with form data on submit', async () => {
    const user = userEvent.setup();
    render(<ProfileForm initialData={initialData} onSave={onSave} />);

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Jane');
    await user.click(screen.getByText('Save Profile'));

    expect(onSave).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'john@example.com',
    });
  });

  it('shows success message after save', async () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    fireEvent.submit(screen.getByText('Save Profile').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully.')).toBeInTheDocument();
    });
  });

  it('shows error message on save failure', async () => {
    const failSave = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ProfileForm initialData={initialData} onSave={failSave} />);
    fireEvent.submit(screen.getByText('Save Profile').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to update profile.')).toBeInTheDocument();
    });
  });

  it('shows Saving... while submitting', async () => {
    let resolve: () => void;
    const slowSave = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<ProfileForm initialData={initialData} onSave={slowSave} />);
    fireEvent.submit(screen.getByText('Save Profile').closest('form')!);

    expect(screen.getByText('Saving...')).toBeInTheDocument();

    resolve!();
    await waitFor(() => {
      expect(screen.getByText('Save Profile')).toBeInTheDocument();
    });
  });

  it('has required fields', () => {
    render(<ProfileForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText('First Name')).toBeRequired();
    expect(screen.getByLabelText('Last Name')).toBeRequired();
    expect(screen.getByLabelText('Email')).toBeRequired();
  });
});
