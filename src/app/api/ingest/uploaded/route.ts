import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export async function DELETE() {
  const supabase = getSupabaseServerClient();

  const { count, error } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .eq("source_host", "uploaded");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: count ?? 0 }, { status: 200 });
}