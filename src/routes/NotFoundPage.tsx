import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mt-24 text-center">
      <h1 className="page-title">Page not found</h1>
      <Link to="/home" className="mt-2 inline-block text-sm text-brand-text underline">
        Go to home
      </Link>
    </div>
  );
}
