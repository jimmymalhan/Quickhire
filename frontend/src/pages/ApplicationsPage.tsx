import { useState, useCallback } from 'react';
import ApplicationFilters from '../components/applications/ApplicationFilters';
import ApplicationTable from '../components/applications/ApplicationTable';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Application } from '../types';
import {
  applicationService,
  type ApplicationSearchParams,
} from '../services/applicationService';

function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filterParams, setFilterParams] = useState<ApplicationSearchParams>({});

  const loadApplications = useCallback(
    async (params: ApplicationSearchParams, page = 1) => {
      setIsLoading(true);
      setHasLoaded(true);
      try {
        const response = await applicationService.getApplications({
          ...params,
          page,
          pageSize: 20,
        });
        setApplications(response.data || []);
        setTotalPages(
          response.meta
            ? Math.ceil(response.meta.total / response.meta.pageSize)
            : 0,
        );
        setCurrentPage(page);
      } catch {
        setApplications([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleFilter = useCallback(
    (params: ApplicationSearchParams) => {
      setFilterParams(params);
      loadApplications(params, 1);
    },
    [loadApplications],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      loadApplications(filterParams, page);
    },
    [filterParams, loadApplications],
  );

  const handleBulkAction = useCallback(
    async (action: 'archive' | 'retry', ids: string[]) => {
      try {
        if (action === 'archive') {
          await applicationService.bulkArchive(ids);
        } else {
          await applicationService.bulkRetry(ids);
        }
        loadApplications(filterParams, currentPage);
      } catch {
        // Error handling will be improved
      }
    },
    [filterParams, currentPage, loadApplications],
  );

  const handleExport = useCallback(async () => {
    try {
      const blob = await applicationService.exportCsv(filterParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `applications-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handling will be improved
    }
  }, [filterParams]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Applications
        </h2>
        <button onClick={handleExport} className="btn-secondary text-sm">
          Export CSV
        </button>
      </div>

      <ApplicationFilters onFilter={handleFilter} isLoading={isLoading} />

      <section className="mt-6" aria-label="Application list">
        {isLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : hasLoaded && applications.length === 0 ? (
          <EmptyState
            title="No applications found"
            description="Try adjusting your filters or apply to some jobs first."
          />
        ) : applications.length > 0 ? (
          <div className="card p-0">
            <ApplicationTable
              applications={applications}
              onViewDetail={() => {}}
              onBulkAction={handleBulkAction}
            />
          </div>
        ) : (
          <EmptyState
            title="Track your applications"
            description="Your job application history will appear here. Use filters to search through your applications."
            action={
              <button
                onClick={() => handleFilter({})}
                className="btn-primary"
              >
                Load Applications
              </button>
            }
          />
        )}

        {applications.length > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default ApplicationsPage;
