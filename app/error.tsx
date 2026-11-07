'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors for monitoring
    console.error('[LOT-OS Root Error Boundary]:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-6 w-6 flex-shrink-0" />
          <h2 className="text-lg font-semibold tracking-wide">System Anomaly Detected</h2>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          LOT-OS encountered an unexpected runtime exception in the cognitive stream or workspace.
        </p>
        {error.digest && (
          <div className="mt-3 rounded bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-500">
            Digest: {error.digest}
          </div>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Reset State
          </button>
        </div>
      </div>
    </div>
  );
}
