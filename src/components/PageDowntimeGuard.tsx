// Hides one page behind a short maintenance notice when the backend's DOWNTIME_PAGES setting
// (app/core/downtime.py) marks it down. Unlike DowntimePage (the whole-app switch, VITE_DOWNTIME
// in App.tsx), this keeps the normal layout - nav, sidebar, notification bell - and only swaps
// out the page's own content, since one page being down for maintenance should not block the rest.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDowntimeStatus, type DowntimePageKey } from "../api/system";
import { Card, CardTitle } from "./ui";

const REFRESH_MILLISECONDS = 60_000; // not urgent; once a minute is plenty

export function PageDowntimeGuard({ pageKey, children }: { pageKey: DowntimePageKey; children: ReactNode }) {
  const downtimeQuery = useQuery({ queryKey: ["system-downtime"], queryFn: getDowntimeStatus, refetchInterval: REFRESH_MILLISECONDS });
  const isDown = (downtimeQuery.data?.down_pages ?? []).includes(pageKey);

  if (!isDown) {
    return <>{children}</>;
  }

  return (
    <div className="page">
      <Card label="Under maintenance">
        <CardTitle>This page is down for maintenance</CardTitle>
        <p className="text-sm text-ink-2">
          We're working on this page right now. Please check back shortly - nothing you've already saved is affected.
        </p>
      </Card>
    </div>
  );
}
