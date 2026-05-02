"use client";

import { useState } from "react";
import SelectableEventList from "./SelectableEventList";
import HostGroupedList from "./HostGroupedList";

type EventRow = Parameters<typeof SelectableEventList>[0]["events"][number];

type Props = { events: EventRow[] };

export default function QueueEventList({ events }: Props) {
  const [grouped, setGrouped] = useState(false);
  const hasMultipleHosts = new Set(events.map(e => e.source_host)).size > 1;

  return (
    <div className="space-y-3">
      {hasMultipleHosts && (
        <div className="flex justify-end">
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
          </button>
        </div>
      )}
      {grouped
        ? <HostGroupedList events={events} />
        : <SelectableEventList events={events} />
      }
    </div>
  );
}
