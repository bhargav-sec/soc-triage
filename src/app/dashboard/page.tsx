import { getSupabaseServerClient } from "@/lib/supabase";
import Link from "next/link";

import SeverityChart from "./SeverityChart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getDashboardData() {
  const supabase = getSupabaseServerClient();

  const [
    totalResult,
    openResult,
    investigatingResult,
    closedResult,
    severityResult,
    mitreResult,
    recentCriticalResult,
    hourlyResult,
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "investigating"),
    supabase.from("events").select("id", { count: "exact", head: true }).in("status", ["true_positive", "false_positive"]),
    supabase.from("events").select("severity"),
    supabase.from("events").select("mitre_technique").neq("mitre_technique", "unknown").not("mitre_technique", "is", null),
    supabase.from("events").select("id, event_time, severity, source_type, ai_summary, raw_payload, status, source_host").in("severity", ["critical", "high"]).order("received_at", { ascending: false }).limit(10),
    supabase.from("events").select("received_at").gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order("received_at", { ascending: true }),
  ]);

  // Severity counts
  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const r of severityResult.data ?? []) {
    const s = (r as { severity: string }).severity ?? "unknown";
    sevCounts[s] = (sevCounts[s] ?? 0) + 1;
  }

  // MITRE counts
  const mitreCounts: Record<string, number> = {};
  for (const r of mitreResult.data ?? []) {
    const t = (r as { mitre_technique: string }).mitre_technique;
    if (t) mitreCounts[t] = (mitreCounts[t] ?? 0) + 1;
  }
  const topMitre = Object.entries(mitreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Hourly buckets (last 24h)
  const hourlyBuckets: Record<number, number> = {};
  for (let i = 0; i < 24; i++) hourlyBuckets[i] = 0;
  for (const r of hourlyResult.data ?? []) {
    const h = new Date((r as { received_at: string }).received_at).getHours();
    hourlyBuckets[h] = (hourlyBuckets[h] ?? 0) + 1;
  }
  const hourlyData = Object.entries(hourlyBuckets).map(([h, count]) => ({ hour: Number(h), count }));
  const maxHourly = Math.max(...hourlyData.map((d) => d.count), 1);

  return {
    total: totalResult.count ?? 0,
    open: openResult.count ?? 0,
    investigating: investigatingResult.count ?? 0,
    closed: closedResult.count ?? 0,
    sevCounts,
    topMitre,
    recentCritical: (recentCriticalResult.data ?? []) as Array<{
      id: string; event_time: string; severity: string;
      source_type: string; ai_summary: string | null;
      raw_payload: string; status: string; source_host: string | null;
    }>,
    hourlyData,
    maxHourly,
  };
}

const MITRE_NAMES: Record<string, string> = {
  "T1110.001": "Password Guessing",
  "T1110.003": "Password Spraying",
  "T1078": "Valid Accounts",
  "T1548.003": "Sudo Abuse",
  "T1136": "Create Account",
  "T1098": "Account Manipulation",
};

function severityColor(s: string) {
  switch (s) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-yellow-400";
    case "low": return "text-blue-400";
    default: return "text-zinc-400";
  }
}

function shortId(uuid: string) {
  return uuid.split("-")[0].toUpperCase();
}


  const r = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const slice = { ...d, pct, dash, gap, offset };
    offset += dash;
    return slice;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="18" />
        {slices.map((s) => (
          <circle
            key={s.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="18"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={circumference / 4 - s.offset}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fill="#e4e4e7" fontSize="18" fontWeight="bold" fontFamily="monospace">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#71717a" fontSize="8">total</text>
      </svg>
      <ul className="space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="uppercase text-zinc-400 w-16">{s.label}</span>
            <span className="tabular-nums text-zinc-200 font-mono">{s.value}</span>
            <span className="text-zinc-600">({Math.round(s.pct * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const totalSev = Object.values(data.sevCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Live overview of your SOC triage queue</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Events", value: data.total, color: "text-zinc-100" },
            { label: "Open", value: data.open, color: "text-sky-400" },
            { label: "Investigating", value: data.investigating, color: "text-amber-400" },
            { label: "Closed", value: data.closed, color: "text-emerald-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{kpi.label}</p>
              <p className={"mt-2 text-3xl font-mono font-bold tabular-nums " + kpi.color}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Severity Breakdown */}
          <SeverityChart counts={data.sevCounts} />

          {/* Top MITRE Techniques */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-4">Top MITRE Techniques</h2>
            {data.topMitre.length === 0 ? (
              <p className="text-sm text-zinc-600 italic">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {data.topMitre.map(([technique, count]) => {
                  const maxCount = data.topMitre[0][1];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={technique} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-purple-300 font-mono">{technique}</span>
                        <span className="text-zinc-400 tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: pct + "%" }} />
                      </div>
                      <p className="text-xs text-zinc-600">{MITRE_NAMES[technique] ?? ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Events Last 24h */}
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-4">Events — Last 24 Hours</h2>
            <div className="flex items-end gap-1 h-24">
              {data.hourlyData.map(({ hour, count }) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-zinc-600 hover:bg-zinc-400 transition"
                    style={{ height: Math.max((count / data.maxHourly) * 80, count > 0 ? 4 : 0) + "px" }}
                    title={`${hour}:00 — ${count} events`}
                  />
                  {hour % 4 === 0 && (
                    <span className="text-zinc-600 tabular-nums" style={{ fontSize: "9px" }}>{hour}h</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Critical/High */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-5 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-4">
            Recent Critical &amp; High Events
          </h2>
          {data.recentCritical.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">No critical or high events yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.recentCritical.map((row) => (
                <li key={row.id}>
                  <Link
                    href={"/events/" + row.id}
                    className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 hover:border-zinc-600 hover:bg-zinc-900/70 transition"
                  >
                    <span className={"text-xs font-medium uppercase " + severityColor(row.severity)}>
                      {row.severity}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">EVT-{shortId(row.id)}</span>
                    <span className="text-xs text-zinc-300 truncate flex-1">
                      {row.ai_summary ?? row.raw_payload.slice(0, 80)}
                    </span>
                    <span className="text-xs text-zinc-600 shrink-0">
                      {new Date(row.event_time).toISOString().slice(11, 19)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
