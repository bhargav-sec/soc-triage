"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { totalCount: number };

export default function QueueControls({ totalCount }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
    setLastRefresh(new Date());
  }, [router]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  // Expose search to parent via a data attribute on a hidden input
  // so QueueEventList can filter client-side
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          id="queue-search"
          type="search"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            // dispatch custom event so QueueEventList can react
            window.dispatchEvent(new CustomEvent("queue-search", { detail: e.target.value }));
          }}
          placeholder="Search host, user, IP, MITRE…"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      {/* Auto-refresh toggle */}
      <button
        type="button"
        onClick={() => setAutoRefresh(r => !r)}
        className={
          "flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition " +
          (autoRefresh
            ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-300"
            : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300")
        }
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={autoRefresh ? "animate-spin" : ""} style={autoRefresh ? {animationDuration:"3s"} : {}}>
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        {autoRefresh ? "Live · 15s" : "Auto-refresh"}
      </button>

      {/* Manual refresh */}
      <button
        type="button"
        onClick={refresh}
        className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
        title={"Last refreshed " + lastRefresh.toLocaleTimeString()}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        </svg>
        Refresh
      </button>

      <span className="text-xs text-zinc-600 ml-auto">{totalCount} events</span>
    </div>
  );
}
