import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreEvent } from "@/lib/ai-scorer";

export const dynamic = "force-dynamic";

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: inv, error: invError } = await supabase
    .from("investigations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (invError) {
    return NextResponse.json({ error: invError.message }, { status: 500 });
  }

  if (!inv) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_severity_original, ai_mitre_original")
    .eq("investigation_id", id);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ error: "No events found in this investigation" }, { status: 404 });
  }

  const results = await Promise.all(
    events.map(async (event) => {
      const scoring = await scoreEvent({
        source_type: event.source_type,
        source_host: event.source_host,
        raw_payload: event.raw_payload,
        parsed: event.parsed ?? {},
      });

      if (!scoring.ok) return null;

      const update: Record<string, unknown> = {
        severity: scoring.verdict.severity,
        mitre_technique: scoring.verdict.mitre_technique,
        ai_provider: scoring.provider,
        ai_summary: scoring.verdict.summary,
        ai_reasoning: scoring.verdict.reasoning,
        recommended_actions: scoring.verdict.recommended_actions,
        last_scored_at: new Date().toISOString(),
      };

      if (!event.ai_severity_original) update.ai_severity_original = event.severity;
      if (!event.ai_mitre_original) update.ai_mitre_original = event.mitre_technique;

      await supabase.from("events").update(update).eq("id", event.id);

      return scoring.verdict;
    })
  );

  const successfulResults = results.filter(Boolean) as { severity: string; mitre_technique: string; summary: string; reasoning: string; recommended_actions: string[] }[];

  if (successfulResults.length === 0) {
    return NextResponse.json({ error: "All event rescores failed" }, { status: 502 });
  }

  const dominant = successfulResults.reduce((best, curr) => {
    return (SEVERITY_RANK[curr.severity] ?? 0) >= (SEVERITY_RANK[best.severity] ?? 0) ? curr : best;
  });

  const { error: invUpdateError } = await supabase
    .from("investigations")
    .update({
      severity: dominant.severity,
      mitre_technique: dominant.mitre_technique,
      recommended_actions: dominant.recommended_actions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (invUpdateError) {
    return NextResponse.json({ error: invUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ rescored: successfulResults.length, severity: dominant.severity });
}