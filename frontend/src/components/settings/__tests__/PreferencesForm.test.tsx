import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/testUtils';
import userEvent from '@testing-library/user-event';
import PreferencesForm from '../PreferencesForm';
import type { UserPreferences } from '../../../types';

const initialData: UserPreferences = {
  id: 'p1',
  userId: 'u1',
  autoApplyEnabled: false,
  targetRoles: ['Engineer', 'Developer'],
  targetLocations: ['Remote'],
  minSalary: 80000,
  maxSalary: 150000,
  experienceLevel: ['Senior'],
  excludedCompanies: ['BadCorp'],
  applyIntervalMinutes: 30,
  notificationEnabled: true,
  emailNotifications: true,
  pushNotifications: false,
  dailyLimit: 20,
};

describe('PreferencesForm', () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  it('renders heading', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Job Preferences')).toBeInTheDocument();
  });

  it('renders auto-apply toggle', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Auto-Apply')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders target roles input with initial value', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText(/Target Roles/)).toHaveValue('Engineer, Developer');
  });

  it('renders target locations input', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText(/Target Locations/)).toHaveValue('Remote');
  });

  it('renders salary inputs', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText('Min Salary')).toHaveValue(80000);
    expect(screen.getByLabelText('Max Salary')).toHaveValue(150000);
  });

  it('renders experience level buttons', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Entry Level')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('Senior is pressed initially', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Senior')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Entry Level is not pressed initially', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Entry Level')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders excluded companies input', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText(/Excluded Companies/)).toHaveValue('BadCorp');
  });

  it('renders daily limit input', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByLabelText(/Daily Application Limit/)).toHaveValue(20);
  });

  it('renders email notifications toggle', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
  });

  it('renders Save Preferences button', () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    expect(screen.getByText('Save Preferences')).toBeInTheDocument();
  });

  it('calls onSave on submit', async () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    fireEvent.submit(screen.getByText('Save Preferences').closest('form')!);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows success message after save', async () => {
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);
    fireEvent.submit(screen.getByText('Save Preferences').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully.')).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    const failSave = vi.fn().mockRejectedValue(new Error('fail'));
    render(<PreferencesForm initialData={initialData} onSave={failSave} />);
    fireEvent.submit(screen.getByText('Save Preferences').closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Failed to save preferences.')).toBeInTheDocument();
    });
  });

  it('toggles experience level on click', async () => {
    const user = userEvent.setup();
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);

    await user.click(screen.getByText('Lead'));
    expect(screen.getByText('Lead')).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles auto-apply switch', async () => {
    const user = userEvent.setup();
    render(<PreferencesForm initialData={initialData} onSave={onSave} />);

    const toggle = screen.getAllByRole('switch')[0];
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
