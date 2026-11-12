// Shown instead of a silent redirect when a person opens a page their account may not use.
import { Link } from "react-router";
import { Card, PageHeader } from "./ui";

export function NotAvailable({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <PageHeader title="This page is not available" />
      <Card label="Not available">
        <p role="alert" className="text-sm text-ink-2">
          {message}
        </p>
        <Link to="/home" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90">
          Go to Home
        </Link>
      </Card>
    </div>
  );
}
