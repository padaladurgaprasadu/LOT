import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center shadow-2xl">
        <div className="flex justify-center text-zinc-400">
          <Compass className="h-10 w-10 animate-pulse text-zinc-500" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">404 - Workspace Not Found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The requested agent workspace, canvas route, or resource coordinate does not exist in this LOT-OS cluster.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Core Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
