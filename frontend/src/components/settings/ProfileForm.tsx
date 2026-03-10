import { useState } from 'react';

interface ProfileFormProps {
  initialData: {
    firstName: string;
    lastName: string;
    email: string;
  };
  onSave: (data: { firstName: string; lastName: string; email: string }) => Promise<void>;
}

function ProfileForm({ initialData, onSave }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initialData.firstName);
  const [lastName, setLastName] = useState(initialData.lastName);
  const [email, setEmail] = useState(initialData.email);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      await onSave({ firstName, lastName, email });
      setMessage('Profile updated successfully.');
    } catch {
      setMessage('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Profile
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="profile-first-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            First Name
          </label>
          <input
            id="profile-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label htmlFor="profile-last-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Last Name
          </label>
          <input
            id="profile-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="input"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </div>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`} role="status">
          {message}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4" disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}

export default ProfileForm;
