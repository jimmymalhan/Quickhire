import { useState } from 'react';
import type { UserPreferences } from '../../types';
import { EXPERIENCE_LEVELS } from '../../utils/constants';

interface PreferencesFormProps {
  initialData: UserPreferences;
  onSave: (data: Partial<UserPreferences>) => Promise<void>;
}

function PreferencesForm({ initialData, onSave }: PreferencesFormProps) {
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(initialData.autoApplyEnabled);
  const [targetRoles, setTargetRoles] = useState(initialData.targetRoles.join(', '));
  const [targetLocations, setTargetLocations] = useState(initialData.targetLocations.join(', '));
  const [minSalary, setMinSalary] = useState(initialData.minSalary?.toString() || '');
  const [maxSalary, setMaxSalary] = useState(initialData.maxSalary?.toString() || '');
  const [experienceLevel, setExperienceLevel] = useState(initialData.experienceLevel);
  const [excludedCompanies, setExcludedCompanies] = useState(initialData.excludedCompanies.join(', '));
  const [dailyLimit, setDailyLimit] = useState(initialData.dailyLimit.toString());
  const [emailNotifications, setEmailNotifications] = useState(initialData.emailNotifications);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await onSave({
        autoApplyEnabled,
        targetRoles: targetRoles.split(',').map((s) => s.trim()).filter(Boolean),
        targetLocations: targetLocations.split(',').map((s) => s.trim()).filter(Boolean),
        minSalary: minSalary ? Number(minSalary) : null,
        maxSalary: maxSalary ? Number(maxSalary) : null,
        experienceLevel,
        excludedCompanies: excludedCompanies.split(',').map((s) => s.trim()).filter(Boolean),
        dailyLimit: Number(dailyLimit) || 20,
        emailNotifications,
      });
      setMessage('Preferences saved successfully.');
    } catch {
      setMessage('Failed to save preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExperienceLevel = (level: string) => {
    setExperienceLevel((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Job Preferences
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Auto-Apply</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically apply to matching jobs
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoApplyEnabled}
            onClick={() => setAutoApplyEnabled(!autoApplyEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoApplyEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoApplyEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label htmlFor="pref-roles" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Target Roles (comma-separated)
          </label>
          <input
            id="pref-roles"
            type="text"
            value={targetRoles}
            onChange={(e) => setTargetRoles(e.target.value)}
            placeholder="Software Engineer, Frontend Developer..."
            className="input"
          />
        </div>

        <div>
          <label htmlFor="pref-locations" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Target Locations (comma-separated)
          </label>
          <input
            id="pref-locations"
            type="text"
            value={targetLocations}
            onChange={(e) => setTargetLocations(e.target.value)}
            placeholder="San Francisco, Remote, New York..."
            className="input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pref-min-salary" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Min Salary
            </label>
            <input
              id="pref-min-salary"
              type="number"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="80000"
              className="input"
              min={0}
            />
          </div>
          <div>
            <label htmlFor="pref-max-salary" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Salary
            </label>
            <input
              id="pref-max-salary"
              type="number"
              value={maxSalary}
              onChange={(e) => setMaxSalary(e.target.value)}
              placeholder="200000"
              className="input"
              min={0}
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Experience Level
          </legend>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleExperienceLevel(level)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  experienceLevel.includes(level)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
                aria-pressed={experienceLevel.includes(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="pref-excluded" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Excluded Companies (comma-separated)
          </label>
          <input
            id="pref-excluded"
            type="text"
            value={excludedCompanies}
            onChange={(e) => setExcludedCompanies(e.target.value)}
            placeholder="Company A, Company B..."
            className="input"
          />
        </div>

        <div>
          <label htmlFor="pref-daily-limit" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Daily Application Limit
          </label>
          <input
            id="pref-daily-limit"
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="input w-32"
            min={1}
            max={100}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Receive email updates about applications
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailNotifications}
            onClick={() => setEmailNotifications(!emailNotifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              emailNotifications ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                emailNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`} role="status">
          {message}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Preferences'}
      </button>
    </form>
  );
}

export default PreferencesForm;
