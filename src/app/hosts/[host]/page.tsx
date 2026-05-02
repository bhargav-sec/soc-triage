import { getSupabaseServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

function shortId(uuid: string) { return uuid.split("-")[0].toUpperCase(); }

export default async function HostTimelinePage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const decodedHost = decodeURIComponent(host);
  const supabase = getSupabaseServerClient();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, event_time, severity, mitre_technique, ai_summary, raw_payload, status, source_type, parsed")
    .eq("source_host", decodedHost)
    .order("event_time", { ascending: false })
    .limit(200);

  if (error) return <div className="p-8 text-red-400">Failed to load: {error.message}</div>;
  if (!events || events.length === 0) notFound();

  // Stats
  const sevCounts: Record<string, number> = {};
  for (const e of events) {
    sevCounts[e.severity] = (sevCounts[e.severity] ?? 0) + 1;
  }

  const firstSeen = new Date(events[events.length - 1].event_time);
  const lastSeen  = new Date(events[0].event_time);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-8">
      <div className="mx-auto max-w-4xl">

        {/* Back */}
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          &larr; Back to queue
        </Link>

        {/* Header */}
        <div className="mt-6 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-zinc-400">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold font-mono text-zinc-100">{decodedHost}</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                First seen {firstSeen.toISOString().slice(0, 10)} · Last seen {lastSeen.toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center">
              <p className="text-xs text-zinc-500">Total</p>
              <p className="text-xl font-mono font-bold text-zinc-100">{events.length}</p>
            </div>
            {["critical","high","medium","low"].map(s => (
              (sevCounts[s] ?? 0) > 0 && (
                <div key={s} className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center">
                  <p className="text-xs uppercase" style={{color: severityColor(s)}}>{s}</p>
                  <p className="text-xl font-mono font-bold text-zinc-100">{sevCounts[s]}</p>
                </div>
              )
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-8 relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />

          <div className="space-y-3">
            {events.map((evt) => (
              <div key={evt.id} className="relative flex gap-4 pl-10">
                {/* Dot on timeline */}
                <div
                  className="absolute left-0 top-4 h-6 w-6 rounded-full border-2 border-zinc-900 flex items-center justify-center"
                  style={{ background: severityColor(evt.severity) + "33", borderColor: severityColor(evt.severity) }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ background: severityColor(evt.severity) }} />
                </div>

                {/* Card */}
                <Link
                  href={"/events/" + evt.id}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-900/70 transition"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-zinc-500">EVT-{shortId(evt.id)}</span>
                    <span className={"rounded border px-1.5 py-0.5 font-medium uppercase " + severityBadge(evt.severity)}>
                      {evt.severity}
                    </span>
                    {evt.mitre_technique && evt.mitre_technique !== "unknown" && (
                      <span className="rounded border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-purple-300">
                        {evt.mitre_technique} · {MITRE_NAMES[evt.mitre_technique] ?? ""}
                      </span>
                    )}
                    <span className="ml-auto text-zinc-500 tabular-nums">
                      {new Date(evt.event_time).toISOString().replace("T", " ").slice(0, 19)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-300 line-clamp-2">
                    {evt.ai_summary ?? evt.raw_payload.slice(0, 120)}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
