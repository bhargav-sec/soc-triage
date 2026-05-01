import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("source_label, received_at")
    .not("source_label", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  return NextResponse.json({ sources });
}