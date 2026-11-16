'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

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

  const handleReset = () => {
    try {
      if (typeof window !== "undefined") {
        // Clear active conversation pointer so stale/corrupt chat is bypassed
        localStorage.removeItem("lot_current_conv_id_v1");
        localStorage.removeItem("lot_active_session_id");
      }
    } catch {}
    reset();
  };

  const handleFullRecovery = () => {
    setClearing(true);
    try {
      if (typeof window !== "undefined") {
        // Safe clear of local state to ensure 100% clean recovery
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      }
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white select-none">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <div className="p-2 rounded-xl bg-red-950/60 border border-red-800/60">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <h2 className="text-base font-semibold tracking-wide text-white">System Anomaly Recovered</h2>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          LOT-OS intercepted an unexpected runtime state. You can safely reset the active session or clear cached workspace data to reload cleanly.
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

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleFullRecovery}
            disabled={clearing}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>Clear Cache & Reload</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reset Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
