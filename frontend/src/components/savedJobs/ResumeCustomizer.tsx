import { useState, useCallback } from 'react';
import LoadingSpinner from '../common/LoadingSpinner';
import type { ResumeCustomization, Resume } from '../../types/savedJobs';
import { resumeService } from '../../services/resumeService';

interface ResumeCustomizerProps {
  resume: Resume;
  jobId: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
}

function ResumeCustomizer({
  resume,
  jobId,
  jobTitle,
  company,
  onClose,
}: ResumeCustomizerProps) {
  const [customization, setCustomization] =
    useState<ResumeCustomization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resume' | 'coverLetter'>(
    'resume',
  );

  const handlePreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await resumeService.previewCustomization(
        resume.id,
        jobId,
      );
      if (response.data) {
        setCustomization(response.data);
      }
    } catch {
      setError('Unable to preview customization. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [resume.id, jobId]);

  const handleCustomize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await resumeService.customizeForJob(resume.id, jobId);
      if (response.data) {
        setCustomization(response.data);
      }
    } catch {
      setError('Unable to customize resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [resume.id, jobId]);

  const handleGenerateCoverLetter = useCallback(async () => {
    setIsGeneratingCoverLetter(true);
    try {
      const response = await resumeService.generateCoverLetter(
        resume.id,
        jobId,
      );
      if (response.data && customization) {
        setCustomization({
          ...customization,
          coverLetter: response.data.coverLetter,
        });
        setActiveTab('coverLetter');
      }
    } catch {
      setError('Unable to generate cover letter. Please try again.');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }, [resume.id, jobId, customization]);

  const fitScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resume Customizer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {jobTitle} at {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <LoadingSpinner size="lg" className="py-12" />
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              <p>{error}</p>
              <button
                onClick={handlePreview}
                className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-500 dark:text-red-400"
              >
                Try again
              </button>
            </div>
          ) : !customization ? (
            <div className="flex flex-col items-center py-12 text-center">
              <svg className="mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                Customize your resume
              </h3>
              <p className="mb-4 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                Preview how your resume ({resume.fileName}) can be tailored for
                this role.
              </p>
              <div className="flex gap-3">
                <button onClick={handlePreview} className="btn-secondary text-sm">
                  Preview Changes
                </button>
                <button onClick={handleCustomize} className="btn-primary text-sm">
                  Customize Now
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Fit score */}
              <div className="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Fit Score
                  </p>
                  <p
                    className={`text-2xl font-bold ${fitScoreColor(customization.fitScore)}`}
                  >
                    {customization.fitScore}%
                  </p>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                    Keyword Matches
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customization.keywordMatches.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      >
                        {keyword}
                      </span>
                    ))}
                    {customization.keywordMatches.length === 0 && (
                      <span className="text-xs text-gray-400">
                        No keyword matches found
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                <button
                  onClick={() => setActiveTab('resume')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'resume'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Resume
                </button>
                <button
                  onClick={() => setActiveTab('coverLetter')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'coverLetter'
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Cover Letter
                </button>
              </div>

              {/* Content */}
              {activeTab === 'resume' ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {customization.customizedFileName}
                    </span>
                    <span className="text-xs text-gray-400">
                      Customized from {customization.originalFileName}
                    </span>
                  </div>
                </div>
              ) : customization.coverLetter ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {customization.coverLetter}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                    No cover letter generated yet.
                  </p>
                  <button
                    onClick={handleGenerateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {isGeneratingCoverLetter
                      ? 'Generating...'
                      : 'Generate Cover Letter'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {customization && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button onClick={onClose} className="btn-secondary text-sm">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResumeCustomizer;
