"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { label: string; eventCount: number };

export default function DeleteSourceButton({ label, eventCount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        "/api/sources/" + encodeURIComponent(label),
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">
          Delete {eventCount} event{eventCount === 1 ? "" : "s"}?
        </span>
        <button
          type="button"
          disabled={loading || isPending}
          onClick={handleDelete}
          className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20 transition disabled:opacity-40"
        >
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 transition"
    >
      Delete
    </button>
  );
}