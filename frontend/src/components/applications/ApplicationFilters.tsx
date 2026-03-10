import { useState } from 'react';
import { APPLICATION_STATUSES } from '../../utils/constants';
import type { ApplicationSearchParams } from '../../services/applicationService';

interface ApplicationFiltersProps {
  onFilter: (params: ApplicationSearchParams) => void;
  isLoading?: boolean;
}

function ApplicationFilters({ onFilter, isLoading = false }: ApplicationFiltersProps) {
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({
      status: status ? (status as ApplicationSearchParams['status']) : undefined,
      company: company || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  const handleReset = () => {
    setStatus('');
    setCompany('');
    setDateFrom('');
    setDateTo('');
    onFilter({});
  };

  return (
    <form onSubmit={handleSubmit} className="card" aria-label="Application filters">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="filter-status" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-company" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Company
          </label>
          <input
            id="filter-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Filter by company..."
            className="input"
          />
        </div>

        <div>
          <label htmlFor="filter-date-from" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            From
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="filter-date-to" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            To
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn-primary" disabled={isLoading}>
          Apply Filters
        </button>
        <button type="button" onClick={handleReset} className="btn-secondary">
          Reset
        </button>
      </div>
    </form>
  );
}

export default ApplicationFilters;
