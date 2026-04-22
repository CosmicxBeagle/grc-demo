import { useEffect } from "react";

/**
 * Adds a browser-level "You have unsaved changes" prompt when the user tries
 * to close the tab or navigate away.  Fires only when `isDirty` is true.
 *
 * This covers the case that can't be caught by an in-app confirm() dialog:
 *   • Cmd/Ctrl+W  (close tab)
 *   • F5 / Cmd+R  (refresh page)
 *   • Typing a new URL in the address bar
 *   • Browser back/forward outside Next.js router
 *
 * Note: the browser ignores any custom message string in modern browsers —
 * it shows its own generic dialog.  The only thing that matters is calling
 * event.preventDefault() and setting event.returnValue.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for legacy browser compatibility
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
