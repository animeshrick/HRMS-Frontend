import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearGovernmentIdOf, getGovernmentIdImageUrl, getGovernmentIdList, readGovernmentIdOf } from "../api/governmentId";
import type { SuperadminGovernmentId } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import { Badge, Card, CardTitle, INPUT } from "../components/ui";
import { describeError } from "../lib/errors";

const ID_TYPE_NAMES: Record<string, string> = { aadhaar: "Aadhaar", pan: "PAN" };

/** "2026-11-23T10:00:00+00:00" becomes "23 Nov 2026" in India time. */
function formatSubmittedOn(timestamp: string | null): string {
  if (!timestamp) {
    return "";
  }
  const moment = new Date(timestamp);
  if (Number.isNaN(moment.getTime())) {
    return timestamp;
  }
  return moment.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** The full number and the two image links of one person, shown after "View". */
function OpenedGovernmentId({ opened, onClear }: { opened: SuperadminGovernmentId; onClear: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const imageUrlMutation = useMutation({
    mutationFn: (side: "front" | "back") => getGovernmentIdImageUrl(session!.accessToken, opened.emp_id, side),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
    onError: (error) => toast.error(describeError(error)),
  });

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">
      <p className="font-medium text-ink">
        {opened.full_name} <span className="text-ink-3">({opened.emp_id})</span>
      </p>
      <p className="mt-1 text-ink-2">
        {ID_TYPE_NAMES[opened.id_type] ?? opened.id_type}: <span className="font-mono text-ink">{opened.id_number}</span>
      </p>
      <p className="text-xs text-ink-3">Submitted on {formatSubmittedOn(opened.submitted_at)}. This look-up is in the audit log.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => imageUrlMutation.mutate("front")} disabled={imageUrlMutation.isPending} className="btn btn-sm btn-quiet">
          Open front image
        </button>
        {opened.back_image_path && (
          <button type="button" onClick={() => imageUrlMutation.mutate("back")} disabled={imageUrlMutation.isPending} className="btn btn-sm btn-quiet">
            Open back image
          </button>
        )}
        {!isConfirmingClear ? (
          <button type="button" onClick={() => setIsConfirmingClear(true)} className="text-sm text-bad underline">
            Clear this ID
          </button>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-xs text-ink-2">Ask {opened.full_name} for a new ID?</span>
            <button type="button" onClick={onClear} className="btn btn-sm btn-bad">
              Yes, clear it
            </button>
            <button type="button" onClick={() => setIsConfirmingClear(false)} className="text-sm text-ink-3 underline">
              Cancel
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The super admin's government ID card: who has submitted, and the full number of one person on
 * request. Only the super admin can open a number or an image, and both the look-up and a clear
 * are written to the audit log by the backend. Clearing asks that person for a new ID at their
 * next login.
 */
export function GovernmentIdAdminCard() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [openedEmpId, setOpenedEmpId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["government-id-list"],
    queryFn: () => getGovernmentIdList(token),
    retry: false,
  });

  const openMutation = useMutation({
    mutationFn: (empId: string) => readGovernmentIdOf(token, empId),
    onSuccess: (result) => setOpenedEmpId(result.emp_id),
    onError: (error) => toast.error(describeError(error)),
  });

  const clearMutation = useMutation({
    mutationFn: (empId: string) => clearGovernmentIdOf(token, empId),
    onSuccess: (result) => {
      toast.success(result.message);
      setOpenedEmpId(null);
      openMutation.reset();
      queryClient.invalidateQueries({ queryKey: ["government-id-list"] });
    },
    onError: (error) => toast.error(describeError(error)),
  });

  const everyone = listQuery.data ?? [];
  const wanted = search.trim().toLowerCase();
  const found = wanted
    ? everyone.filter((person) =>
        [person.emp_id, person.full_name, person.dept ?? ""].some((field) => field.toLowerCase().includes(wanted)),
      )
    : everyone;
  const missingCount = everyone.filter((person) => !person.submitted).length;
  const opened = openMutation.data && openMutation.data.emp_id === openedEmpId ? openMutation.data : null;

  return (
    <Card label="Government IDs">
      <CardTitle
        aside={missingCount > 0 ? <Badge tone="warn">{missingCount} not submitted</Badge> : <Badge tone="ok">All submitted</Badge>}
      >
        Government IDs
      </CardTitle>
      <p className="mb-3 text-sm text-ink-2">
        Every employee submits one Aadhaar or PAN at their first login. Only you can see a full number, and every
        look-up is recorded in the audit log below.
      </p>

      {listQuery.isPending && <Loading fill="inline" label="Loading government IDs" delayMilliseconds={300} />}
      {listQuery.isError && <ErrorMessage message={`Could not load the government IDs. ${describeError(listQuery.error)}`} />}

      <input
        type="search"
        aria-label="Search government IDs"
        placeholder="Search by ID, name or department"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={`${INPUT} block w-full`}
      />
      <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto text-sm">
        {found.length === 0 && !listQuery.isPending && <li className="py-2 text-ink-3">No employee matches.</li>}
        {found.map((person) => (
          <li key={person.emp_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="font-medium text-ink">{person.full_name}</span>
              <span className="text-ink-3">
                {" "}
                {person.emp_id} | {person.dept ?? "No department"}
              </span>
              <span className="block text-xs text-ink-3">
                {person.submitted ? `${person.masked_number}, submitted ${formatSubmittedOn(person.submitted_at)}` : "Not submitted yet"}
              </span>
            </span>
            {person.submitted && (
              <button
                type="button"
                onClick={() => openMutation.mutate(person.emp_id)}
                disabled={openMutation.isPending}
                className="btn btn-sm btn-quiet"
              >
                {openedEmpId === person.emp_id ? "Viewing" : "View"}
              </button>
            )}
          </li>
        ))}
      </ul>

      {opened && <OpenedGovernmentId opened={opened} onClear={() => clearMutation.mutate(opened.emp_id)} />}
    </Card>
  );
}
