// The notice bar at the very top of every page, login page included.
//
// The text comes from EMERGENCY_BROADCAST in the BACKEND .env and arrives with the downtime
// status, so it can be changed with a restart of the backend and no rebuild of this site. It
// shares the "system-downtime" query with PageDowntimeGuard, so showing it costs no extra request.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDowntimeStatus } from "../api/system";
import { CloseIcon } from "./icons";

const REFRESH_MILLISECONDS = 60_000; // same as PageDowntimeGuard, so the two share one poll

export function EmergencyBroadcast() {
  // The text that was closed, not just "closed": if the message changes, the new one shows again.
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const downtimeQuery = useQuery({
    queryKey: ["system-downtime"],
    queryFn: getDowntimeStatus,
    refetchInterval: REFRESH_MILLISECONDS,
  });

  const message = (downtimeQuery.data?.emergency_broadcast ?? "").trim();
  if (!message || message === closedMessage) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-start gap-3 border-b border-warn/30 bg-warn-soft px-4 py-2.5 text-sm font-medium text-warn sm:px-6"
    >
      <span className="min-w-0 flex-1 break-words">{message}</span>
      <button
        type="button"
        onClick={() => setClosedMessage(message)}
        aria-label="Close this notice"
        title="Close this notice"
        className="-mr-1 shrink-0 rounded-lg p-1 text-warn/80 hover:bg-warn/10 hover:text-warn"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
