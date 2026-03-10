export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Quickhire';

export const APPLICATION_STATUSES = [
  'pending',
  'submitted',
  'viewed',
  'rejected',
  'archived',
] as const;

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'salary', label: 'Highest Salary' },
] as const;

export const EXPERIENCE_LEVELS = [
  'Entry Level',
  'Mid Level',
  'Senior',
  'Lead',
  'Director',
  'Executive',
] as const;

export const PAGE_SIZES = [10, 20, 50, 100] as const;

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/applications', label: 'Applications', icon: 'briefcase' },
  { path: '/analytics', label: 'Analytics', icon: 'chart' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
] as const;
