// Small confirmations ("Checked in at 10:05 AM") that appear at the bottom and go away by themselves.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type ToastKind = "success" | "error";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

// Outside a provider (a test that renders one page alone) the calls do nothing.
const ToastContext = createContext<ToastApi>({ success: () => undefined, error: () => undefined });

const SHOW_MILLISECONDS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdReference = useRef(1);

  const add = useCallback((kind: ToastKind, text: string) => {
    const id = nextIdReference.current++;
    setToasts((current) => [...current.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), SHOW_MILLISECONDS);
  }, []);

  const api = useMemo<ToastApi>(() => ({ success: (text) => add("success", text), error: (text) => add("error", text) }), [add]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-pop"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${toast.kind === "success" ? "bg-ok" : "bg-bad"}`} />
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
