"use client";

import { useState } from "react";

type Step = {
  step: number;
  action: string;
  command: string | null;
  why: string;
};

type Walkthrough = {
  title: string;
  threat_summary: string;
  immediate_actions: Step[];
  investigation_steps: Step[];
  containment: Step[];
  hardening: Step[];
  iocs: string[];
  escalate_if: string[];
};

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s) => (
        <li key={s.step} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-xs font-mono text-zinc-400">
              {s.step}
            </span>
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100">{s.action}</p>
              <p className="text-xs text-zinc-500">{s.why}</p>
              {s.command && (
                <pre className="overflow-x-auto rounded bg-black/60 px-3 py-2 text-xs text-emerald-300 font-mono">
                  {s.command}
                </pre>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function WalkthroughPanel({ eventId }: { eventId: string }) {
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/events/${eventId}/walkthrough`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setWalkthrough(data.walkthrough as Walkthrough);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate walkthrough");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Incident Response Walkthrough
        </h2>
        {!loading && (
          <button
            type="button"
            onClick={generate}
            className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition"
          >
            {walkthrough ? "Regenerate" : "Generate Walkthrough"}
          </button>
        )}
        {loading && (
          <span className="text-xs text-zinc-500 animate-pulse">AI is thinking…</span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {walkthrough && open && (
        <div className="space-y-6">
          <div className="rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-3">
            <h3 className="text-base font-semibold text-zinc-100">{walkthrough.title}</h3>
            <p className="mt-2 text-sm text-zinc-300">{walkthrough.threat_summary}</p>
          </div>

          {walkthrough.iocs.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
                Indicators of Compromise
              </h4>
              <div className="flex flex-wrap gap-2">
                {walkthrough.iocs.map((ioc, i) => (
                  <span key={i} className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-300">
                    {ioc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-orange-400">
              Immediate Actions (do these first)
            </h4>
            <StepList steps={walkthrough.immediate_actions} />
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-yellow-400">
              Investigation Steps
            </h4>
            <StepList steps={walkthrough.investigation_steps} />
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-400">
              Containment
            </h4>
            <StepList steps={walkthrough.containment} />
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Hardening (prevent recurrence)
            </h4>
            <StepList steps={walkthrough.hardening} />
          </div>

          {walkthrough.escalate_if.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
                Escalate to IR Team If
              </h4>
              <ul className="space-y-1">
                {walkthrough.escalate_if.map((condition, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
