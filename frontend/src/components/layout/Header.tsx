import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationBadge from '../common/NotificationBadge';

interface HeaderProps {
  onMenuToggle: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 md:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 md:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white md:hidden">
          Quickhire
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <NotificationBadge count={0} className="absolute -right-1 -top-1" />
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 md:flex">
              {user.profilePicUrl && (
                <img
                  src={user.profilePicUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {user.firstName} {user.lastName}
              </span>
            </div>
            <button onClick={logout} className="btn-secondary text-sm">
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
