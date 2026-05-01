import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreEvent } from "@/lib/ai-scorer";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: event, error } = await supabase
    .from("events")
    .select("id, source_type, source_host, raw_payload, parsed")
    .eq("id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const scoring = await scoreEvent({
    source_type: event.source_type,
    source_host: event.source_host,
    raw_payload: event.raw_payload,
    parsed: event.parsed ?? {},
  });

  if (!scoring.ok) {
    return NextResponse.json(
      { error: "scoring_failed", reason: scoring.reason, provider_attempted: scoring.provider_attempted },
      { status: 502 }
    );
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({
      severity: scoring.verdict.severity,
      mitre_technique: scoring.verdict.mitre_technique,
      ai_provider: scoring.provider,
      ai_summary: scoring.verdict.summary,
      ai_reasoning: scoring.verdict.reasoning,
      recommended_actions: scoring.verdict.recommended_actions,
      last_scored_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed", detail: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    id,
    severity: scoring.verdict.severity,
    mitre_technique: scoring.verdict.mitre_technique,
    ai_provider: scoring.provider,
    latency_ms: scoring.latency_ms,
  });
}
