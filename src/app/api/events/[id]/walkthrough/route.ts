import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are a senior incident responder writing a detailed remediation walkthrough for a SOC analyst.

Given a security event, produce a thorough, actionable incident response guide.

Respond with ONLY a JSON object. No markdown fences. No prose outside JSON.

Required shape:
{
  "title": "short incident title",
  "threat_summary": "2-3 sentences describing exactly what happened and why it is dangerous",
  "immediate_actions": [
    { "step": 1, "action": "what to do", "command": "exact command or null if no command needed", "why": "why this step matters" }
  ],
  "investigation_steps": [
    { "step": 1, "action": "what to investigate", "command": "exact command or null", "why": "what you are looking for" }
  ],
  "containment": [
    { "step": 1, "action": "containment action", "command": "exact command or null", "why": "what this prevents" }
  ],
  "hardening": [
    { "step": 1, "action": "long term hardening recommendation", "command": "exact command or null", "why": "what this prevents in future" }
  ],
  "iocs": ["list of indicators of compromise from this event such as IPs, usernames, hashes"],
  "escalate_if": ["condition under which this should be escalated to IR team"]
}`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GROQ_API_KEY not set" }, { status: 500 });
  }

  const supabase = getSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, source_type, source_host, raw_payload, parsed, severity, mitre_technique, ai_summary, ai_reasoning, status")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Security Event:\n${JSON.stringify(event, null, 2)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json({ error: `Groq error: ${body.slice(0, 200)}` }, { status: 502 });
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return NextResponse.json({ error: "No content from Groq" }, { status: 502 });

  try {
    const walkthrough = JSON.parse(content);
    return NextResponse.json({ walkthrough });
  } catch {
    return NextResponse.json({ error: "Could not parse Groq response" }, { status: 502 });
  }
}
