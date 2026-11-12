// The loader of the whole app: a thin ring, a teal arc that travels round it, and a saffron dot that orbits the other way.
export function LoaderMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3" className="stroke-line" />
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="34 100" className="loader-arc stroke-focus" />
      <g className="loader-dot">
        <circle cx="20" cy="4" r="2.6" className="fill-accent" />
      </g>
    </svg>
  );
}
