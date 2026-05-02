import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("source_host")
    .not("source_host", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const h = r.source_host as string;
    counts[h] = (counts[h] ?? 0) + 1;
  }

  const hosts = Object.entries(counts)
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ hosts });
}
