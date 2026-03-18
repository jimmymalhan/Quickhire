import { useState } from 'react';

interface SaveJobButtonProps {
  jobId: string;
  isSaved: boolean;
  onSave: (jobId: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  savedJobId?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function SaveJobButton({
  jobId,
  isSaved,
  onSave,
  onRemove,
  savedJobId,
  size = 'md',
  className = '',
}: SaveJobButtonProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [optimisticSaved, setOptimisticSaved] = useState(isSaved);

  const handleToggle = async () => {
    if (isToggling) return;
    setIsToggling(true);
    const previousState = optimisticSaved;
    setOptimisticSaved(!previousState);

    try {
      let success: boolean;
      if (previousState && savedJobId) {
        success = await onRemove(savedJobId);
      } else {
        success = await onSave(jobId);
      }
      if (!success) {
        setOptimisticSaved(previousState);
      }
    } catch {
      setOptimisticSaved(previousState);
    } finally {
      setIsToggling(false);
    }
  };

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 ${buttonSize} ${
        optimisticSaved
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-500'
      } ${className}`}
      aria-label={optimisticSaved ? 'Remove from saved jobs' : 'Save job'}
      title={optimisticSaved ? 'Remove from saved jobs' : 'Save job'}
    >
      <svg
        className={iconSize}
        fill={optimisticSaved ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}

export default SaveJobButton;
