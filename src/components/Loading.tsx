// One loading look for the whole app, always centred in whatever space it is given.

interface LoadingProps {
  /** Shown under the spinner. Keep it short: "Loading your profile". */
  label?: string;
  /** "page" fills the area under the header and centres in it. "inline" centres in its own block. */
  fill?: "page" | "inline";
}

export function Loading({ label = "Loading", fill = "page" }: LoadingProps) {
  const wrapperClassName =
    fill === "page" ? "flex h-full min-h-[60vh] w-full items-center justify-center p-6" : "flex w-full items-center justify-center p-6";

  return (
    <div className={wrapperClassName} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600"
        />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
    </div>
  );
}

/** A grey placeholder line, for lists that are still loading. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center justify-between gap-3 py-3">
          <span className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />
          <span className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}
