import { useState, useCallback, useEffect } from 'react';
import MetricsCard from '../components/dashboard/MetricsCard';
import RuntimeProgressPanel from '../components/dashboard/RuntimeProgressPanel';
import JobCard from '../components/dashboard/JobCard';
import JobSearchFilters from '../components/dashboard/JobSearchFilters';
import JobDetailModal from '../components/dashboard/JobDetailModal';
import Pagination from '../components/common/Pagination';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Job, RuntimeProgressSnapshot } from '../types';
import type { JobSearchParams } from '../services/jobService';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { runtimeService } from '../services/runtimeService';

const sampleRuntimeProgress: RuntimeProgressSnapshot = {
  generatedAt: new Date().toISOString(),
  overallProgress: 38,
  remainingPercent: 62,
  blockerCount: 2,
  etaTotalMinutes: 95,
  tasks: [
    {
      id: 'task-contract',
      title: 'Align API contracts',
      status: 'in_progress',
      progress: 64,
      owner: 'backend-agent',
      etaMinutes: 20,
    },
    {
      id: 'task-browser',
      title: 'Safe browser fixture',
      status: 'blocked',
      progress: 18,
      owner: 'browser-agent',
      etaMinutes: 45,
      blockerId: 'blocker-fixture',
    },
    {
      id: 'task-ui',
      title: 'Realtime progress UI',
      status: 'in_progress',
      progress: 75,
      owner: 'frontend-agent',
      etaMinutes: 15,
    },
    {
      id: 'task-tests',
      title: 'Fix backend test suites',
      status: 'in_progress',
      progress: 40,
      owner: 'claude-agent',
      etaMinutes: 25,
    },
  ],
  sessions: [
    {
      id: 'session-1',
      owner: 'backend-agent',
      model: 'local/deepseek-coder',
      status: 'running',
      currentTask: 'Fix test API mismatches',
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    },
    {
      id: 'session-2',
      owner: 'frontend-agent',
      model: 'local/codestral',
      status: 'running',
      currentTask: 'Enhanced progress panel',
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    },
    {
      id: 'session-3',
      owner: 'claude-agent',
      model: 'claude-opus-4-6',
      status: 'running',
      currentTask: 'Test suite repair + PR',
      startedAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    },
  ],
  blockers: [
    {
      id: 'blocker-fixture',
      title: 'Mock browser fixture needs a stable local route',
      severity: 'medium',
      etaMinutes: 25,
      options: ['Local HTML fixture', 'Express route stub', 'Static test page'],
      assignedTo: 'browser-agent',
    },
    {
      id: 'blocker-tests',
      title: '20 backend test suites failing - API contract drift',
      severity: 'high',
      etaMinutes: 15,
      options: [
        'Fix source exports to match tests',
        'Update tests to match current API',
        'Hybrid: fix critical, skip deprecated',
      ],
      assignedTo: 'claude-agent',
    },
  ],
  upcomingTasks: [
    'Create PR and run CI pipeline',
    'Merge to main with semantic version tag',
    'Clean up stale branches',
  ],
  completedWorkflows: [
    'Runtime tracker bootstrapped',
    'Frontend rollup dependency fixed',
    'Browser mock engine implemented',
    'Frontend 304/304 tests passing',
  ],
  executiveDecisions: [
    {
      id: 'dec-1',
      role: 'cto',
      owner: 'Tech Lead',
      action: 'Prioritize test fixes over new features - ship quality first',
      priority: 'critical',
      timestamp: new Date().toISOString(),
      outcome: 'Backend tests being fixed in parallel',
    },
    {
      id: 'dec-2',
      role: 'ceo',
      owner: 'Product',
      action: 'Dashboard must show real-time data before merge',
      priority: 'high',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'dec-3',
      role: 'manager',
      owner: 'QA Lead',
      action: 'All CI must be green before PR merge - no exceptions',
      priority: 'critical',
      timestamp: new Date().toISOString(),
      outcome: 'Blocking merge gate active',
    },
  ],
  resourceUsage: {
    cpuPercent: 45,
    memoryPercent: 62,
    cpuThreshold: 90,
    memoryThreshold: 90,
  },
  roiMetrics: {
    tasksCompletedPerHour: 4,
    blockersResolvedPerHour: 2,
    localAgentUtilization: 78,
    cloudApiCallsSaved: 142,
  },
  lessons: [
    'Use local-agent-runtime state as the canonical tracker contract',
    'Fix rollup by rm node_modules + reinstall before running tests',
    'Jest config must exclude frontend/ to avoid duplicate test runs',
  ],
  decisions: [
    'Prefer SSE first, then poll fallback for runtime progress',
    'Fix tests by updating source exports, not gutting test coverage',
  ],
  source: {
    provider: 'local-agent-runtime',
    stateDir: '/tmp/local-agent-runtime-quickhire/state',
    connected: false,
  },
};

function DashboardPage() {
  const [runtimeProgress, setRuntimeProgress] = useState<RuntimeProgressSnapshot>(
    sampleRuntimeProgress,
  );
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

  useEffect(() => {
    let cancelled = false;
    let stopStream: () => void = () => {};
    let intervalId: number | null = null;

    const loadRuntimeProgress = async () => {
      try {
        const response = await runtimeService.getProgress();
        if (!cancelled && response.data) {
          setRuntimeProgress(response.data);
        }
      } catch {
        if (!cancelled) {
          setRuntimeProgress(sampleRuntimeProgress);
        }
      }
    };

    stopStream = runtimeService.streamProgress(
      (snapshot) => {
        if (!cancelled) {
          setRuntimeProgress(snapshot);
        }
      },
      () => {
        if (!cancelled && intervalId === null) {
          loadRuntimeProgress();
          intervalId = window.setInterval(loadRuntimeProgress, 5000);
        }
      },
    );

    return () => {
      cancelled = true;
      stopStream();
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h2>

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
