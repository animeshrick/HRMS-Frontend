import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mt-24 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/chat" className="mt-2 inline-block text-sm text-brand underline">
        Go to chat
      </Link>
    </div>
  );
}
