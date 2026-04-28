import { getSupabaseServerClient } from "@/lib/supabase";
import SendSampleButton from "./SendSampleButton";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventRow = {
  id: string;
  received_at: string;
  event_time: string;
  source_type: string;
  source_host: string | null;
  raw_payload: string;
  parsed: Record<string, unknown>;
  severity: string;
  mitre_technique: string;
  ai_provider: string | null;
  ai_summary: string | null;
  ai_reasoning: string | null;
  investigation_id: string | null;
  status: string;
};

type SeverityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
};

const MITRE_NAMES: Record<string, string> = {
  "T1110.001": "Password Guessing",
  "T1110.003": "Password Spraying",
  "T1078": "Valid Accounts",
  "T1548.003": "Sudo Abuse",
  "T1136": "Create Account",
  "T1098": "Account Manipulation",
  "unknown": "Unknown",
};

function mitreUrl(technique: string): string {
  const slug = technique.replace(".", "/");
  return "https://attack.mitre.org/techniques/" + slug + "/";
}

async function getData(): Promise<{
  rows: EventRow[];
  counts: SeverityCounts;
  investigationCounts: Record<string, number>;
  error: string | null;
}> {
  const supabase = getSupabaseServerClient();

  const [rowsResult, countsResult] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, received_at, event_time, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_provider, ai_summary, ai_reasoning, investigation_id, status"
      )
      .order("received_at", { ascending: false })
      .limit(100),
    supabase.from("events").select("severity, investigation_id"),
  ]);

  if (rowsResult.error) {
    return {
      rows: [],
      counts: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
      investigationCounts: {},
      error: rowsResult.error.message,
    };
  }

  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const investigationCounts: Record<string, number> = {};

  if (countsResult.data) {
    for (const r of countsResult.data) {
      const sev = (r as { severity: string }).severity;
      if (sev === "critical") counts.critical++;
      else if (sev === "high") counts.high++;
      else if (sev === "medium") counts.medium++;
      else if (sev === "low") counts.low++;
      else counts.unknown++;

      const invId = (r as { investigation_id: string | null }).investigation_id;
      if (invId) {
        investigationCounts[invId] = (investigationCounts[invId] ?? 0) + 1;
      }
    }
  }

  return {
    rows: (rowsResult.data ?? []) as EventRow[],
    counts,
    investigationCounts,
    error: null,
  };
}

function summarize(row: EventRow): string {
  if (row.ai_summary) return row.ai_summary;
  const p = row.parsed ?? {};
  const user = typeof p.username === "string" ? p.username : null;
  const ip = typeof p.source_ip === "string" ? p.source_ip : null;
  const result = typeof p.auth_result === "string" ? p.auth_result : null;
  const service = typeof p.service === "string" ? p.service : row.source_type;
  if (user && ip && result) {
    return service + " " + result + " for user " + user + " from " + ip;
  }
  return row.raw_payload.slice(0, 120);
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500/15 text-red-300 border-red-500/40";
    case "high":     return "bg-orange-500/15 text-orange-300 border-orange-500/40";
    case "medium":   return "bg-yellow-500/15 text-yellow-300 border-yellow-500/40";
    case "low":      return "bg-blue-500/15 text-blue-300 border-blue-500/40";
    default:         return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

function severityBorderClass(severity: string): string {
  switch (severity) {
    case "critical": return "border-l-red-500/60";
    case "high":     return "border-l-orange-500/60";
    case "medium":   return "border-l-yellow-500/60";
    case "low":      return "border-l-blue-500/60";
    default:         return "border-l-zinc-600/60";
  }
}

function shortInvestigationId(uuid: string): string {
  return uuid.split("-")[0].toUpperCase();
}

function SeverityCounter({ label, count, colorClass }: { label: string; count: number; colorClass: string }) {
  return (
    <div className={"flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm " + colorClass}>
      <span className="font-mono text-base font-semibold tabular-nums">{count}</span>
      <span className="uppercase tracking-wide text-xs">{label}</span>
    </div>
  );
}

export default async function Home() {
  const { rows, counts, investigationCounts, error } = await getData();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="border-b border-zinc-800 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">SOC Triage</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Phase 2 · Linux auth ingest · {rows.length} event{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2">
              <SendSampleButton />
              <RefreshButton />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <SeverityCounter label="critical" count={counts.critical} colorClass="bg-red-500/10 text-red-300 border-red-500/30" />
            <SeverityCounter label="high"     count={counts.high}     colorClass="bg-orange-500/10 text-orange-300 border-orange-500/30" />
            <SeverityCounter label="medium"   count={counts.medium}   colorClass="bg-yellow-500/10 text-yellow-300 border-yellow-500/30" />
            <SeverityCounter label="low"      count={counts.low}      colorClass="bg-blue-500/10 text-blue-300 border-blue-500/30" />
            <SeverityCounter label="unknown"  count={counts.unknown}  colorClass="bg-zinc-700/30 text-zinc-300 border-zinc-600/40" />
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load events: {error}
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="mt-10 rounded-md border border-zinc-800 bg-zinc-900/40 px-6 py-10 text-center">
            <p className="text-zinc-300">No events yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Click <span className="text-zinc-300">Send sample event</span> to ingest your first one.
            </p>
          </div>
        )}

        {!error && rows.length > 0 && (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const isCorrelated = row.investigation_id !== null;
              const investigationCount = isCorrelated
                ? investigationCounts[row.investigation_id as string] ?? 1
                : 0;
              const cardClasses = isCorrelated
                ? "rounded-md border border-zinc-800 bg-zinc-900/40 p-4 border-l-4 " + severityBorderClass(row.severity)
                : "rounded-md border border-zinc-800 bg-zinc-900/40 p-4";

              return (
                <li key={row.id} className={cardClasses}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + severityBadgeClass(row.severity)}>
                      {row.severity}
                    </span>

                    {row.mitre_technique && row.mitre_technique !== "unknown" && (
                      <a
                        href={mitreUrl(row.mitre_technique)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-300 hover:bg-purple-500/20"
                        title={"MITRE ATT&amp;CK: " + (MITRE_NAMES[row.mitre_technique] ?? row.mitre_technique)}
                      >
                        {row.mitre_technique}
                      </a>
                    )}

                    <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-zinc-300">
                      {row.source_type}
                    </span>

                    {row.source_host && (
                      <span className="text-zinc-400">
                        host: <span className="text-zinc-200">{row.source_host}</span>
                      </span>
                    )}

                    {isCorrelated && (
                      <span
                        className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300"
                        title="Correlated investigation"
                      >
                        INV-{shortInvestigationId(row.investigation_id as string)} ({investigationCount})
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
                      {row.ai_reasoning ? (
                        <span className="text-zinc-100">{row.ai_reasoning}</span>
                      ) : (
                        <span className="text-zinc-500 italic">not yet scored</span>
                      )}
                    </div>
                    <div>
                      <span className="text-zinc-500">Next step:</span>{" "}
                      <span className="text-zinc-500 italic">pending playbook (Phase 3)</span>
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                      Raw payload
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-zinc-300">
                      {row.raw_payload}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="mt-10 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
          soc-triage · phase 2 · ingest + queue + ai scoring + correlation
        </footer>
      </div>
    </main>
  );
}
