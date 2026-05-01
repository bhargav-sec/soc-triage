import { getSupabaseServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import EventControls from "./EventControls";
import WalkthroughPanel from "./WalkthroughPanel";
import RescoreButton from "./RescoreButton";

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
  ai_severity_original: string | null;
  ai_mitre_original: string | null;
  recommended_actions: string[] | null;
  investigation_id: string | null;
  status: string;
  notes: string | null;
  closed_at: string | null;
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
  return row.raw_payload.slice(0, 200);
}

async function getEvent(id: string): Promise<{ event: EventRow | null; error: string | null }> {
  const supabase = getSupabaseServerClient();
  const result = await supabase
    .from("events")
    .select("id, received_at, event_time, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_provider, ai_summary, ai_reasoning, ai_severity_original, ai_mitre_original, recommended_actions, investigation_id, status, notes, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (result.error) {
    return { event: null, error: result.error.message };
  }
  return { event: (result.data as EventRow) ?? null, error: null };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event, error } = await getEvent(id);

  if (!event && !error) {
    notFound();
  }

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
            Failed to load event: {error}
          </div>
        )}

        {event && (
          <>
            <header className="border-b border-zinc-800 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 font-mono text-zinc-300">
                  EVT-{shortId(event.id)}
                </span>
                <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + statusBadgeClass(event.status)}>
                  {event.status.replace("_", " ")}
                </span>
                <span className={"rounded border px-2 py-0.5 font-medium uppercase tracking-wide " + severityBadgeClass(event.severity)}>
                  {event.severity}
                </span>
                {event.mitre_technique && event.mitre_technique !== "unknown" && (
                  <a
                    href={mitreUrl(event.mitre_technique)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-purple-300 hover:bg-purple-500/20"
                  >
                    {event.mitre_technique + " · " + (MITRE_NAMES[event.mitre_technique] ?? "")}
                  </a>
                )}
                <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-zinc-300">
                  {event.source_type}
                </span>
                {event.source_host && (
                  <span className="text-zinc-400">
                    host: <span className="text-zinc-200">{event.source_host}</span>
                  </span>
                )}
                {event.investigation_id && (
                  <Link
                    href={"/investigations/" + event.investigation_id}
                    className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Part of INV-{shortId(event.investigation_id)}
                  </Link>
                )}
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Event time {new Date(event.event_time).toISOString()} · Received {new Date(event.received_at).toISOString()}
                {event.closed_at && <> · Closed {new Date(event.closed_at).toISOString()}</>}
              </div>
            </header>

            <section className="mt-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Observed</h2>
                <p className="mt-2 text-sm text-zinc-100">{summarize(event)}</p>
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Why suspicious</h2>
                <p className="mt-2 text-sm text-zinc-100">
                  {event.ai_reasoning ?? <span className="text-zinc-500 italic">Not yet scored.</span>}
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Recommended actions</h2>
                {event.recommended_actions && event.recommended_actions.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {event.recommended_actions.map((action, i) => (
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
                    No actions available — rescore this event to generate recommendations.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-8">
              <WalkthroughPanel eventId={event.id} />
            </section>

            <section className="mt-8">
              <RescoreButton eventId={event.id} />
            </section>

            <section className="mt-8">
              <EventControls
                eventId={event.id}
                initialStatus={event.status as "open" | "investigating" | "true_positive" | "false_positive"}
                initialNotes={event.notes ?? ""}
                initialSeverity={event.severity ?? "unknown"}
                initialMitre={event.mitre_technique ?? "unknown"}
                aiSeverityOriginal={event.ai_severity_original}
                aiMitreOriginal={event.ai_mitre_original}
              />
            </section>

            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Raw payload</h2>
              <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-zinc-300">
                {event.raw_payload}
              </pre>
            </section>
          </>
        )}
      </div>
    </main>
  );
}