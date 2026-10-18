import { Component, type ReactNode } from "react";
import { ISSUES_URL } from "../lib/brand";

/** Last line of defence: a readable page instead of a blank screen, with a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="display-heading text-3xl font-semibold">Something broke</h1>
        <p className="text-muted">
          The page hit an unexpected error. Your setup is saved in this browser; reloading usually fixes it. If it keeps happening,
          clearing the saved setup starts fresh.
        </p>
        <pre className="pixel slot overflow-x-auto p-3 font-mono text-xs text-muted">{this.state.error.message}</pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pixel btn-primary h-11 px-4 font-semibold" onClick={() => location.reload()}>Reload</button>
          <button
            type="button"
            className="pixel btn-secondary h-11 px-4 font-semibold"
            onClick={() => {
              try {
                localStorage.removeItem("composter:v1");
              } catch {
                // Nothing saved to clear.
              }
              location.hash = "";
              location.reload();
            }}
          >
            Clear saved setup
          </button>
          <a className="pixel inline-flex h-11 items-center px-4 font-semibold text-copper-ink underline" href={ISSUES_URL} target="_blank" rel="noreferrer">
            Report it
          </a>
        </div>
      </main>
    );
  }
}
