// Shown for every visitor, logged in or not, whenever VITE_DOWNTIME is "true".
// Set in .env (or .env.local) to put the whole app behind this page for planned maintenance.
import { LoaderMark } from "../components/LoaderMark";
import { Logo } from "../components/Logo";

export function DowntimePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="card w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <Logo size={56} />
        </div>
        <h1 className="page-title">We'll be right back</h1>
        <p className="mt-2 text-sm text-ink-2">
          HR Assistant is down for scheduled maintenance. Nothing you do here is lost — check back shortly.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-3">
          <LoaderMark size={20} />
          <span>Reconnecting automatically</span>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary mt-6 w-full">
          Try again
        </button>
      </div>
    </div>
  );
}
