import { getSupabaseServerClient } from "@/lib/supabase";
import Link from "next/link";
import DeleteSourceButton from "./DeleteSourceButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Source = {
  source_label: string;
  event_count: number;
  last_seen: string;
};

async function getSources(): Promise<{ sources: Source[]; error: string | null }> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("source_label, received_at")
    .not("source_label", "is", null);

  if (error) return { sources: [], error: error.message };

  const map = new Map<string, { event_count: number; last_seen: string }>();

  for (const row of data ?? []) {
    const label = row.source_label as string;
    const existing = map.get(label);
    if (!existing) {
      map.set(label, { event_count: 1, last_seen: row.received_at });
    } else {
      existing.event_count += 1;
      if (row.received_at > existing.last_seen) {
        existing.last_seen = row.received_at;
      }
    }
  }

  const sources = Array.from(map.entries())
    .map(([source_label, stats]) => ({ source_label, ...stats }))
    .sort((a, b) => (a.last_seen > b.last_seen ? -1 : 1));

  return { sources, error: null };
}

export default async function SourcesPage() {
  const { sources, error } = await getSources();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            &larr; Back to queue
          </Link>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Uploaded sources</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Each entry represents a file you uploaded. Delete removes all non-active events from that file.
            </p>
          </div>
          <Link
            href="/upload"
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition"
          >
            Upload logs
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Failed to load sources: {error}
          </div>
        )}

        {!error && sources.length === 0 && (
          <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">No uploaded sources yet.</p>
            <Link
              href="/upload"
              className="mt-4 inline-block rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition"
            >
              Upload your first file
            </Link>
          </div>
        )}

        {sources.length > 0 && (
          <ul className="space-y-3">
            {sources.map((source) => (
              <li
                key={source.source_label}
                className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 hover:border-zinc-600 hover:bg-zinc-900/70 transition"
              >
                <Link href={"/sources/" + encodeURIComponent(source.source_label)} className="flex-1 space-y-1 min-w-0">
                  <p className="font-mono text-sm text-zinc-100">{source.source_label}</p>
                  <p className="text-xs text-zinc-500">
                    {source.event_count} event{source.event_count === 1 ? "" : "s"} · last seen{" "}
                    {new Date(source.last_seen).toISOString()}
                  </p>
                </Link>
                <DeleteSourceButton
                  label={source.source_label}
                  eventCount={source.event_count}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}