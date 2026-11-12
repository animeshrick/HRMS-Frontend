// One loading look for the whole app, always centred in whatever space it is given.
import { useEffect, useState } from "react";
import { LoaderMark } from "./LoaderMark";

interface LoadingProps {
  /** Shown under the spinner. Keep it short: "Loading your profile". */
  label?: string;
  /** "page" fills the area under the header and centres in it. "inline" centres in its own block. */
  fill?: "page" | "inline";
  /** Show the spinner only if loading takes longer than this, so a fast answer does not flash it. Default: at once. */
  delayMilliseconds?: number;
}

export function Loading({ label = "Loading", fill = "page", delayMilliseconds = 0 }: LoadingProps) {
  const [isVisible, setIsVisible] = useState(delayMilliseconds === 0);
  useEffect(() => {
    if (delayMilliseconds === 0) {
      return;
    }
    const timer = setTimeout(() => setIsVisible(true), delayMilliseconds);
    return () => clearTimeout(timer);
  }, [delayMilliseconds]);
  if (!isVisible) {
    return null;
  }
  const wrapperClassName =
    fill === "page" ? "flex h-full min-h-[60vh] w-full items-center justify-center p-6" : "flex w-full items-center justify-center p-6";

  return (
    <div className={wrapperClassName} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <LoaderMark />
        <span className="text-sm text-ink-3">{label}</span>
      </div>
    </div>
  );
}

/** A grey placeholder line, for lists that are still loading. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-line" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center justify-between gap-3 py-3">
          <span className="h-3 w-2/5 animate-pulse rounded bg-surface-2" />
          <span className="h-3 w-16 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
