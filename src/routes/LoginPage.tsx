import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { login } from "../api/auth";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { describeError } from "../lib/errors";
import { validateEmployeeId, validateRequired } from "../lib/validation";

export function LoginPage() {
  const { session, signIn, loginNotice, clearLoginNotice } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [employeeIdError, setEmployeeIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login({ emp_id: employeeId.trim(), password }),
    onSuccess: (loginResponse) => {
      signIn(loginResponse);
      navigate(loginResponse.must_change_password ? "/change-password" : "/chat", { replace: true });
    },
  });

  if (session) {
    return <Navigate to={session.mustChangePassword ? "/change-password" : "/chat"} replace />;
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Log in</h1>
        <p className="text-sm text-slate-600">Use the employee ID and password given to you by HR.</p>
        {loginNotice && (
          <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {loginNotice}
          </p>
        )}
        <FormField
          label="Employee ID"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
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
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loginMutation.isPending ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
