"use client";

import { useState } from "react";
import Link from "next/link";

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
  "T1078": "Valid Accounts",
  "T1548.003": "Sudo Abuse",
  "T1136": "Create Account",
  "T1098": "Account Manipulation",
};

function shortId(uuid: string) { return uuid.split("-")[0].toUpperCase(); }

function summarize(row: EventRow): string {
  if (row.ai_summary) return row.ai_summary;
  const p = row.parsed ?? {};
  const user = typeof p.username === "string" ? p.username : null;
  const ip = typeof p.source_ip === "string" ? p.source_ip : null;
  const result = typeof p.auth_result === "string" ? p.auth_result : null;
  const service = typeof p.service === "string" ? p.service : row.source_type;
  if (user && ip && result) return service + " " + result + " for user " + user + " from " + ip;
  return row.raw_payload.slice(0, 120);
}

function severityColor(s: string) {
  switch (s) {
    case "critical": return "#ef4444";
    case "high":     return "#f97316";
    case "medium":   return "#eab308";
    case "low":      return "#3b82f6";
    default:         return "#52525b";
  }
}

function severityBadge(s: string) {
  switch (s) {
    case "critical": return "bg-red-500/15 text-red-300 border-red-500/40";
    case "high":     return "bg-orange-500/15 text-orange-300 border-orange-500/40";
    case "medium":   return "bg-yellow-500/15 text-yellow-300 border-yellow-500/40";
    case "low":      return "bg-blue-500/15 text-blue-300 border-blue-500/40";
    default:         return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

type Props = { events: EventRow[] };

export default function HostGroupedList({ events }: Props) {
  // Group by source_host
  const groups: Record<string, EventRow[]> = {};
  for (const e of events) {
    const key = e.source_host ?? "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(host: string) {
    setCollapsed(prev => ({ ...prev, [host]: !prev[host] }));
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([host, rows]) => {
        const isCollapsed = collapsed[host];
        const severities = rows.map(r => r.severity);
        const hasCritical = severities.includes("critical");
        const hasHigh = severities.includes("high");
        const topSev = hasCritical ? "critical" : hasHigh ? "high" : severities[0] ?? "unknown";

        return (
          <div key={host} className="rounded-md border border-zinc-800 bg-zinc-900/30 overflow-hidden">
            {/* Host header */}
            <button
              type="button"
              onClick={() => toggle(host)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition text-left"
            >
              <div className="h-2 w-2 rounded-full shrink-0" style={{background: severityColor(topSev)}} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-zinc-500 shrink-0">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <span className="font-mono text-sm text-zinc-200">{host}</span>
              <span className="text-xs text-zinc-500">{rows.length} event{rows.length !== 1 ? "s" : ""}</span>
              <Link
                href={"/hosts/" + encodeURIComponent(host)}
                onClick={e => e.stopPropagation()}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition mr-2"
              >
                View timeline →
              </Link>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={"text-zinc-600 transition-transform " + (isCollapsed ? "" : "rotate-180")}
              >
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>

            {/* Events */}
            {!isCollapsed && (
              <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">
                {rows.map(row => (
                  <Link
                    key={row.id}
                    href={"/events/" + row.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-800/30 transition"
                  >
                    <div className="mt-1 h-2 w-2 rounded-full shrink-0" style={{background: severityColor(row.severity)}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-zinc-500">EVT-{shortId(row.id)}</span>
                        <span className={"rounded border px-1.5 py-0.5 font-medium uppercase " + severityBadge(row.severity)}>
                          {row.severity}
                        </span>
                        {row.mitre_technique && row.mitre_technique !== "unknown" && (
                          <span className="rounded border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-purple-300">
                            {row.mitre_technique} · {MITRE_NAMES[row.mitre_technique] ?? ""}
                          </span>
                        )}
                        <span className="ml-auto text-zinc-500 tabular-nums">
                          {new Date(row.event_time).toISOString().replace("T"," ").slice(0,19)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400 truncate">{summarize(row)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
