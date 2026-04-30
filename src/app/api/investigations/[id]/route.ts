import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "investigating", "true_positive", "false_positive"] as const;
const CLOSING_STATUSES = ["true_positive", "false_positive"] as const;
const VALID_SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;
const VALID_MITRE = ["T1110.001", "T1110.003", "T1078", "T1548.003", "T1136", "T1098", "unknown"] as const;

type PatchBody = {
  notes?: string;
  status?: string;
  severity?: string;
  mitre_technique?: string;
  ai_severity_original?: string;
  ai_mitre_original?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { notes, status, severity, mitre_technique, ai_severity_original, ai_mitre_original } = body;

  if (
    notes === undefined &&
    status === undefined &&
    severity === undefined &&
    mitre_technique === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: "Invalid status. Must be one of: " + VALID_STATUSES.join(", ") },
      { status: 400 }
    );
  }

  if (severity !== undefined && !VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])) {
    return NextResponse.json(
      { error: "Invalid severity. Must be one of: " + VALID_SEVERITIES.join(", ") },
      { status: 400 }
    );
  }

  if (mitre_technique !== undefined && !VALID_MITRE.includes(mitre_technique as typeof VALID_MITRE[number])) {
    return NextResponse.json(
      { error: "Invalid mitre_technique." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const currentResult = await supabase
    .from("investigations")
    .select("id, notes, status")
    .eq("id", id)
    .maybeSingle();

  if (currentResult.error) {
    return NextResponse.json({ error: currentResult.error.message }, { status: 500 });
  }

  if (!currentResult.data) {
    return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
  }

  const isClosing =
    status !== undefined &&
    CLOSING_STATUSES.includes(status as typeof CLOSING_STATUSES[number]);

  if (isClosing) {
    const effectiveNotes = notes !== undefined ? notes : currentResult.data.notes;
    if (!effectiveNotes || effectiveNotes.trim().length === 0) {
      return NextResponse.json(
        { error: "A note is required to close an investigation." },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (notes !== undefined) update.notes = notes;
  if (severity !== undefined) update.severity = severity;
  if (mitre_technique !== undefined) update.mitre_technique = mitre_technique;
  if (ai_severity_original !== undefined) update.ai_severity_original = ai_severity_original;
  if (ai_mitre_original !== undefined) update.ai_mitre_original = ai_mitre_original;
  if (status !== undefined) {
    update.status = status;
    update.closed_at = CLOSING_STATUSES.includes(status as typeof CLOSING_STATUSES[number])
      ? new Date().toISOString()
      : null;
  }

  const updateResult = await supabase
    .from("investigations")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ investigation: updateResult.data });
}