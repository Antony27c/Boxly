export default function IconoAuto({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 16H3.5A1.5 1.5 0 0 1 2 14.5v-2.3a2 2 0 0 1 .6-1.4L4 9.5l1.6-3.4A2 2 0 0 1 7.4 5h9.2a2 2 0 0 1 1.8 1.1L20 9.5l1.4 1.3a2 2 0 0 1 .6 1.4v2.3a1.5 1.5 0 0 1-1.5 1.5H19" />
      <path d="M9 16h6" />
      <path d="M4 9.5h16" />
      <circle cx="7" cy="16" r="2" />
      <circle cx="17" cy="16" r="2" />
    </svg>
  )
}
