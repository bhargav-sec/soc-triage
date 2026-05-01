"use client";

import { useState } from "react";

type Props = {
  eventId: string;
  severity: string;
  mitreLabel: string;
  summary: string;
  reasoning: string | null;
  rawPayload: string;
};

export default function CopyButton({ eventId, severity, mitreLabel, summary, reasoning, rawPayload }: Props) {
  const [copied, setCopied] = useState(false);

  function buildText() {
    return [
      "=== SOC TRIAGE EVENT " + eventId + " ===",
      "Severity : " + severity.toUpperCase(),
      "MITRE    : " + mitreLabel,
      "",
      "SUMMARY",
      summary,
      "",
      reasoning ? "WHY SUSPICIOUS\n" + reasoning : "",
      "",
      "RAW PAYLOAD",
      rawPayload,
    ]
      .filter((l) => l !== null)
      .join("\n")
      .trim();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = buildText();
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition"
      title="Copy event details to clipboard"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy event
        </>
      )}
    </button>
  );
}
