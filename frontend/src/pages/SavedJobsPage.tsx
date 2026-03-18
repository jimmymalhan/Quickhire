import { useState, useCallback } from 'react';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import AutoApplyPanel from '../components/savedJobs/AutoApplyPanel';
import { useSavedJobs } from '../hooks/useSavedJobs';
import { useAutoApply } from '../hooks/useAutoApply';
import type {
  SavedJob,
  SavedJobPriority,
  SavedJobStatus,
  SavedJobFilters,
} from '../types/savedJobs';

const PRIORITY_COLORS: Record<SavedJobPriority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

function SavedJobsPage() {
  const {
    savedJobs,
    stats,
    isLoading,
    error,
    hasLoaded,
    currentPage,
    totalPages,
    applyFilters,
    changePage,
    updateSavedJob,
    removeSavedJob,
    refresh,
  } = useSavedJobs();

  const autoApply = useAutoApply();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showConfirmApply, setShowConfirmApply] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SavedJobStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<SavedJobPriority | ''>('');
  const [sortBy, setSortBy] = useState<SavedJobFilters['sortBy']>('savedAt');

  const handleFilterChange = useCallback(() => {
    const filters: SavedJobFilters = { sortBy };
    if (filterStatus) filters.status = filterStatus;
    if (filterPriority) filters.priority = filterPriority;
    applyFilters(filters);
  }, [filterStatus, filterPriority, sortBy, applyFilters]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === savedJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(savedJobs.map((j) => j.id)));
    }
  }, [savedJobs, selectedIds.size]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handlePriorityChange = useCallback(
    (id: string, priority: SavedJobPriority) => {
      updateSavedJob(id, { priority });
    },
    [updateSavedJob],
  );

  const handleSaveNote = useCallback(
    (id: string) => {
      updateSavedJob(id, { notes: noteText } as never);
      setEditingNoteId(null);
      setNoteText('');
    },
    [noteText, updateSavedJob],
  );

  const handleStartNoteEdit = useCallback((job: SavedJob) => {
    setEditingNoteId(job.id);
    setNoteText(job.notes);
  }, []);

  const handleBulkApply = useCallback(async () => {
    setShowConfirmApply(false);
    const jobIds = Array.from(selectedIds);
    const success = await autoApply.start(jobIds);
    if (success) {
      setSelectedIds(new Set());
    }
  }, [selectedIds, autoApply]);

  const handleAutoApplyComplete = useCallback(() => {
    autoApply.reset();
    refresh();
  }, [autoApply, refresh]);

  const selectedSavedJobs = savedJobs.filter((j) =>
    j.status === 'saved' && selectedIds.has(j.id),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Saved Jobs
        </h2>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowConfirmApply(true)}
            disabled={autoApply.isRunning || autoApply.isStarting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            Apply to {selectedSavedJobs.length} Selected
          </button>
        )}
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalSaved}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Saved</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.applied}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Applied</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-500">
              {stats.skipped}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Skipped</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.highPriority}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">High Priority</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.mediumPriority}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Medium</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-500">
              {stats.lowPriority}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Low</p>
          </div>
        </div>
      )}

      {/* Auto-apply progress */}
      <AutoApplyPanel
        progress={autoApply.progress}
        percentComplete={autoApply.percentComplete}
        isStarting={autoApply.isStarting}
        onPause={autoApply.pause}
        onResume={autoApply.resume}
        onCancel={autoApply.cancel}
        onReset={handleAutoApplyComplete}
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as SavedJobStatus | '')}
          className="input-field w-auto min-w-[140px] text-sm"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
          <option value="skipped">Skipped</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as SavedJobPriority | '')}
          className="input-field w-auto min-w-[140px] text-sm"
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SavedJobFilters['sortBy'])}
          className="input-field w-auto min-w-[140px] text-sm"
          aria-label="Sort by"
        >
          <option value="savedAt">Date Saved</option>
          <option value="priority">Priority</option>
          <option value="company">Company</option>
          <option value="title">Title</option>
        </select>

        <button
          onClick={handleFilterChange}
          className="btn-primary px-4 py-2 text-sm"
        >
          Apply Filters
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          <p>{error}</p>
          <button
            onClick={refresh}
            className="mt-1 text-sm font-medium underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Job list */}
      <section aria-label="Saved jobs list">
        {isLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : hasLoaded && savedJobs.length === 0 ? (
          <EmptyState
            title="No saved jobs found"
            description="Try adjusting your filters or save some jobs from the dashboard."
          />
        ) : savedJobs.length > 0 ? (
          <div className="card p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === savedJobs.length && savedJobs.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      aria-label="Select all jobs"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                    Job
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                    Priority
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 xl:table-cell">
                    Notes
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 lg:table-cell">
                    Saved
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {savedJobs.map((savedJob) => (
                  <tr
                    key={savedJob.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      selectedIds.has(savedJob.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(savedJob.id)}
                        onChange={() => handleToggleSelect(savedJob.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select ${savedJob.job.title}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {savedJob.job.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {savedJob.job.company} &middot; {savedJob.job.location}
                        </p>
                        {savedJob.job.salaryMin && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            ${savedJob.job.salaryMin.toLocaleString()}
                            {savedJob.job.salaryMax
                              ? ` - $${savedJob.job.salaryMax.toLocaleString()}`
                              : '+'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <select
                        value={savedJob.priority}
                        onChange={(e) =>
                          handlePriorityChange(
                            savedJob.id,
                            e.target.value as SavedJobPriority,
                          )
                        }
                        className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[savedJob.priority]}`}
                        aria-label={`Priority for ${savedJob.job.title}`}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <StatusBadge status={savedJob.status} />
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      {editingNoteId === savedJob.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNote(savedJob.id);
                              if (e.key === 'Escape') setEditingNoteId(null);
                            }}
                            className="input-field py-1 text-xs"
                            autoFocus
                            aria-label="Edit note"
                          />
                          <button
                            onClick={() => handleSaveNote(savedJob.id)}
                            className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                            aria-label="Save note"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartNoteEdit(savedJob)}
                          className="max-w-[200px] truncate text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={savedJob.notes || 'Add a note'}
                        >
                          {savedJob.notes || 'Add note...'}
                        </button>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 dark:text-gray-400 lg:table-cell">
                      {new Date(savedJob.savedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={savedJob.job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                          aria-label={`View ${savedJob.job.title} on LinkedIn`}
                          title="View on LinkedIn"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        <button
                          onClick={() => removeSavedJob(savedJob.id)}
                          className="rounded p-1.5 text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${savedJob.job.title}`}
                          title="Remove"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Save jobs you want to apply to"
            description="Browse jobs on the dashboard and save the ones that interest you. You can then review and bulk-apply from here."
            action={
              <a href="/" className="btn-primary">
                Browse Jobs
              </a>
            }
          />
        )}

        {savedJobs.length > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
            />
          </div>
        )}
      </section>

      {/* Confirm bulk apply modal */}
      {showConfirmApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Confirm Auto-Apply
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              You are about to auto-apply to{' '}
              <strong>{selectedSavedJobs.length}</strong> saved job
              {selectedSavedJobs.length !== 1 ? 's' : ''}. This will submit
              applications on your behalf.
            </p>
            <ul className="mb-4 max-h-40 space-y-1 overflow-y-auto text-sm text-gray-600 dark:text-gray-400">
              {selectedSavedJobs.slice(0, 10).map((j) => (
                <li key={j.id} className="truncate">
                  {j.job.title} at {j.job.company}
                </li>
              ))}
              {selectedSavedJobs.length > 10 && (
                <li className="text-gray-400">
                  ...and {selectedSavedJobs.length - 10} more
                </li>
              )}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmApply(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApply}
                disabled={autoApply.isStarting}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {autoApply.isStarting ? 'Starting...' : 'Start Auto-Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SavedJobsPage;
