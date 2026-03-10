import { useState, useEffect } from 'react';
import ProfileForm from '../components/settings/ProfileForm';
import PreferencesForm from '../components/settings/PreferencesForm';
import ResumeUpload from '../components/settings/ResumeUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { settingsService } from '../services/settingsService';
import type { UserPreferences } from '../types';

const defaultPreferences: UserPreferences = {
  id: '',
  userId: '',
  autoApplyEnabled: true,
  targetRoles: [],
  targetLocations: [],
  minSalary: null,
  maxSalary: null,
  experienceLevel: [],
  excludedCompanies: [],
  applyIntervalMinutes: 60,
  notificationEnabled: true,
  emailNotifications: true,
  pushNotifications: false,
  dailyLimit: 20,
};

function SettingsPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await settingsService.getPreferences();
        setPreferences(prefs);
      } catch {
        setPreferences(defaultPreferences);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
  }, []);

  if (isLoading) {
    return <LoadingSpinner size="lg" className="py-12" />;
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h2>

      <div className="space-y-6">
        {user && (
          <ProfileForm
            initialData={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            }}
            onSave={async (data) => {
              await settingsService.updateProfile(data);
            }}
          />
        )}

        <ResumeUpload />

        {preferences && (
          <PreferencesForm
            initialData={preferences}
            onSave={async (data) => {
              const updated = await settingsService.updatePreferences(data);
              setPreferences(updated);
            }}
          />
        )}

        <div className="card border-red-200 dark:border-red-800">
          <h3 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Permanently delete your account and all associated data.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Are you sure? This action cannot be undone.')) {
                settingsService.deleteAccount();
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
