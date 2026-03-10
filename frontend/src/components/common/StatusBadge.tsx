import { STATUS_COLORS } from '../../utils/constants';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.pending;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colorClass} ${className}`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;
