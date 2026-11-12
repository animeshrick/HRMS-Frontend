import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { login } from "../api/auth";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { describeError } from "../lib/errors";
import { validateEmployeeId, validateRequired } from "../lib/validation";

const EMPLOYEE_ID_PREFIX = "EMP-";

export function LoginPage() {
  const { session, signIn, loginNotice, clearLoginNotice } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [employeeIdError, setEmployeeIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login({ emp_id: EMPLOYEE_ID_PREFIX + employeeId.trim(), password }),
    onSuccess: (loginResponse) => {
      signIn(loginResponse);
      navigate(loginResponse.must_change_password ? "/change-password" : "/home", { replace: true });
    },
  });

  if (session) {
    return <Navigate to={session.mustChangePassword ? "/change-password" : "/home"} replace />;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const idProblem = validateEmployeeId(employeeId);
    const passwordProblem = validateRequired(password, "the password");
    setEmployeeIdError(idProblem);
    setPasswordError(passwordProblem);
    if (idProblem || passwordProblem) {
      return;
    }
    clearLoginNotice();
    loginMutation.mutate();
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-1/2 flex-col justify-between bg-side p-10 text-side-ink lg:flex">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-bold text-brand-ink">H</span>
          <span className="text-base font-semibold text-white">HR Assistant</span>
        </div>
        <div>
          <p className="max-w-md text-3xl font-semibold leading-tight text-white">Leave, attendance and policy answers in one place.</p>
          <p className="mt-3 max-w-md text-sm text-side-ink/80">Ask in plain words, check in for the day and track your requests.</p>
        </div>
        <p className="text-xs text-side-ink/60">Semicolon Marketing</p>
      </aside>
      <div className="flex flex-1 items-center justify-center px-4">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Log in</h1>
        <p className="text-sm text-ink-2">Use the employee ID and password given to you by HR.</p>
        {loginNotice && (
          <p role="status" className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
            {loginNotice}
          </p>
        )}
        <FormField
          label="Employee ID"
          value={employeeId}
          prefix={EMPLOYEE_ID_PREFIX}
          // A pasted "EMP-1001" keeps only "1001", because the prefix is already there.
          onChange={(event) => setEmployeeId(event.target.value.replace(/^\s*EMP-/i, ""))}
          errorMessage={employeeIdError}
          autoComplete="username"
          autoFocus
        />
        <FormField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          errorMessage={passwordError}
          autoComplete="current-password"
        />
        {loginMutation.isError && <ErrorMessage message={describeError(loginMutation.error)} />}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90 disabled:opacity-60"
        >
          {loginMutation.isPending ? "Logging in..." : "Log in"}
        </button>
      </form>
      </div>
    </div>
  );
}
