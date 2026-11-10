// Last safety net: if a page crashes while rendering, show a message instead of a blank screen.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasCrashed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasCrashed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasCrashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Page crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.hasCrashed) {
      return this.props.children;
    }
    return (
      <div className="mx-auto mt-24 max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">The page could not be shown. Reloading usually fixes this.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Reload page
        </button>
      </div>
    );
  }
}
