import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { registerEmployee, resetEmployeePassword } from "../api/admin";
import type { CredentialsResponse, Role } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { describeError } from "../lib/errors";
import { validateEmployeeId } from "../lib/validation";

export function AdminPage() {
  const { session } = useAuth();
  const token = session!.accessToken;

  // The temporary password is shown only once. It is kept in this page's memory, never in storage.
  const [shownCredentials, setShownCredentials] = useState<CredentialsResponse | null>(null);

  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createRole, setCreateRole] = useState<Role>("employee");
  const [createError, setCreateError] = useState<string | null>(null);

  const [resetEmployeeId, setResetEmployeeId] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => registerEmployee(token, { emp_id: createEmployeeId.trim(), role: createRole }),
    onSuccess: (credentials) => {
      setShownCredentials(credentials);
      setCreateEmployeeId("");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetEmployeePassword(token, { emp_id: resetEmployeeId.trim() }),
    onSuccess: (credentials) => {
      setShownCredentials(credentials);
      setResetEmployeeId("");
    },
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const problem = validateEmployeeId(createEmployeeId);
    setCreateError(problem);
    if (!problem) {
      setShownCredentials(null);
      createMutation.mutate();
    }
  }

  function handleReset(event: FormEvent) {
    event.preventDefault();
    const problem = validateEmployeeId(resetEmployeeId);
    setResetError(problem);
    if (!problem) {
      setShownCredentials(null);
      resetMutation.mutate();
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold">HR admin</h1>

      {shownCredentials && (
        <CredentialsCard credentials={shownCredentials} onDismiss={() => setShownCredentials(null)} />
      )}

      <form onSubmit={handleCreate} noValidate className="space-y-3 rounded-lg bg-white p-5 shadow">
        <h2 className="font-medium">Create a login</h2>
        <FormField
          label="Employee ID to create"
          value={createEmployeeId}
          onChange={(event) => setCreateEmployeeId(event.target.value)}
          errorMessage={createError}
        />
        <div>
          <label htmlFor="create-role" className="block text-sm font-medium text-slate-700">
            Role
          </label>
          <select
            id="create-role"
            value={createRole}
            onChange={(event) => setCreateRole(event.target.value as Role)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
            <option value="ceo">CEO</option>
            <option value="pm">PM (project manager)</option>
          </select>
        </div>
        {createMutation.isError && <ErrorMessage message={describeError(createMutation.error)} />}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating..." : "Create login"}
        </button>
      </form>

      <form onSubmit={handleReset} noValidate className="space-y-3 rounded-lg bg-white p-5 shadow">
        <h2 className="font-medium">Reset a password</h2>
        <FormField
          label="Employee ID to reset"
          value={resetEmployeeId}
          onChange={(event) => setResetEmployeeId(event.target.value)}
          errorMessage={resetError}
        />
        {resetMutation.isError && <ErrorMessage message={describeError(resetMutation.error)} />}
        <button
          type="submit"
          disabled={resetMutation.isPending}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

function CredentialsCard({ credentials, onDismiss }: { credentials: CredentialsResponse; onDismiss: () => void }) {
  const [wasCopied, setWasCopied] = useState(false);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(credentials.temporary_password);
      setWasCopied(true);
    } catch {
      setWasCopied(false); // clipboard blocked: the user can still select the text
    }
  }

  return (
    <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
      <p className="font-medium text-green-800">
        Login ready for {credentials.full_name} ({credentials.emp_id}), role {credentials.role}.
      </p>
      <p className="mt-2 text-slate-700">Temporary password (shown only once, share it privately):</p>
      <code className="mt-1 block select-all rounded bg-white px-2 py-1 font-mono text-base">{credentials.temporary_password}</code>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={copyPassword} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100">
          {wasCopied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onDismiss} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100">
          Done, hide it
        </button>
      </div>
    </div>
  );
}
