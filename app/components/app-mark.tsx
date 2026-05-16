export function AppMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Deploy Failures"
    >
      <rect x="1" y="1" width="14" height="14" />
    </svg>
  );
}
