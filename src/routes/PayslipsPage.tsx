import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getMyPayslipDownloadUrl, getMyPayslipMonths, getMyPayslipYears } from "../api/payroll";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { SkeletonRows } from "../components/Loading";
import { describeError } from "../lib/errors";
import type { PayslipMonth } from "../api/types";

// "November 2026" -> ["November", "2026"]. The label always has exactly this shape (see app/hr/payroll/service.py).
function splitLabel(label: string): [string, string] {
  const lastSpace = label.lastIndexOf(" ");
  return lastSpace === -1 ? [label, ""] : [label.slice(0, lastSpace), label.slice(lastSpace + 1)];
}

function PayslipCard({
  entry,
  onDownload,
  isPreparing,
}: {
  entry: PayslipMonth;
  onDownload: () => void;
  isPreparing: boolean;
}) {
  const [monthName, year] = splitLabel(entry.label);
  const isDisabled = entry.disabled_reason !== null;
  return (
    <div className={`card flex flex-col gap-3 !p-0 overflow-hidden ${isDisabled ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between border-b border-line bg-surface-2 px-4 py-3">
        <span className="text-lg font-semibold leading-none text-ink">{monthName}</span>
        <span className="text-sm text-ink-3">{year}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        {entry.disabled_reason === "future" && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Not due yet
          </span>
        )}
        {entry.disabled_reason === "before_joining" && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            Before you joined
          </span>
        )}
        {!isDisabled && (
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              entry.available ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {entry.available ? "Ready" : "Not generated yet"}
          </span>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={isDisabled || isPreparing}
          className="btn btn-sm btn-quiet mt-auto w-full"
        >
          {isDisabled ? "Not available" : isPreparing ? "Preparing..." : entry.available ? "Download" : "Generate and download"}
        </button>
      </div>
    </div>
  );
}

export function PayslipsPage() {
  const { session } = useAuth();
  const token = session!.accessToken;

  const yearsQuery = useQuery({ queryKey: ["my-payslip-years", session!.employeeId], queryFn: () => getMyPayslipYears(token) });
  const years = yearsQuery.data ?? [];

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  useEffect(() => {
    if (selectedYear === null && years.length > 0) setSelectedYear(years[0]!); // newest year first
  }, [years, selectedYear]);

  const monthsQuery = useQuery({
    queryKey: ["my-payslip-months", session!.employeeId, selectedYear],
    queryFn: () => getMyPayslipMonths(token, selectedYear!),
    enabled: selectedYear !== null,
  });

  const downloadMutation = useMutation({
    mutationFn: (month: string) => getMyPayslipDownloadUrl(token, month),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
  });

  const months = monthsQuery.data ?? [];
  const isLoading = yearsQuery.isPending || (selectedYear !== null && monthsQuery.isPending);

  return (
    <div className="page">
      <h1 className="page-title">My payslips</h1>
      <p className="text-sm text-ink-3">Pick a year to see January through December. A payslip is put together the first time you open it.</p>

      <section aria-label="My payslips" className="space-y-4">
        {yearsQuery.isError && <ErrorMessage message={describeError(yearsQuery.error)} />}
        {monthsQuery.isError && <ErrorMessage message={describeError(monthsQuery.error)} />}
        {downloadMutation.isError && <ErrorMessage message={describeError(downloadMutation.error)} />}

        {years.length > 1 && (
          <div role="group" aria-label="Year" className="flex flex-wrap gap-2">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                aria-pressed={selectedYear === year}
                className={`btn btn-sm ${selectedYear === year ? "btn-primary" : "btn-quiet"}`}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {isLoading && <SkeletonRows rows={4} />}
        {!isLoading && years.length === 0 && (
          <p className="text-sm text-ink-3">No payslip years yet. This shows up once your joining date and salary are recorded by HR.</p>
        )}
        {!isLoading && months.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((entry) => (
              <PayslipCard
                key={entry.month}
                entry={entry}
                onDownload={() => downloadMutation.mutate(entry.month)}
                isPreparing={downloadMutation.isPending && downloadMutation.variables === entry.month}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
