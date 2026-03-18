import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../utils/constants';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function MobileNav({ isOpen, onClose }: MobileNavProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close navigation"
      />
      <aside
        className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg dark:bg-gray-800 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <span className="text-xl font-bold text-primary-600">Quickhire</span>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="space-y-1 px-3 py-4" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default MobileNav;
