import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ label: string }> }
) {
  const { label } = await params;
  const decoded = decodeURIComponent(label);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("source_label", decoded)
    
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length ?? 0 });
}