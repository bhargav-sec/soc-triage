import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * POST /api/ingest
 *
 * Accepts a single security event and writes it to the events table.
 *
 * Required body fields:
 *   - source_type:  string   (e.g. "linux_auth")
 *   - event_time:   ISO-8601 string
 *   - raw_payload:  string   (the original log line)
 *
 * Optional body fields:
 *   - source_host:  string
 *   - parsed:       object   (parsed fields, JSONB)
 *
 * Response:
 *   201 { id, received_at, status }
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
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 }
    );
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

  // 3. Validate event_time is parseable
  const eventTime = new Date(body.event_time as string);
  if (Number.isNaN(eventTime.getTime())) {
    return NextResponse.json(
      { error: "invalid_event_time", field: "event_time" },
      { status: 400 }
    );
  }

  // 4. Validate optional `parsed` is an object if present
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

  // 5. Insert into Supabase
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      source_type: body.source_type as string,
      event_time: eventTime.toISOString(),
      raw_payload: body.raw_payload as string,
      source_host:
        typeof body.source_host === "string" ? body.source_host : null,
      parsed,
    })
    .select("id, received_at, status")
    .single();

  if (error) {
    console.error("[ingest] supabase insert error:", error);
    return NextResponse.json(
      { error: "insert_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}
