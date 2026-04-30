import { getSupabaseServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import InvestigationControls from "./InvestigationControls";
import RescoreButton from "./RescoreButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type InvestigationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  severity: string | null;
  mitre_technique: string | null;
  source_ip: string | null;
  event_count: number;
  notes: string | null;
  closed_at: string | null;
  recommended_actions: string[] | null;
  ai_severity_original: string | null;
  ai_mitre_original: string | null;
};

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
  recommended_actions: string[] | null;
  investigation_id: string | null;
  status: string;
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

function severityBadgeClass(severity: string | null): string {
  switch (severity) {
    case "critical": return "bg-red-500/15 text-red-300 border-red-500/40";
    case "high":     return "bg-orange-500/15 text-orange-300 border-orange-500/40";
    case "medium":   return "bg-yellow-500/15 text-yellow-300 border-yellow-500/40";
    case "low":      return "bg-blue-500/15 text-blue-300 border-blue-500/40";
    default:         return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":           return "bg-sky-500/15 text-sky-300 border-sky-500/40";
    case "investigating":  return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    case "true_positive":  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "false_positive": return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
    default:               return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
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

function shortId(uuid: string): string {
  return uuid.split("-")[0].toUpperCase();
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

async function getInvestigation(id: string): Promise<{
  inv: InvestigationRow | null;
  events: EventRow[];
  error: string | null;
}> {
  const supabase = getSupabaseServerClient();

  const invResult = await supabase
    .from("investigations")
    .select("id, created_at, updated_at, status, severity, mitre_technique, source_ip, event_count, notes, closed_at, recommended_actions, ai_severity_original, ai_mitre_original")
    .eq("id", id)
    .maybeSingle();

  if (invResult.error) {
    return { inv: null, events: [], error: invResult.error.message };
  }

  if (!invResult.data) {
    return { inv: null, events: [], error: null };
  }

  const eventsResult = await supabase
    .from("events")
    .select("id, received_at, event_time, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_provider, ai_summary, ai_reasoning, recommended_actions, investigation_id, status")
    .eq("investigation_id", id)
    .order("received_at", { ascending: false });

  if (eventsResult.error) {
    return { inv: invResult.data as InvestigationRow, events: [], error: eventsResult.error.message };
  }

  return {
    inv: invResult.data as InvestigationRow,
    events: (eventsResult.data ?? []) as EventRow[],
    error: null,
  };
}

export default async function InvestigationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { inv, events, error } = await getInvestigation(id);

  if (!inv && !error) {
    notFound();
  }

  const topReasoning = events.find((e) => e.ai_reasoning)?.ai_reasoning ?? null;

  const actions: string[] =
    (inv?.recommended_actions && inv.recommended_actions.length > 0)
      ? inv.recommended_actions
      : (events.find((e) => e.recommended_actions && e.recommended_actions.length > 0)?.recommended_actions ?? []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            &larr; Back to queue
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load investigation: {error}
          </div>
        )}

        {inv && (
          <>
            <header className="border-b border-zinc-800 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                  INV-{shortId(inv.id)}
                </span>
                <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + statusBadgeClass(inv.status)}>
                  {inv.status.replace("_", " ")}
                </span>
                <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + severityBadgeClass(inv.severity)}>
                  {inv.severity ?? "unknown"}
                </span>
                {inv.mitre_technique && inv.mitre_technique !== "unknown" && (
                  <a
                    href={mitreUrl(inv.mitre_technique)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-300 hover:bg-purple-500/20"
                  >
                    {inv.mitre_technique + " · " + (MITRE_NAMES[inv.mitre_technique] ?? "")}
                  </a>
                )}
                {inv.source_ip && (
                  <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 font-mono text-zinc-300">
                    {inv.source_ip}
                  </span>
                )}
                <span className="text-zinc-500">
                  {inv.event_count} event{inv.event_count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Created {new Date(inv.created_at).toISOString()} · Updated {new Date(inv.updated_at).toISOString()}
                {inv.closed_at && <> · Closed {new Date(inv.closed_at).toISOString()}</>}
              </div>
            </header>

            <section className="mt-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Why suspicious</h2>
                <p className="mt-2 text-sm text-zinc-100">
                  {topReasoning ?? <span className="text-zinc-500 italic">No AI reasoning available.</span>}
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Recommended actions</h2>
                {actions.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-zinc-500">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                          </svg>
                        </span>
                        <span className="text-sm text-zinc-200">{action}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500 italic">
                    No actions available — rescore an event in this investigation to generate recommendations.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-8">
              <RescoreButton investigationId={inv.id} />
            </section>

            <section className="mt-8">
              <InvestigationControls
                investigationId={inv.id}
                initialStatus={inv.status as "open" | "investigating" | "true_positive" | "false_positive"}
                initialNotes={inv.notes ?? ""}
                initialSeverity={inv.severity ?? "unknown"}
                initialMitre={inv.mitre_technique ?? "unknown"}
                aiSeverityOriginal={inv.ai_severity_original}
                aiMitreOriginal={inv.ai_mitre_original}
              />
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Correlated events ({events.length})
              </h2>
              {events.length === 0 && (
                <p className="mt-2 text-sm text-zinc-500 italic">No events linked to this investigation.</p>
              )}
              {events.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {events.map((row) => (
                    <li
                      key={row.id}
                      className={"rounded-md border border-zinc-800 bg-zinc-900/40 p-4 border-l-4 " + severityBorderClass(row.severity)}
                    >
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
                          >
                            {row.mitre_technique + " · " + (MITRE_NAMES[row.mitre_technique] ?? "")}
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
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}