export function FeatherIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 19c1.2-6.2 5.4-11.6 14.2-14.4" />
      <path d="M7.2 16.8c2.4-2.2 6.4-4.6 11.2-5.6" />
      <path d="M8.6 13.2c2.2-1.6 5.4-3.2 9.4-3.8" />
      <path d="M5 19l3.2-3.2" />
      <path d="M6.4 20.2l1.6-4.4" />
    </svg>
  );
}
