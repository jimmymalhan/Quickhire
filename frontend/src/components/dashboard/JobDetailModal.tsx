import type { Job } from '../../types';
import { formatSalary, formatDate } from '../../utils/formatters';
import { useEffect, useRef } from 'react';

interface JobDetailModalProps {
  job: Job | null;
  onClose: () => void;
  onApply: (jobId: string) => void;
  isApplied?: boolean;
}

function JobDetailModal({ job, onClose, onApply, isApplied = false }: JobDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [job, onClose]);

  useEffect(() => {
    if (job) {
      dialogRef.current?.focus();
    }
  }, [job]);

  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-detail-title"
    >
      <div
        ref={dialogRef}
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2
              id="job-detail-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {job.title}
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {job.company} &middot; {job.location}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
            {formatSalary(job.salaryMin, job.salaryMax)}
          </span>
          {job.jobLevel && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {job.jobLevel}
            </span>
          )}
          {job.experienceYears && (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {job.experienceYears}+ years
            </span>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Posted {formatDate(job.postedAt)}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            Description
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
            {job.description}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onApply(job.id)}
            disabled={isApplied}
            className={isApplied ? 'btn-secondary' : 'btn-primary'}
          >
            {isApplied ? 'Already Applied' : 'Apply Now'}
          </button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              View on LinkedIn
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobDetailModal;
