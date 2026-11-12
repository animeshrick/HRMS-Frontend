// Small building blocks used on every page, so spacing, radius and colour are decided once.
import type { ReactNode } from "react";

/** The title of a page, with an optional line under it and actions on the right. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A surface: a 1 px line and a soft radius, no shadow. */
export function Card({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type Tone = "ok" | "warn" | "bad" | "leave" | "holiday" | "neutral" | "brand";
const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  leave: "bg-leave-soft text-leave",
  holiday: "bg-holiday-soft text-holiday",
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>{children}</span>;
}

// Class strings for buttons and inputs, so a plain <button> and a plain <input> look the same everywhere.
export const BUTTON_PRIMARY = "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition hover:opacity-90 disabled:opacity-50";
export const BUTTON_QUIET = "rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:bg-surface-2 disabled:opacity-50";
export const BUTTON_OK = "rounded-lg bg-ok px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:text-black";
export const BUTTON_BAD = "rounded-lg bg-bad px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 dark:text-black";
export const INPUT = "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
