/**
 * Shared types and constants for AI scoring.
 * Keep this file pure — no API calls, no env access.
 * Imported by ai-scorer.ts (server) and potentially by client UI later.
 */

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * MITRE ATT&CK techniques in scope for Linux auth-log classification.
 * Allowlist enforced at AI response validation.
 */
export const MITRE_TECHNIQUES = [
  "T1110.001", // Password Guessing
  "T1110.003", // Password Spraying
  "T1078",     // Valid Accounts
  "T1548.003", // Sudo Abuse
  "T1136",     // Create Account
  "T1098",     // Account Manipulation
] as const;

export type MitreTechnique = (typeof MITRE_TECHNIQUES)[number] | "unknown";

export const MITRE_TECHNIQUE_NAMES: Record<MitreTechnique, string> = {
  "T1110.001": "Password Guessing",
  "T1110.003": "Password Spraying",
  "T1078": "Valid Accounts",
  "T1548.003": "Sudo Abuse",
  "T1136": "Create Account",
  "T1098": "Account Manipulation",
  "unknown": "Unknown",
};

/**
 * Strict shape the AI must return.
 * Validated before being trusted.
 */
export type AiVerdict = {
  severity: Severity;
  mitre_technique: MitreTechnique;
  summary: string;
  reasoning: string;
};

/**
 * Result of an AI scoring attempt.
 * Discriminated union — caller checks `ok` first.
 */
export type ScoringResult =
  | { ok: true; verdict: AiVerdict; provider: "groq" | "gemini"; latency_ms: number }
  | { ok: false; reason: string; provider_attempted: ("groq" | "gemini")[]; latency_ms: number };

/**
 * Validate an unknown value (typically a parsed JSON response from an AI provider)
 * against the strict AiVerdict shape.
 * Returns the verdict on success, or a reason string on failure.
 */
export function validateVerdict(
  value: unknown
): { ok: true; verdict: AiVerdict } | { ok: false; reason: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "response is not an object" };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.severity !== "string" || !SEVERITIES.includes(v.severity as Severity)) {
    return {
      ok: false,
      reason: `severity '${String(v.severity)}' not in allowlist [${SEVERITIES.join(", ")}]`,
    };
  }

  if (
    typeof v.mitre_technique !== "string" ||
    (v.mitre_technique !== "unknown" &&
      !MITRE_TECHNIQUES.includes(v.mitre_technique as (typeof MITRE_TECHNIQUES)[number]))
  ) {
    return {
      ok: false,
      reason: `mitre_technique '${String(v.mitre_technique)}' not in allowlist`,
    };
  }

  if (typeof v.summary !== "string" || v.summary.length === 0) {
    return { ok: false, reason: "summary missing or empty" };
  }

  if (typeof v.reasoning !== "string" || v.reasoning.length === 0) {
    return { ok: false, reason: "reasoning missing or empty" };
  }

  return {
    ok: true,
    verdict: {
      severity: v.severity as Severity,
      mitre_technique: v.mitre_technique as MitreTechnique,
      summary: v.summary,
      reasoning: v.reasoning,
    },
  };
}
