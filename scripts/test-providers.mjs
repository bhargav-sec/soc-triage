// Standalone provider verification.
// Run with: node --env-file=.env.local scripts/test-providers.mjs

const SAMPLE_EVENT = {
  source_type: "linux_auth",
  source_host: "honeypot-01",
  raw_payload:
    "Apr 27 14:23:11 honeypot-01 sshd[12345]: Failed password for root from 185.220.101.42 port 54321 ssh2",
  parsed: {
    username: "root",
    source_ip: "185.220.101.42",
    auth_result: "failure",
    port: 54321,
    service: "sshd",
  },
};

const SYSTEM_PROMPT = `You are a SOC analyst classifier for Linux auth-log events.
Classify the event below.

Respond with ONLY a JSON object, no markdown, no prose, no code fences. Required shape:
{
  "severity": "critical" | "high" | "medium" | "low",
  "mitre_technique": "T1110.001" | "T1110.003" | "T1078" | "T1548.003" | "T1136" | "T1098" | "unknown",
  "summary": "one plain English sentence describing what was observed",
  "reasoning": "one or two plain English sentences explaining why this severity and technique"
}`;

const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const VALID_TECHNIQUES = new Set([
  "T1110.001",
  "T1110.003",
  "T1078",
  "T1548.003",
  "T1136",
  "T1098",
  "unknown",
]);

function validate(parsed) {
  if (typeof parsed !== "object" || parsed === null) return "not an object";
  if (!VALID_SEVERITIES.has(parsed.severity))
    return `severity '${parsed.severity}' not in allowed set`;
  if (!VALID_TECHNIQUES.has(parsed.mitre_technique))
    return `mitre_technique '${parsed.mitre_technique}' not in allowed set`;
  if (typeof parsed.summary !== "string" || parsed.summary.length === 0)
    return "summary missing or empty";
  if (typeof parsed.reasoning !== "string" || parsed.reasoning.length === 0)
    return "reasoning missing or empty";
  return null;
}

async function testGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, reason: "GROQ_API_KEY not set" };

  const userMsg = `Event:\n${JSON.stringify(SAMPLE_EVENT, null, 2)}`;
  const t0 = Date.now();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 200)}`, ms };
  }
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content;
  if (!content) return { ok: false, reason: "no content in response", ms };

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { ok: false, reason: `JSON.parse failed: ${e.message}`, raw: content, ms };
  }

  const validationError = validate(parsed);
  if (validationError) return { ok: false, reason: validationError, raw: parsed, ms };

  return { ok: true, parsed, ms };
}

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "GEMINI_API_KEY not set" };

  const userMsg = `Event:\n${JSON.stringify(SAMPLE_EVENT, null, 2)}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 200)}`, ms };
  }
  const j = await res.json();
  const content = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) return { ok: false, reason: "no content in response", ms };

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { ok: false, reason: `JSON.parse failed: ${e.message}`, raw: content, ms };
  }

  const validationError = validate(parsed);
  if (validationError) return { ok: false, reason: validationError, raw: parsed, ms };

  return { ok: true, parsed, ms };
}

function printResult(name, r) {
  if (r.ok) {
    console.log(`\n[${name}] OK in ${r.ms}ms`);
    console.log(`  severity: ${r.parsed.severity}`);
    console.log(`  technique: ${r.parsed.mitre_technique}`);
    console.log(`  summary: ${r.parsed.summary}`);
    console.log(`  reasoning: ${r.parsed.reasoning}`);
  } else {
    console.log(`\n[${name}] FAIL${r.ms ? " in " + r.ms + "ms" : ""}`);
    console.log(`  reason: ${r.reason}`);
    if (r.raw) console.log(`  raw:`, r.raw);
  }
}

async function main() {
  console.log("Testing AI providers with sample event...");
  const groq = await testGroq();
  printResult("groq", groq);

  const gemini = await testGemini();
  printResult("gemini", gemini);

  const allOk = groq.ok && gemini.ok;
  console.log(`\n${allOk ? "BOTH PROVIDERS OK" : "AT LEAST ONE PROVIDER FAILED"}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(2);
});
