/**
 * AI scoring for security events.
 *
 * scoreEvent() returns a discriminated-union ScoringResult:
 *   { ok: true, verdict, provider, latency_ms }
 *   { ok: false, reason, provider_attempted, latency_ms }
 *
 * Used by /api/ingest. Never exposed to the browser (server-only).
 *
 * Design:
 *   - Groq is the primary provider.
 *   - Gemini fallback is deferred (free-tier quota issue at setup).
 *     The tryFallback() function is wired but currently returns null.
 *     Swapping in any future provider = editing tryFallback() only.
 */

import { validateVerdict, type ScoringResult } from "./ai-types";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a SOC analyst classifier for Linux auth-log security events.
Your job: read the event below and classify it.

Respond with ONLY a JSON object. No markdown. No code fences. No prose outside the JSON.

Required shape:
{
  "severity": "critical" | "high" | "medium" | "low",
  "mitre_technique": "T1110.001" | "T1110.003" | "T1078" | "T1548.003" | "T1136" | "T1098" | "unknown",
  "summary": "one plain English sentence describing what was observed",
  "reasoning": "one or two plain English sentences explaining why this severity and this technique",
  "recommended_actions": ["action 1", "action 2", "action 3"]
}

Severity guide:
  - critical: active compromise indicators (e.g. successful root login from anonymous source, account takeover signs)
  - high: strong attack signal warranting urgent investigation (e.g. high-volume brute force, sudo abuse with target=root)
  - medium: suspicious but inconclusive (e.g. small number of failed logins, unusual but plausible activity)
  - low: noise worth logging but not concerning (e.g. single failed login from a known-good IP)

MITRE technique guide:
  - T1110.001 Password Guessing: failed auth attempts (one or many) targeting one or more accounts
  - T1110.003 Password Spraying: same password tried against many usernames (broad failure pattern)
  - T1078 Valid Accounts: a successful authentication, especially from a suspicious context
  - T1548.003 Sudo Abuse: failed/anomalous sudo activity, sudo from unexpected user, etc.
  - T1136 Create Account: new user account creation
  - T1098 Account Manipulation: group changes, permission grants, password changes
  - unknown: pick this only if none of the above clearly apply

recommended_actions guide:
  - Return 2 to 4 concise, actionable steps a SOC analyst should take for this specific event
  - Examples: "Block source IP 1.2.3.4 at the firewall", "Reset password for user root", "Review sudo logs for user deploy", "Escalate to incident response team"
  - Be specific to the event — not generic advice
  - Use plain English imperatives (start with a verb)

Be precise. Use real terminology. Do not soften.`;

type ScoreInput = {
  source_type: string;
  source_host: string | null;
  raw_payload: string;
  parsed: Record<string, unknown>;
};

function buildUserMessage(input: ScoreInput): string {
  return `Event:\n${JSON.stringify(input, null, 2)}`;
}

async function tryGroq(
  input: ScoreInput
): Promise<{ ok: true; verdict: import("./ai-types").AiVerdict; latency_ms: number } | { ok: false; reason: string; latency_ms: number }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return { ok: false, reason: "GROQ_API_KEY not set", latency_ms: 0 };
  }

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: `network error: ${e instanceof Error ? e.message : String(e)}`,
      latency_ms: Date.now() - t0,
    };
  }

  const latency_ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      reason: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      latency_ms,
    };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, reason: `groq response not JSON: ${String(e)}`, latency_ms };
  }

  const content = (json as { choices?: Array<{ message?: { content?: string } }> })
    .choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, reason: "groq returned no content", latency_ms };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      ok: false,
      reason: `groq content not parseable JSON: ${e instanceof Error ? e.message : String(e)}`,
      latency_ms,
    };
  }

  const validation = validateVerdict(parsed);
  if (!validation.ok) {
    return { ok: false, reason: `groq output rejected: ${validation.reason}`, latency_ms };
  }

  return { ok: true, verdict: validation.verdict, latency_ms };
}

/**
 * Fallback hook. Currently disabled — Gemini deferred.
 * To enable a fallback, return a real result here.
 */
async function tryFallback(
  _input: ScoreInput
): Promise<{ ok: true; verdict: import("./ai-types").AiVerdict; latency_ms: number; provider: "gemini" } | null> {
  return null;
}

/**
 * Score a single event. Tries primary, then fallback.
 * Always returns within ~3s in the worst case.
 */
export async function scoreEvent(input: ScoreInput): Promise<ScoringResult> {
  console.log("[ai-scorer] scoring event", {
    source_type: input.source_type,
    source_host: input.source_host,
    parsed_keys: Object.keys(input.parsed ?? {}),
  });

  const groq = await tryGroq(input);
  if (groq.ok) {
    console.log("[ai-scorer] groq ok", {
      severity: groq.verdict.severity,
      technique: groq.verdict.mitre_technique,
      latency_ms: groq.latency_ms,
    });
    return {
      ok: true,
      verdict: groq.verdict,
      provider: "groq",
      latency_ms: groq.latency_ms,
    };
  }

  console.warn("[ai-scorer] groq failed", { reason: groq.reason, latency_ms: groq.latency_ms });

  const fallback = await tryFallback(input);
  if (fallback && fallback.ok) {
    console.log("[ai-scorer] fallback ok", {
      severity: fallback.verdict.severity,
      technique: fallback.verdict.mitre_technique,
      provider: fallback.provider,
      latency_ms: fallback.latency_ms,
    });
    return {
      ok: true,
      verdict: fallback.verdict,
      provider: fallback.provider,
      latency_ms: fallback.latency_ms,
    };
  }

  const totalLatency = groq.latency_ms;
  console.error("[ai-scorer] all providers failed", { groq_reason: groq.reason });
  return {
    ok: false,
    reason: groq.reason,
    provider_attempted: ["groq"],
    latency_ms: totalLatency,
  };
}