import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createEmployee, registerEmployee, resetEmployeePassword } from "../api/admin";
import { addOfficeNetwork, getAttendanceAdminSettings, setNetworkCheck, setOfficeNetworkActive } from "../api/attendanceAdmin";
import type { CredentialsResponse, EmployeeSummary, OfficeNetwork, Role } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { describeError } from "../lib/errors";
import { validateEmployeeId, validateRequired } from "../lib/validation";

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
    <div className="page page-narrow">
      <h1 className="page-title">HR admin</h1>

      {shownCredentials && (
        <CredentialsCard credentials={shownCredentials} onDismiss={() => setShownCredentials(null)} />
      )}

      <AddEmployeeCard token={token} onCreated={(summary) => setCreateEmployeeId(summary.emp_id)} />

      <form onSubmit={handleCreate} noValidate className="card space-y-3">
        <h2 className="section-title">Create a login</h2>
        <FormField
          label="Employee ID to create"
          value={createEmployeeId}
          onChange={(event) => setCreateEmployeeId(event.target.value)}
          errorMessage={createError}
        />
        <div>
          <label htmlFor="create-role" className="block text-sm font-medium text-ink-2">
            Role
          </label>
          <select
            id="create-role"
            value={createRole}
            onChange={(event) => setCreateRole(event.target.value as Role)}
            className="field mt-1 block w-full"
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
          className="btn btn-primary"
        >
          {createMutation.isPending ? "Creating..." : "Create login"}
        </button>
      </form>

      <form onSubmit={handleReset} noValidate className="card space-y-3">
        <h2 className="section-title">Reset a password</h2>
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
          className="btn btn-primary"
        >
          {resetMutation.isPending ? "Resetting..." : "Reset password"}
        </button>
      </form>

      <OfficeNetworkCard token={token} />
    </div>
  );
}

function AddEmployeeCard({ token, onCreated }: { token: string; onCreated: (summary: EmployeeSummary) => void }) {
  const [empId, setEmpId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ empId?: string | null; fullName?: string | null; email?: string | null }>({});
  const [lastCreated, setLastCreated] = useState<EmployeeSummary | null>(null);

  const createEmployeeMutation = useMutation({
    mutationFn: () =>
      createEmployee(token, {
        emp_id: empId.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        dept: dept.trim() || null,
        phone: phone.trim() || null,
        date_of_birth: dateOfBirth || null,
        date_of_joining: dateOfJoining || null,
      }),
    onSuccess: (summary) => {
      setLastCreated(summary);
      setEmpId("");
      setFullName("");
      setEmail("");
      setDept("");
      setPhone("");
      setDateOfBirth("");
      setDateOfJoining("");
      onCreated(summary);
    },
  });

  function handleAddEmployee(event: FormEvent) {
    event.preventDefault();
    const errors = {
      empId: validateEmployeeId(empId),
      fullName: validateRequired(fullName.trim(), "the full name"),
      email: validateRequired(email.trim(), "the email"),
    };
    setFieldErrors(errors);
    if (!errors.empId && !errors.fullName && !errors.email) {
      setLastCreated(null);
      createEmployeeMutation.mutate();
    }
  }

  return (
    <form onSubmit={handleAddEmployee} noValidate className="card space-y-3">
      <h2 className="section-title">Add an employee</h2>
      <p className="text-sm text-ink-2">Adds the employee record. Create a login for them below once this is done.</p>
      {lastCreated && (
        <p role="status" className="text-sm text-ok">
          {lastCreated.full_name} ({lastCreated.emp_id}) added.
        </p>
      )}
      <FormField label="Employee ID" value={empId} onChange={(event) => setEmpId(event.target.value)} errorMessage={fieldErrors.empId} />
      <FormField label="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} errorMessage={fieldErrors.fullName} />
      <FormField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} errorMessage={fieldErrors.email} />
      <FormField label="Department" value={dept} onChange={(event) => setDept(event.target.value)} placeholder="IT, Sales, Design..." />
      <FormField label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      <FormField label="Date of birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
      <FormField label="Date of joining" type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} />
      {createEmployeeMutation.isError && <ErrorMessage message={describeError(createEmployeeMutation.error)} />}
      <button type="submit" disabled={createEmployeeMutation.isPending} className="btn btn-primary">
        {createEmployeeMutation.isPending ? "Adding..." : "Add employee"}
      </button>
    </form>
  );
}

function OfficeNetworkCard({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["attendance-admin-settings"], queryFn: () => getAttendanceAdminSettings(token) });

  const [label, setLabel] = useState("");
  const [cidr, setCidr] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function invalidateSettings() {
    queryClient.invalidateQueries({ queryKey: ["attendance-admin-settings"] });
  }

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => setNetworkCheck(token, { enabled }),
    onSuccess: invalidateSettings,
  });

  const addMutation = useMutation({
    mutationFn: () => addOfficeNetwork(token, { label: label.trim(), cidr: cidr.trim() }),
    onSuccess: () => {
      setLabel("");
      setCidr("");
      invalidateSettings();
    },
  });

  const toggleNetworkMutation = useMutation({
    mutationFn: (network: OfficeNetwork) => setOfficeNetworkActive(token, network.id, !network.is_active),
    onSuccess: invalidateSettings,
  });

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!label.trim() || !cidr.trim()) {
      setAddError("Please give both a label and a network address.");
      return;
    }
    setAddError(null);
    addMutation.mutate();
  }

  const settings = settingsQuery.data;
  const hasActiveNetwork = (settings?.office_networks ?? []).some((network) => network.is_active);

  return (
    <div className="card space-y-3">
      <h2 className="section-title">Office network</h2>
      <p className="text-sm text-ink-2">
        When the switch below is on, check-in and check-out work only from an active network listed here. Add and
        activate at least one network before turning it on, or everyone is locked out of check-in and check-out.
      </p>

      {settingsQuery.isLoading && <p className="text-sm text-ink-3">Loading...</p>}
      {settingsQuery.isError && <ErrorMessage message={describeError(settingsQuery.error)} />}

      {settings && (
        <>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={settings.network_check_enabled}
              disabled={toggleMutation.isPending || (!settings.network_check_enabled && !hasActiveNetwork)}
              onChange={(event) => toggleMutation.mutate(event.target.checked)}
            />
            Restrict check-in and check-out to the office network
          </label>
          {toggleMutation.isError && <ErrorMessage message={describeError(toggleMutation.error)} />}

          {settings.office_networks.length > 0 ? (
            <ul className="space-y-1.5">
              {settings.office_networks.map((network) => (
                <li key={network.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-ink">{network.label}</span>{" "}
                    <code className="text-ink-2">{network.cidr}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleNetworkMutation.mutate(network)}
                    disabled={toggleNetworkMutation.isPending}
                    className="btn btn-sm btn-quiet"
                  >
                    {network.is_active ? "Active - turn off" : "Inactive - turn on"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No office networks yet.</p>
          )}
          {toggleNetworkMutation.isError && <ErrorMessage message={describeError(toggleNetworkMutation.error)} />}
        </>
      )}

      <form onSubmit={handleAdd} noValidate className="space-y-2 border-t border-line pt-3">
        <h3 className="text-sm font-semibold text-ink">Add a network</h3>
        <FormField label="Label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Kolkata office" />
        <FormField
          label="Network address (CIDR)"
          value={cidr}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="203.0.113.0/24"
        />
        {addError && <ErrorMessage message={addError} />}
        {addMutation.isError && <ErrorMessage message={describeError(addMutation.error)} />}
        <button type="submit" disabled={addMutation.isPending} className="btn btn-sm btn-quiet">
          {addMutation.isPending ? "Adding..." : "Add network"}
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
    <div role="status" className="rounded-lg border border-ok/30 bg-ok-soft p-4 text-sm">
      <p className="font-medium text-ok">
        Login ready for {credentials.full_name} ({credentials.emp_id}), role {credentials.role}.
      </p>
      <p className="mt-2 text-ink-2">Temporary password (shown only once, share it privately):</p>
      <code className="mt-1 block select-all rounded bg-surface px-2 py-1 font-mono text-base">{credentials.temporary_password}</code>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={copyPassword} className="btn btn-sm btn-quiet">
          {wasCopied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onDismiss} className="btn btn-sm btn-quiet">
          Done, hide it
        </button>
      </div>
    </div>
  );
}
