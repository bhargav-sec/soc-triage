"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SelectableEventList from "./SelectableEventList";
import HostGroupedList from "./HostGroupedList";

type EventRow = Parameters<typeof SelectableEventList>[0]["events"][number];

type Props = { events: EventRow[] };

export default function QueueEventList({ events }: Props) {
  const router = useRouter();
  const [grouped, setGrouped] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Listen for search from QueueControls
  useEffect(() => {
    const handler = (e: Event) => setSearch((e as CustomEvent).detail ?? "");
    window.addEventListener("queue-search", handler);
    return () => window.removeEventListener("queue-search", handler);
  }, []);

  // Filter events
  const filtered = search.trim()
    ? events.filter(e => {
        const q = search.toLowerCase();
        return (
          (e.source_host ?? "").toLowerCase().includes(q) ||
          (e.source_type ?? "").toLowerCase().includes(q) ||
          (e.mitre_technique ?? "").toLowerCase().includes(q) ||
          (e.ai_summary ?? "").toLowerCase().includes(q) ||
          (e.raw_payload ?? "").toLowerCase().includes(q) ||
          Object.values(e.parsed ?? {}).some(v => String(v).toLowerCase().includes(q))
        );
      })
    : events;

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "j") {
        e.preventDefault();
        setFocusIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusIdx >= 0 && filtered[focusIdx]) {
        router.push("/events/" + filtered[focusIdx].id);
      } else if (e.key === "g") {
        setGrouped(g => !g);
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("queue-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusIdx, filtered, router]);

  // Delete handler
  async function deleteEvent(id: string) {
    await fetch("/api/events/" + id, { method: "DELETE" });
    router.refresh();
  }

  const hasMultipleHosts = new Set(events.map(e => e.source_host)).size > 1;

  return (
    <div className="space-y-3" ref={listRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {hasMultipleHosts && (
          <button
            type="button"
            onClick={() => setGrouped(g => !g)}
            className={
              "flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition " +
              (grouped
                ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300")
            }
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
            {grouped ? "Ungrouped" : "Group by host"}
            <kbd className="ml-1 rounded bg-zinc-700/60 px-1 py-0.5 font-mono text-zinc-500" style={{fontSize:"9px"}}>G</kbd>
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-zinc-600" style={{fontSize:"10px"}}>
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">j/k</kbd> navigate
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">↵</kbd> open
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">/</kbd> search
        </div>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-zinc-600">
          {search ? `No events matching "${search}"` : "No events"}
        </div>
      )}

      {/* List */}
      {grouped
        ? <HostGroupedList events={filtered} />
        : <SelectableEventList
            events={filtered}
            focusIdx={focusIdx}
            onDelete={deleteEvent}
          />
      }
    </div>
  );
}
