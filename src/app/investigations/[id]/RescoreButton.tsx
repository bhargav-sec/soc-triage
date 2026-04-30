"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { investigationId: string };

export default function RescoreButton({ investigationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rescored: number; severity: string } | null>(null);

  async function handleRescore() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/investigations/" + investigationId + "/rescore", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rescore failed");
      setResult({ rescored: data.rescored, severity: data.severity });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rescore failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading || isPending}
        onClick={handleRescore}
        className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Rescoring all events…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/>
            </svg>
            Rescore all events with AI
          </>
        )}
      </button>
      {result && !error && (
        <p className="text-xs text-emerald-400">
          Rescored {result.rescored} event{result.rescored === 1 ? "" : "s"} — dominant severity: {result.severity}.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}