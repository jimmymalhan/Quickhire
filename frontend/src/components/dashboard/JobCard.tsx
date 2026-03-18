import type { Job } from '../../types';
import { formatSalary, formatRelativeTime } from '../../utils/formatters';

interface JobCardProps {
  job: Job;
  onApply: (jobId: string) => void;
  onBookmark: (jobId: string) => void;
  onViewDetails: (job: Job) => void;
  isBookmarked?: boolean;
  isApplied?: boolean;
}

function JobCard({
  job,
  onApply,
  onBookmark,
  onViewDetails,
  isBookmarked = false,
  isApplied = false,
}: JobCardProps) {
  return (
    <article className="card transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onViewDetails(job)}
            className="text-left"
          >
            <h3 className="truncate text-base font-semibold text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400">
              {job.title}
            </h3>
          </button>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {job.company}
          </p>
        </div>
        <button
          onClick={() => onBookmark(job.id)}
          className="ml-2 flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-yellow-500"
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark job'}
        >
          <svg
            className="h-5 w-5"
            fill={isBookmarked ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {job.location && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {job.location}
          </span>
        )}
        {(job.salaryMin || job.salaryMax) && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
            {formatSalary(job.salaryMin, job.salaryMax)}
          </span>
        )}
        {job.jobLevel && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {job.jobLevel}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <time
          className="text-xs text-gray-500 dark:text-gray-400"
          dateTime={job.postedAt}
        >
          {formatRelativeTime(job.postedAt)}
        </time>
        <button
          onClick={() => onApply(job.id)}
          disabled={isApplied}
          className={isApplied ? 'btn-secondary cursor-default text-xs' : 'btn-primary text-xs'}
        >
          {isApplied ? 'Applied' : 'Quick Apply'}
        </button>
      </div>
    </article>
  );
}

export default JobCard;
