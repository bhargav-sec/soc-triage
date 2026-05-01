"use client";

import { useState } from "react";

type Severity = { label: string; value: number; color: string };

const COLORS: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#eab308",
  low:      "#3b82f6",
  unknown:  "#52525b",
};

type Props = { counts: Record<string, number> };

type ChartType = "bar" | "donut" | "table";

export default function SeverityChart({ counts }: Props) {
  const [chart, setChart] = useState<ChartType>("donut");

  const data: Severity[] = ["critical", "high", "medium", "low", "unknown"]
    .map(l => ({ label: l, value: counts[l] ?? 0, color: COLORS[l] }))
    .filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const max = Math.max(...data.map(d => d.value), 1);

  const btnClass = (t: ChartType) =>
    "px-2.5 py-1 rounded text-xs transition " +
    (chart === t
      ? "bg-zinc-700 text-zinc-100"
      : "text-zinc-500 hover:text-zinc-300");

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Severity Breakdown</h2>
        <div className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 p-0.5">
          <button className={btnClass("donut")} onClick={() => setChart("donut")} title="Donut chart">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/>
            </svg>
          </button>
          <button className={btnClass("bar")} onClick={() => setChart("bar")} title="Bar chart">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/>
            </svg>
          </button>
          <button className={btnClass("table")} onClick={() => setChart("table")} title="Table">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="1"/>
              <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        </div>
      </div>

      {data.length === 0 && <p className="text-sm text-zinc-600 italic">No data yet.</p>}

      {/* DONUT */}
      {chart === "donut" && data.length > 0 && (() => {
        const r = 40, cx = 56, cy = 56;
        const circ = 2 * Math.PI * r;
        let offset = 0;
        const slices = data.map(d => {
          const dash = (d.value / total) * circ;
          const s = { ...d, dash, offset };
          offset += dash;
          return s;
        });
        return (
          <div className="flex items-center gap-6">
            <svg width="112" height="112" viewBox="0 0 112 112">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="18"/>
              {slices.map(s => (
                <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color} strokeWidth="18"
                  strokeDasharray={`${s.dash} ${circ - s.dash}`}
                  strokeDashoffset={circ / 4 - s.offset}
                />
              ))}
              <text x={cx} y={cy - 4} textAnchor="middle" fill="#e4e4e7" fontSize="18" fontWeight="bold" fontFamily="monospace">{total}</text>
              <text x={cx} y={cy + 11} textAnchor="middle" fill="#71717a" fontSize="8">total</text>
            </svg>
            <ul className="space-y-2">
              {slices.map(s => (
                <li key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{background: s.color}}/>
                  <span className="uppercase text-zinc-400 w-16">{s.label}</span>
                  <span className="tabular-nums text-zinc-200 font-mono">{s.value}</span>
                  <span className="text-zinc-600">({Math.round((s.value/total)*100)}%)</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* BAR */}
      {chart === "bar" && data.length > 0 && (
        <div className="space-y-3">
          {data.map(d => (
            <div key={d.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase font-medium" style={{color: d.color}}>{d.label}</span>
                <span className="tabular-nums text-zinc-400">{d.value} <span className="text-zinc-600">({Math.round((d.value/total)*100)}%)</span></span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{width: Math.round((d.value/max)*100)+"%", background: d.color}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABLE */}
      {chart === "table" && data.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="pb-2 text-left text-zinc-500 font-medium">Severity</th>
              <th className="pb-2 text-right text-zinc-500 font-medium">Count</th>
              <th className="pb-2 text-right text-zinc-500 font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {data.map(d => (
              <tr key={d.label}>
                <td className="py-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{background: d.color}}/>
                  <span className="uppercase font-medium" style={{color: d.color}}>{d.label}</span>
                </td>
                <td className="py-2 text-right tabular-nums text-zinc-200">{d.value}</td>
                <td className="py-2 text-right tabular-nums text-zinc-500">{Math.round((d.value/total)*100)}%</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-700">
              <td className="pt-2 text-zinc-400 font-medium">Total</td>
              <td className="pt-2 text-right tabular-nums text-zinc-200 font-semibold">{total}</td>
              <td className="pt-2 text-right text-zinc-500">100%</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
