export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-9 w-9 shrink-0"
      fill="none"
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="18" cy="18" fill="var(--surface)" r="17.25" stroke="var(--border-strong)" />
      <path
        d="M9.5 11.75h6.25c2.15 0 3.55.62 4.25 1.82v12.18c-.7-1.2-2.1-1.82-4.25-1.82H9.5V11.75Z"
        stroke="var(--ink)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.45"
      />
      <path
        d="M26.5 11.75h-2.25c-2.15 0-3.55.62-4.25 1.82v12.18c.7-1.2 2.1-1.82 4.25-1.82h2.25V11.75Z"
        stroke="var(--ink)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.45"
      />
      <path d="M12.5 16h4.2M12.5 19h4.2" stroke="var(--accent)" strokeLinecap="round" />
      <path d="M23 16.25h1.5M23 19.25h1.5" stroke="var(--success)" strokeLinecap="round" />
    </svg>
  );
}
