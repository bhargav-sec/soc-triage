import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "investigating", "true_positive", "false_positive"] as const;
const CLOSING_STATUSES = ["true_positive", "false_positive"] as const;

type PatchBody = {
  notes?: string;
  status?: string;
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

  const { notes, status } = body;

  if (notes === undefined && status === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (status !== undefined && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: "Invalid status. Must be one of: " + VALID_STATUSES.join(", ") },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const currentResult = await supabase
    .from("events")
    .select("id, notes, status")
    .eq("id", id)
    .maybeSingle();

  if (currentResult.error) {
    return NextResponse.json({ error: currentResult.error.message }, { status: 500 });
  }

  if (!currentResult.data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isClosing = status !== undefined && CLOSING_STATUSES.includes(status as typeof CLOSING_STATUSES[number]);

  if (isClosing) {
    const effectiveNotes = notes !== undefined ? notes : currentResult.data.notes;
    if (!effectiveNotes || effectiveNotes.trim().length === 0) {
      return NextResponse.json(
        { error: "A note is required to close an event." },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (notes !== undefined) update.notes = notes;
  if (status !== undefined) {
    update.status = status;
    if (CLOSING_STATUSES.includes(status as typeof CLOSING_STATUSES[number])) {
      update.closed_at = new Date().toISOString();
    } else {
      update.closed_at = null;
    }
  }

  const updateResult = await supabase
    .from("events")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ event: updateResult.data });
}
