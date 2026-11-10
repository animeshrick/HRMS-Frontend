import { useState } from "react";
import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string | null;
}

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-[invalid=true]:border-red-500";

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
export function FormField({ label, errorMessage, id, type, ...inputProperties }: FormFieldProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const isPasswordField = type === "password";
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputType = isPasswordField && isPasswordVisible ? "text" : type;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? `${inputId}-error` : undefined}
          className={isPasswordField ? `${INPUT_CLASS} pr-10` : INPUT_CLASS}
          {...inputProperties}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
            aria-pressed={isPasswordVisible}
            title={isPasswordVisible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 mt-1 flex items-center px-3 text-slate-500 hover:text-slate-700"
          >
            <EyeIcon isCrossed={isPasswordVisible} />
            <span className="sr-only">{isPasswordVisible ? "Hide password" : "Show password"}</span>
          </button>
        )}
      </div>
      {errorMessage && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
