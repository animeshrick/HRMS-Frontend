import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string | null;
  prefix?: string; // fixed text shown inside the box before what the person types, for example "EMP-"
}

const INPUT_CLASS =
  "mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand aria-[invalid=true]:border-bad";

/** An eye (password hidden, click to show) or a crossed eye (password shown, click to hide). */
function EyeIcon({ isCrossed }: { isCrossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {isCrossed && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** A label, an input and its error text, wired together for screen readers. Password fields get an eye button. */
export function FormField({ label, errorMessage, id, type, prefix, ...inputProperties }: FormFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const isPasswordField = type === "password";
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputType = isPasswordField && isPasswordVisible ? "text" : type;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? `${inputId}-error` : undefined}
          className={isPasswordField ? `${INPUT_CLASS} pr-10` : prefix ? `${INPUT_CLASS} pl-12` : INPUT_CLASS}
          {...inputProperties}
        />
        {prefix && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 mt-1 flex items-center pl-3 text-sm text-ink-3">
            {prefix}
          </span>
        )}
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
            aria-pressed={isPasswordVisible}
            title={isPasswordVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 mt-1 flex items-center px-3 text-ink-3 hover:text-ink-2"
          >
            <EyeIcon isCrossed={isPasswordVisible} />
            <span className="sr-only">{isPasswordVisible ? "Hide password" : "Show password"}</span>
          </button>
        )}
      </div>
      {errorMessage && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-bad">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
