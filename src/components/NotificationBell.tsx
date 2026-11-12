import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getMyCorrections } from "../api/attendance";
import { getMyLeaves } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { describeError } from "../lib/errors";
import { correctionSummary, decisionSummary, isCorrectionDecided, isDecided, readSeenIds, writeSeenIds } from "../lib/decisions";
import { formatDayLabel } from "../lib/time";

const REFRESH_MILLISECONDS = 60_000; // a decision is not urgent; once a minute is plenty

export function NotificationBell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const [seenCorrectionIds, setSeenCorrectionIds] = useState<number[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const employeeId = session?.employeeId;

  useEffect(() => {
    if (employeeId !== undefined) {
      setSeenIds(readSeenIds(employeeId));
      setSeenCorrectionIds(readSeenIds(employeeId, "correction"));
    }
  }, [employeeId]);

  const leavesQuery = useQuery({
    queryKey: ["my-leaves", employeeId],
    queryFn: () => getMyLeaves(session!.accessToken),
    enabled: Boolean(session) && !session!.mustChangePassword,
    refetchInterval: REFRESH_MILLISECONDS,
    refetchOnWindowFocus: true,
  });

  // The attendance corrections (CEO and CTO have no attendance, so nothing is asked for them).
  const correctionsQuery = useQuery({
    queryKey: ["attendance-corrections", employeeId],
    queryFn: () => getMyCorrections(session!.accessToken),
    enabled: Boolean(session) && !session!.mustChangePassword && session!.attendanceAccess !== "none",
    refetchInterval: REFRESH_MILLISECONDS,
    refetchOnWindowFocus: true,
  });

  // Anything other than a list (an error body, a proxy page) must not break the header.
  const decided = useMemo(() => {
    const rows = Array.isArray(leavesQuery.data) ? leavesQuery.data : [];
    return rows.filter(isDecided);
  }, [leavesQuery.data]);
  const unseen = useMemo(() => decided.filter((leave) => !seenIds.includes(leave.id)), [decided, seenIds]);
  // HR's own corrections are approved at once by "Auto": they are not news, so they never light the dot.
  const decidedCorrections = useMemo(() => {
    const rows = Array.isArray(correctionsQuery.data) ? correctionsQuery.data : [];
    return rows.filter(isCorrectionDecided);
  }, [correctionsQuery.data]);
  const unseenCorrections = useMemo(
    () => decidedCorrections.filter((correction) => correction.decision_note !== "Auto" && !seenCorrectionIds.includes(correction.id)),
    [decidedCorrections, seenCorrectionIds],
  );
  const unseenCount = unseen.length + unseenCorrections.length;

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
        const allCorrectionIds = decidedCorrections.map((correction) => correction.id);
        setSeenCorrectionIds(allCorrectionIds);
        writeSeenIds(employeeId, allCorrectionIds, "correction");
      }
      return willOpen;
    });
  }

  const badgeLabel = unseenCount > 0 ? `${unseenCount} new decision${unseenCount === 1 ? "" : "s"}` : "No new notifications";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        aria-label={badgeLabel}
        aria-expanded={isOpen}
        className="relative rounded-lg p-2 text-ink-2 transition hover:bg-surface-2 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a2 2 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unseenCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-bad ring-2 ring-surface"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-pop">
          {(leavesQuery.isError || correctionsQuery.isError) && (
            <p role="alert" className="px-2 py-2 text-sm text-bad">
              Could not load your notifications. {describeError(leavesQuery.error ?? correctionsQuery.error)}
            </p>
          )}
          {decided.length > 0 && <p className="px-2 py-1 text-xs font-medium text-ink-3">Leave decisions</p>}
          {decided.length === 0 && decidedCorrections.length === 0 && <p className="px-2 py-3 text-sm text-ink-3">Nothing decided yet.</p>}
          {decided.length > 0 && (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {decided.slice(0, 10).map((leave) => (
                <li key={leave.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/leave");
                    }}
                    className="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-canvas"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${leave.status === "approved" ? "bg-ok" : "bg-bad"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{leave.description}</span>
                      <span className={`block text-xs ${leave.status === "approved" ? "text-ok" : "text-bad"}`}>
                        {decisionSummary(leave)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {decidedCorrections.length > 0 && (
            <>
              <p className="px-2 py-1 text-xs font-medium text-ink-3">Attendance corrections</p>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {decidedCorrections.slice(0, 10).map((correction) => (
                  <li key={`correction-${correction.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/attendance");
                      }}
                      className="flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-canvas"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${correction.status === "approved" ? "bg-ok" : "bg-bad"}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">Correction for {formatDayLabel(correction.work_date)}</span>
                        <span className={`block text-xs ${correction.status === "approved" ? "text-ok" : "text-bad"}`}>
                          {correctionSummary(correction)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
