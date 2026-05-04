"use client";

import { useState } from "react";
import Link from "next/link";
import BulkDismissBar from "./BulkDismissBar";

type EventRow = {
  id: string;
  event_time: string;
  source_type: string;
  source_host: string | null;
  severity: string;
  mitre_technique: string;
  ai_reasoning: string | null;
  ai_summary: string | null;
  status: string;
  raw_payload: string;
  parsed: Record<string, unknown>;
};

const MITRE_NAMES: Record<string, string> = {
  "T1110.001": "Password Guessing",
  "T1110.003": "Password Spraying",
  "T1078":     "Valid Accounts",
  "T1548.003": "Sudo Abuse",
  "T1136":     "Create Account",
  "T1098":     "Account Manipulation",
};

function shortId(uuid: string) { return uuid.split("-")[0].toUpperCase(); }

function summarize(row: EventRow): string {
  if (row.ai_summary) return row.ai_summary;
  const p = row.parsed ?? {};
  const user = typeof p.username === "string" ? p.username : null;
  const ip   = typeof p.source_ip === "string" ? p.source_ip : null;
  const result = typeof p.auth_result === "string" ? p.auth_result : null;
  const service = typeof p.service === "string" ? p.service : row.source_type;
  if (user && ip && result) return service + " " + result + " for user " + user + " from " + ip;
  return row.raw_payload.slice(0, 200);
}

function severityBadgeClass(s: string) {
  switch (s) {
    case "critical": return "bg-red-500/15 text-red-300 border-red-500/40";
    case "high":     return "bg-orange-500/15 text-orange-300 border-orange-500/40";
    case "medium":   return "bg-yellow-500/15 text-yellow-300 border-yellow-500/40";
    case "low":      return "bg-blue-500/15 text-blue-300 border-blue-500/40";
    default:         return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

function statusBadgeClass(s: string) {
  switch (s) {
    case "open":           return "bg-sky-500/15 text-sky-300 border-sky-500/40";
    case "investigating":  return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "true_positive":  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "false_positive": return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
    default:               return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

type Props = {
  events: EventRow[];
  focusIdx?: number;
  onDelete?: (id: string) => void;
};

export default function SelectableEventList({ events, focusIdx = -1, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === events.length) setSelected(new Set());
    else setSelected(new Set(events.map(e => e.id)));
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(id);
    await onDelete?.(id);
    setDeleting(null);
  }

  const selectedIds = Array.from(selected);
  const allSelected = events.length > 0 && selected.size === events.length;

  return (
    <div className="space-y-3">
      {events.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            id="select-all"
            checked={allSelected}
            onChange={toggleAll}
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-zinc-400 cursor-pointer"
          />
          <label htmlFor="select-all" className="text-xs text-zinc-500 cursor-pointer select-none">
            {allSelected ? "Deselect all" : "Select all " + events.length}
          </label>
        </div>
      )}

      <BulkDismissBar selectedIds={selectedIds} onClear={() => setSelected(new Set())} />

      <ul className="space-y-2">
        {events.map((row, idx) => {
          const isSelected = selected.has(row.id);
          const isFocused  = idx === focusIdx;
          return (
            <li key={row.id} className="flex items-start gap-2 group">
              <div className="mt-4 flex-shrink-0 pl-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(row.id)}
                  onClick={e => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 accent-zinc-400 cursor-pointer"
                  aria-label={"Select event " + shortId(row.id)}
                />
              </div>

              <Link
                href={"/events/" + row.id}
                className={
                  "flex-1 block rounded-md border p-4 transition " +
                  (isFocused
                    ? "border-zinc-500 bg-zinc-800/80 ring-1 ring-zinc-500/40"
                    : isSelected
                      ? "border-zinc-600 bg-zinc-800/70"
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900/70")
                }
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 font-mono text-zinc-400">
                    EVT-{shortId(row.id)}
                  </span>
                  <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + statusBadgeClass(row.status)}>
                    {row.status.replace("_", " ")}
                  </span>
                  <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + severityBadgeClass(row.severity)}>
                    {row.severity}
                  </span>
                  {row.mitre_technique && row.mitre_technique !== "unknown" && (
                    <span className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-300">
                      {row.mitre_technique + " · " + (MITRE_NAMES[row.mitre_technique] ?? "")}
                    </span>
                  )}
                  <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-zinc-300">
                    {row.source_type}
                  </span>
                  {row.source_host && (
                    <span className="text-zinc-400">
                      host: <span className="text-zinc-200">{row.source_host}</span>
                    </span>
                  )}
                  <span className="ml-auto text-zinc-500">
                    {new Date(row.event_time).toISOString()}
                  </span>

                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="text-zinc-500">Observed:</span>{" "}
                    <span className="text-zinc-100">{summarize(row)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Why suspicious:</span>{" "}
                    {row.ai_reasoning
                      ? <span className="text-zinc-100">{row.ai_reasoning}</span>
                      : <span className="text-zinc-500 italic">not yet scored</span>}
                  </div>
                </div>
              </Link>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete({ preventDefault: ()=>{}, stopPropagation: ()=>{} } as React.MouseEvent, row.id)}
                  disabled={deleting === row.id}
                  className="mt-3 self-start rounded border border-red-900/40 bg-red-900/10 px-2 py-1.5 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition disabled:opacity-50 text-xs flex items-center gap-1"
                  aria-label="Delete event"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                  {deleting === row.id ? "Deleting…" : "Delete"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
