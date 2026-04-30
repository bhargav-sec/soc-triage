import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreEvent } from "@/lib/ai-scorer";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("id, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_severity_original, ai_mitre_original")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const scoring = await scoreEvent({
    source_type: event.source_type,
    source_host: event.source_host,
    raw_payload: event.raw_payload,
    parsed: event.parsed ?? {},
  });

  if (!scoring.ok) {
    return NextResponse.json(
      { error: "AI scoring failed", reason: scoring.reason },
      { status: 502 }
    );
  }

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

  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ event: updated });
}