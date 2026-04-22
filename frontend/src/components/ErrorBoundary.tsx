"use client";

import { Component, ReactNode } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { trackError } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. If omitted, a generic error card is shown. */
  fallback?: ReactNode;
  /** Label shown in the error card to help identify which section crashed. */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches runtime errors in any child component tree and renders a fallback
 * instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary label="Risk Register">
 *     <RisksTable />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    trackError(error, {
      component: this.props.label ?? "ErrorBoundary",
    });
    // Keep the console log in dev for easy debugging
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
            <ExclamationTriangleIcon className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">
              {this.props.label ? `${this.props.label} failed to load` : "Something went wrong"}
            </p>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">
              An unexpected error occurred. Try refreshing — if the problem persists, contact your administrator.
            </p>
            {this.state.message && (
              <p className="mt-2 text-xs font-mono text-red-400 bg-red-50 rounded px-3 py-1 inline-block">
                {this.state.message}
              </p>
            )}
          </div>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
