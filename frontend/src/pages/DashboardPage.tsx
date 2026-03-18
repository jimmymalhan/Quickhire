import { useState, useCallback } from 'react';
import MetricsCard from '../components/dashboard/MetricsCard';
import RuntimeProgressPanel from '../components/dashboard/RuntimeProgressPanel';
import ProjectTrackerBoard from '../components/dashboard/ProjectTrackerBoard';
import JobCard from '../components/dashboard/JobCard';
import JobSearchFilters from '../components/dashboard/JobSearchFilters';
import JobDetailModal from '../components/dashboard/JobDetailModal';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Job } from '../types';
import type { JobSearchParams } from '../services/jobService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { useRuntimeProgress } from '../hooks/useRuntimeProgress';

function DashboardPage() {
  const runtimeProgress = useRuntimeProgress();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (params: JobSearchParams) => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await jobService.searchJobs({
        ...params,
        page: 1,
        pageSize: 20,
      });
      setJobs(response.data || []);
      setTotalPages(
        response.meta
          ? Math.ceil(response.meta.total / response.meta.pageSize)
          : 0,
      );
      setCurrentPage(1);
    } catch {
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page);
    setIsLoading(true);
    try {
      const response = await jobService.searchJobs({ page, pageSize: 20 });
      setJobs(response.data || []);
    } catch {
      // Keep existing results
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApply = useCallback(async (jobId: string) => {
    try {
      await applicationService.applyToJob(jobId);
    } catch {
      // Error handling will be improved
    }
  }, []);

  const handleBookmark = useCallback(async (jobId: string) => {
    try {
      await jobService.bookmarkJob(jobId);
    } catch {
      // Error handling will be improved
    }
  }, []);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h2>

      <ProjectTrackerBoard snapshot={runtimeProgress} />

      <RuntimeProgressPanel snapshot={runtimeProgress} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total Applied"
          value={runtimeProgress.tasks.length * 4}
        />
        <MetricsCard
          title="Pending"
          value={
            runtimeProgress.tasks.filter((task) => task.status !== 'done')
              .length
          }
        />
        <MetricsCard title="Viewed" value={1} />
        <MetricsCard title="Interviews" value={0} />
      </div>

      <section aria-label="Job search">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Find Jobs
        </h3>
        <JobSearchFilters onSearch={handleSearch} isLoading={isLoading} />
      </section>

      <section className="mt-8" aria-label="Job results">
        {isLoading ? (
          <LoadingSpinner size="lg" className="py-12" />
        ) : hasSearched && jobs.length === 0 ? (
          <EmptyState
            title="No jobs found"
            description="Try adjusting your search filters to find more jobs."
          />
        ) : jobs.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={handleApply}
                  onBookmark={handleBookmark}
                  onViewDetails={setSelectedJob}
                />
              ))}
            </div>
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Discover your next role"
            description="Use the search filters above to find job opportunities."
          />
        )}
      </section>

      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={handleApply}
      />
    </div>
  );
}

export default DashboardPage;
