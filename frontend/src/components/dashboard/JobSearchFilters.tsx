import { useState } from 'react';
import { EXPERIENCE_LEVELS, SORT_OPTIONS } from '../../utils/constants';
import type { JobSearchParams } from '../../services/jobService';

interface JobSearchFiltersProps {
  onSearch: (params: JobSearchParams) => void;
  isLoading?: boolean;
}

function JobSearchFilters({ onSearch, isLoading = false }: JobSearchFiltersProps) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'relevance' | 'salary'>('newest');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      query: query || undefined,
      location: location || undefined,
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      experienceLevel: experienceLevel || undefined,
      sortBy,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card" role="search" aria-label="Job search filters">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="search-query" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            id="search-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job title, company..."
            className="input"
          />
        </div>

        <div>
          <label htmlFor="search-location" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Location
          </label>
          <input
            id="search-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, state, remote..."
            className="input"
          />
        </div>

        <div>
          <label htmlFor="search-salary" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Min Salary
          </label>
          <input
            id="search-salary"
            type="number"
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="e.g. 80000"
            className="input"
            min={0}
          />
        </div>

        <div>
          <label htmlFor="search-experience" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Experience
          </label>
          <select
            id="search-experience"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="input"
          >
            <option value="">All levels</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-by" className="text-sm text-gray-600 dark:text-gray-400">
            Sort:
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input w-auto"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search Jobs'}
        </button>
      </div>
    </form>
  );
}

export default JobSearchFilters;
