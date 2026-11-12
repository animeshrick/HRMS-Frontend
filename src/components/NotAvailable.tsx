// Shown instead of a silent redirect when a person opens a page their account may not use.
import { Link } from "react-router";
import { Card, PageHeader } from "./ui";

export function NotAvailable({ message }: { message: string }) {
  return (
    <div className="page">
      <PageHeader title="This page is not available" />
      <Card label="Not available">
        <p role="alert" className="text-sm text-ink-2">
          {message}
        </p>
        <Link to="/home" className="btn btn-primary mt-3">
          Go to Home
        </Link>
      </Card>
    </div>
  );
}
