"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw, Bug, ShieldAlert } from "lucide-react";

export interface WorkspaceErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

export interface WorkspaceErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  public state: WorkspaceErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): WorkspaceErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WorkspaceErrorBoundary] Intercepted canvas exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center p-6 bg-[#09090c] text-white">
          <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-950/20 backdrop-blur-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">
                {this.props.fallbackTitle || "Workspace Canvas Runtime Crash"}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                An isolated exception was intercepted in this workspace runtime. The core OS shell
                remains stable and active.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-black/70 rounded-lg p-3 border border-red-500/20 font-mono text-[11px] text-red-300 max-h-40 overflow-y-auto custom-scrollbar">
                <div className="font-semibold text-red-400 mb-1 flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5" />
                  <span>{this.state.error.name}:</span>
                </div>
                <p className="break-words">{this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-[10px] text-zinc-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Recover Canvas</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WorkspaceErrorBoundary;
