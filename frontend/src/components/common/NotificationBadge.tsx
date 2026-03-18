interface NotificationBadgeProps {
  count: number;
  className?: string;
}

function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-danger-500 px-1.5 py-0.5 text-xs font-bold text-white ${className}`}
      aria-label={`${count} notifications`}
    >
      {displayCount}
    </span>
  );
}

export default NotificationBadge;
