import { getSupabaseServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventRow = {
  id: string;
  received_at: string;
  event_time: string;
  source_type: string;
  severity: string;
  mitre_technique: string;
  ai_summary: string | null;
  ai_reasoning: string | null;
  status: string;
  raw_payload: string;
};

function severityBadgeClass(severity: string): string {
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

async function getSourceEvents(label: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, received_at, event_time, source_type, severity, mitre_technique, ai_summary, ai_reasoning, status, raw_payload")
    .eq("source_label", label)
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) return { events: [], error: error.message };
  return { events: (data ?? []) as EventRow[], error: null };
}

export default async function SourceDetailPage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const decoded = decodeURIComponent(label);
  const { events, error } = await getSourceEvents(decoded);

  if (!error && events.length === 0) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/sources" className="text-sm text-zinc-400 hover:text-zinc-200">
            &larr; Back to sources
          </Link>
        </div>

        <header className="border-b border-zinc-800 pb-6">
          <h1 className="font-mono text-lg font-semibold text-zinc-100">{decoded}</h1>
          <p className="mt-1 text-sm text-zinc-500">{events.length} event{events.length === 1 ? "" : "s"} from this file</p>
        </header>

        {error && (
          <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!error && (
          <ul className="mt-6 space-y-3">
            {events.map((row) => (
              <li key={row.id}>
                <Link
                  href={"/events/" + row.id}
                  className="block rounded-md border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/70"
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
                    <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-zinc-300">
                      {row.source_type}
                    </span>
                    <span className="ml-auto text-zinc-500">
                      {new Date(row.event_time).toISOString()}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div>
                      <span className="text-zinc-500">Observed:</span>{" "}
                      <span className="text-zinc-100">{row.ai_summary ?? row.raw_payload.slice(0, 120)}</span>
                    </div>
                    {row.ai_reasoning && (
                      <div>
                        <span className="text-zinc-500">Why suspicious:</span>{" "}
                        <span className="text-zinc-100">{row.ai_reasoning}</span>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
