import { useQuery } from "@tanstack/react-query";
import { loadMyProfile } from "../api/profile";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { describeError } from "../lib/errors";

const ROLE_NAMES: Record<string, string> = { employee: "Employee", hr: "HR", ceo: "CEO", pm: "PM (project manager)" };

/** "2022-01-03" becomes "03 Jan 2022". Anything that is not a date is shown as it is. */
function formatDate(dateText: string | null): string {
  if (!dateText) {
    return "Not recorded";
  }
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** The page at /me: the logged-in employee's own details. Nobody else's. */
export function ProfilePage() {
  const { session } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["my-profile", session?.employeeId],
    queryFn: () => loadMyProfile(session!.accessToken),
    enabled: Boolean(session),
    retry: false, // show the error at once; the page can be reloaded
  });

  if (profileQuery.isPending) {
    return <p className="p-6 text-sm text-slate-500">Loading your profile...</p>;
  }
  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <ErrorMessage message={describeError(profileQuery.error)} />
      </div>
    );
  }

  const profile = profileQuery.data;
  const details: [string, string][] = [
    ["Employee ID", profile.emp_id],
    ["Department", profile.dept ?? "Not recorded"],
    ["Role", ROLE_NAMES[profile.role] ?? profile.role],
    ["Reports to", profile.manager_name ?? "No manager set"],
    ["Email", profile.email ?? "Not recorded"],
    ["Phone", profile.phone ?? "Not recorded"],
    ["Gender", profile.gender ?? "Not recorded"],
    ["Date of joining", formatDate(profile.date_of_joining)],
    ["Date of birth", formatDate(profile.date_of_birth)],
    ["Address", profile.address ?? "Not recorded"],
    ["Emergency contact", profile.emergency_contact ?? "Not recorded"],
    ["Status", profile.is_active ? "Active" : "Not active"],
  ];

  return (
    <div className="mx-auto max-w-2xl overflow-y-auto p-6">
      <h1 className="text-lg font-semibold">{profile.full_name}</h1>
      <p className="text-sm text-slate-600">Your profile. To change any detail, please ask HR.</p>
      <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {details.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-3 px-4 py-2 text-sm">
            <dt className="font-medium text-slate-600">{label}</dt>
            <dd className="col-span-2 text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
