import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { changePassword } from "../api/auth";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { describeError } from "../lib/errors";
import { validateNewPassword, validateRequired } from "../lib/validation";

export function ChangePasswordPage() {
  const { session, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: () =>
      changePassword(session!.accessToken, { current_password: currentPassword, new_password: newPassword }),
    // The backend ends all older sessions after a password change, so log in again with the new password.
    onSuccess: () => signOut("Password changed. Please log in with your new password."),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const currentProblem = validateRequired(currentPassword, "your current password");
    const newProblem = validateNewPassword(newPassword, currentPassword);
    const confirmProblem = newPassword !== confirmPassword ? "The two new passwords do not match." : null;
    setCurrentError(currentProblem);
    setNewError(newProblem);
    setConfirmError(confirmProblem);
    if (currentProblem || newProblem || confirmProblem) {
      return;
    }
    changeMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={handleSubmit} noValidate className="card space-y-4">
        <h1 className="page-title">Change password</h1>
        {session?.mustChangePassword && (
          <p className="notice border-warn/30 bg-warn-soft text-warn">
            You are using a temporary password. Choose a new one to continue.
          </p>
        )}
        <FormField
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          errorMessage={currentError}
          autoComplete="current-password"
        />
        <FormField
          label="New password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          errorMessage={newError}
          autoComplete="new-password"
        />
        <FormField
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          errorMessage={confirmError}
          autoComplete="new-password"
        />
        {changeMutation.isError && <ErrorMessage message={describeError(changeMutation.error)} />}
        <button
          type="submit"
          disabled={changeMutation.isPending}
          className="btn btn-primary w-full"
        >
          {changeMutation.isPending ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
