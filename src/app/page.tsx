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
  status: string;
};

async function getEvents(): Promise<{ rows: EventRow[]; error: string | null }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, received_at, event_time, source_type, source_host, raw_payload, parsed, severity, status"
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (error) {
    return { rows: [], error: error.message };
  }
  return { rows: (data ?? []) as EventRow[], error: null };
}

function summarize(row: EventRow): string {
  const p = row.parsed ?? {};
  const user = typeof p.username === "string" ? p.username : null;
  const ip = typeof p.source_ip === "string" ? p.source_ip : null;
  const result =
    typeof p.auth_result === "string" ? p.auth_result : null;
  const service = typeof p.service === "string" ? p.service : row.source_type;

  if (user && ip && result) {
    return `${service} ${result} for user '${user}' from ${ip}`;
  }
  return row.raw_payload.slice(0, 120);
}

function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    case "high":
      return "bg-orange-500/10 text-orange-300 border-orange-500/30";
    case "medium":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
    case "low":
      return "bg-blue-500/10 text-blue-300 border-blue-500/30";
    default:
      return "bg-zinc-700/40 text-zinc-300 border-zinc-600/40";
  }
}

export default async function Home() {
  const { rows, error } = await getEvents();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              SOC Triage
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Phase 1 · Linux auth ingest · {rows.length} event
              {rows.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <SendSampleButton />
            <RefreshButton />
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
              Click <span className="text-zinc-300">Send sample event</span>{" "}
              to ingest your first one.
            </p>
          </div>
        )}

        {!error && rows.length > 0 && (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded border px-2 py-0.5 font-medium uppercase tracking-wide ${severityClass(
                      row.severity
                    )}`}
                  >
                    {row.severity}
                  </span>
                  <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-zinc-300">
                    {row.source_type}
                  </span>
                  {row.source_host && (
                    <span className="text-zinc-400">
                      host:{" "}
                      <span className="text-zinc-200">{row.source_host}</span>
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
                    <span className="text-zinc-500 italic">
                      pending AI scoring (Phase 2)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Next step:</span>{" "}
                    <span className="text-zinc-500 italic">
                      pending playbook (Phase 3)
                    </span>
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

        <footer className="mt-10 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
          soc-triage · phase 1 · ingest + queue
        </footer>
      </div>
    </main>
  );
}
