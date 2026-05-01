"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  selectedIds: string[];
  onClear: () => void;
};

export default function BulkDismissBar({ selectedIds, onClear }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  async function dismiss(status: "false_positive" | "true_positive") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/events/bulk-dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk dismiss failed");
      onClear();
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm">
      <span className="font-mono text-zinc-300">
        <span className="text-zinc-100 font-semibold">{selectedIds.length}</span> selected
      </span>
      <div className="h-4 w-px bg-zinc-700" />
      <button
        type="button"
        disabled={loading || isPending}
        onClick={() => dismiss("false_positive")}
        className="rounded px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition disabled:opacity-40"
      >
        Mark false positive
      </button>
      <button
        type="button"
        disabled={loading || isPending}
        onClick={() => dismiss("true_positive")}
        className="rounded px-3 py-1 text-xs font-medium bg-emerald-700/60 text-emerald-200 hover:bg-emerald-700 transition disabled:opacity-40"
      >
        Mark true positive
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        Clear
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
