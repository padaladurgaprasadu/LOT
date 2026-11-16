'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    // Log unexpected errors for diagnostics
    console.error('[LOT-OS Root Error Boundary]:', error);
  }, [error]);

  const handleHardReset = () => {
    setClearing(true);
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof window !== 'undefined' && window.indexedDB) {
        window.indexedDB.deleteDatabase('lot_ai_db');
        window.indexedDB.deleteDatabase('lot_local_chat_db');
      }
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white select-none">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <div className="p-2 rounded-xl bg-red-950/60 border border-red-800/60">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h2 className="text-base font-semibold tracking-wide text-white">System Anomaly Detected</h2>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          LOT-OS encountered an unexpected runtime exception in the cognitive stream or workspace. Click Reset State below to immediately recover cleanly.
        </p>

        {error?.message && (
          <div className="mt-3 rounded-xl bg-neutral-900/80 border border-neutral-800 p-2.5 font-mono text-[11px] text-red-300 break-words">
            {error.message}
          </div>
        )}

        {error?.digest && (
          <div className="mt-2 text-[10px] text-neutral-500 font-mono">
            Digest: {error.digest}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleHardReset}
            disabled={clearing}
            className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{clearing ? "Resetting State..." : "Reset State"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
