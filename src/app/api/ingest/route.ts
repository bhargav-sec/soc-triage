import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreEvent } from "@/lib/ai-scorer";

/**
 * POST /api/ingest
 *
 * Phase 1: validate body, insert into events table.
 * Phase 2: after insert, score with AI and update the row with severity,
 *          mitre_technique, ai_summary, ai_reasoning, ai_provider,
 *          recommended_actions, last_scored_at.
 *          Always returns 201 on successful insert, even if AI scoring fails.
 *
 * Required body fields:
 *   - source_type:  string
 *   - event_time:   ISO-8601 string
 *   - raw_payload:  string
 *
 * Optional body fields:
 *   - source_host:  string
 *   - parsed:       object
 *
 * Response:
 *   201 { id, received_at, status, severity, mitre_technique, ai_provider }
 *   400 { error, field? }
 *   500 { error }
 */

type IngestBody = {
  source_type?: unknown;
  event_time?: unknown;
  raw_payload?: unknown;
  source_host?: unknown;
  parsed?: unknown;
};

export async function POST(request: NextRequest) {
  // 1. Parse JSON body
  let body: IngestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 2. Validate required fields
  const required = ["source_type", "event_time", "raw_payload"] as const;
  for (const field of required) {
    if (typeof body[field] !== "string" || (body[field] as string).length === 0) {
      return NextResponse.json(
        { error: "missing_required_field", field },
        { status: 400 }
      );
    }
  }

  // 3. Validate event_time
  const eventTime = new Date(body.event_time as string);
  if (Number.isNaN(eventTime.getTime())) {
    return NextResponse.json(
      { error: "invalid_event_time", field: "event_time" },
      { status: 400 }
    );
  }

  // 4. Validate optional `parsed`
  let parsed: Record<string, unknown> = {};
  if (body.parsed !== undefined && body.parsed !== null) {
    if (typeof body.parsed !== "object" || Array.isArray(body.parsed)) {
      return NextResponse.json(
        { error: "invalid_parsed", field: "parsed" },
        { status: 400 }
      );
    }
    parsed = body.parsed as Record<string, unknown>;
  }

  // 5. Insert event
  const supabase = getSupabaseServerClient();
  const sourceHost =
    typeof body.source_host === "string" ? body.source_host : null;

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      source_type: body.source_type as string,
      event_time: eventTime.toISOString(),
      raw_payload: body.raw_payload as string,
      source_host: sourceHost,
      parsed,
    })
    .select("id, received_at, status")
    .single();

  if (insertError) {
    console.error("[ingest] supabase insert error:", insertError);
    return NextResponse.json(
      { error: "insert_failed", detail: insertError.message },
      { status: 500 }
    );
  }

  // 6. AI scoring
  const scoring = await scoreEvent({
    source_type: body.source_type as string,
    source_host: sourceHost,
    raw_payload: body.raw_payload as string,
    parsed,
  });

  let finalSeverity = "unknown";
  let finalTechnique = "unknown";
  let finalProvider: "groq" | "gemini" | "failed" = "failed";
  let finalSummary: string | null = null;
  let finalReasoning: string | null = null;
  let finalActions: string[] = [];

  if (scoring.ok) {
    finalSeverity = scoring.verdict.severity;
    finalTechnique = scoring.verdict.mitre_technique;
    finalProvider = scoring.provider;
    finalSummary = scoring.verdict.summary;
    finalReasoning = scoring.verdict.reasoning;
    finalActions = scoring.verdict.recommended_actions;
  } else {
    console.warn("[ingest] scoring failed for event", inserted.id, {
      reason: scoring.reason,
      provider_attempted: scoring.provider_attempted,
      latency_ms: scoring.latency_ms,
    });
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({
      severity: finalSeverity,
      mitre_technique: finalTechnique,
      ai_provider: finalProvider,
      ai_summary: finalSummary,
      ai_reasoning: finalReasoning,
      recommended_actions: finalActions,
      last_scored_at: new Date().toISOString(),
    })
    .eq("id", inserted.id);

  if (updateError) {
    console.error("[ingest] supabase ai-update error (non-fatal):", updateError);
  }

  // 6.5. Correlation
  const { data: corr, error: corrError } = await supabase.rpc("correlate_event", {
    p_event_id: inserted.id,
  });

  if (corrError) {
    console.warn("[ingest] correlation rpc error (non-fatal):", corrError);
  } else if (corr && Array.isArray(corr) && corr[0]) {
    const investigationId = corr[0].out_investigation_id;
    const matchCount = corr[0].out_correlated_count;
    if (investigationId) {
      console.log("[ingest] correlated event", inserted.id, {
        investigation_id: investigationId,
        match_count: matchCount,
      });
    } else {
      console.log("[ingest] no correlation", inserted.id, { match_count: matchCount });
    }
  }

  // 7. Return enriched response
  return NextResponse.json(
    {
      id: inserted.id,
      received_at: inserted.received_at,
      status: inserted.status,
      severity: finalSeverity,
      mitre_technique: finalTechnique,
      ai_provider: finalProvider,
    },
    { status: 201 }
  );
}