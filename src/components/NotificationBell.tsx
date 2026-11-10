import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getMyLeaves } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { decisionSummary, isDecided, readSeenIds, writeSeenIds } from "../lib/decisions";

const REFRESH_MILLISECONDS = 60_000; // a decision is not urgent; once a minute is plenty

export function NotificationBell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const employeeId = session?.employeeId;

  useEffect(() => {
    if (employeeId !== undefined) {
      setSeenIds(readSeenIds(employeeId));
    }
  }, [employeeId]);

  const leavesQuery = useQuery({
    queryKey: ["my-leaves", employeeId],
    queryFn: () => getMyLeaves(session!.accessToken),
    enabled: Boolean(session) && !session!.mustChangePassword,
    refetchInterval: REFRESH_MILLISECONDS,
    refetchOnWindowFocus: true,
  });

  // Anything other than a list (an error body, a proxy page) must not break the header.
  const decided = useMemo(() => {
    const rows = Array.isArray(leavesQuery.data) ? leavesQuery.data : [];
    return rows.filter(isDecided);
  }, [leavesQuery.data]);
  const unseen = useMemo(() => decided.filter((leave) => !seenIds.includes(leave.id)), [decided, seenIds]);

  // Close when clicking anywhere else, or on Escape.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!session || session.mustChangePassword) {
    return null;
  }

  function openPanel() {
    setIsOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen && employeeId !== undefined) {
        const allIds = decided.map((leave) => leave.id);
        setSeenIds(allIds);
        writeSeenIds(employeeId, allIds); // opening the panel is what marks them read
      }
      return willOpen;
    });
  }

  const badgeLabel = unseen.length > 0 ? `${unseen.length} new leave decision${unseen.length === 1 ? "" : "s"}` : "No new notifications";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        aria-label={badgeLabel}
        aria-expanded={isOpen}
        className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a2 2 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unseen.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">Leave decisions</p>
          {decided.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">Nothing decided yet.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {decided.slice(0, 10).map((leave) => (
                <li key={leave.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/leave");
                    }}
                    className="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${leave.status === "approved" ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-800">{leave.description}</span>
                      <span className={`block text-xs ${leave.status === "approved" ? "text-green-700" : "text-red-700"}`}>
                        {decisionSummary(leave)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
