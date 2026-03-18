import { useState } from 'react';
import type { Application } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { formatDate } from '../../utils/formatters';

interface ApplicationTableProps {
  applications: Application[];
  onViewDetail: (app: Application) => void;
  onBulkAction: (action: 'archive' | 'retry', ids: string[]) => void;
}

function ApplicationTable({
  applications,
  onViewDetail,
  onBulkAction,
}: ApplicationTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)));
    }
  };

  const selectedArray = Array.from(selectedIds);

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => onBulkAction('archive', selectedArray)}
            className="btn-secondary text-xs"
          >
            Archive
          </button>
          <button
            onClick={() => onBulkAction('retry', selectedArray)}
            className="btn-secondary text-xs"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" role="grid">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3" scope="col">
                <input
                  type="checkbox"
                  checked={selectedIds.size === applications.length && applications.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all applications"
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400" scope="col">Job</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400" scope="col">Company</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400" scope="col">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400" scope="col">Applied</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400" scope="col">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr
                key={app.id}
                className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(app.id)}
                    onChange={() => toggleSelect(app.id)}
                    aria-label={`Select application ${app.job?.title || app.id}`}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewDetail(app)}
                    className="font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                  >
                    {app.job?.title || 'Unknown Position'}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {app.job?.company || '--'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {app.appliedAt ? formatDate(app.appliedAt) : '--'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {app.submissionAttempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApplicationTable;
