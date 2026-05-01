"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low" | "unknown";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "unknown"];

function chipClass(sev: Severity, selected: boolean): string {
  const base = "rounded border px-2 py-1 text-xs font-medium uppercase tracking-wide cursor-pointer transition";
  if (!selected) {
    return base + " bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:bg-zinc-800";
  }
  switch (sev) {
    case "critical": return base + " bg-red-500/25 text-red-200 border-red-500/60";
    case "high":     return base + " bg-orange-500/25 text-orange-200 border-orange-500/60";
    case "medium":   return base + " bg-yellow-500/25 text-yellow-200 border-yellow-500/60";
    case "low":      return base + " bg-blue-500/25 text-blue-200 border-blue-500/60";
    case "unknown":  return base + " bg-zinc-700/40 text-zinc-200 border-zinc-500/60";
  }
}

export default function SeverityFilter() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Severity>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sevParam = params.get("sev") ?? "";
    setSelected(new Set(sevParam.split(",").filter(Boolean) as Severity[]));
  }, []);

  function toggle(sev: Severity) {
    const next = new Set(selected);
    if (next.has(sev)) next.delete(sev);
    else next.add(sev);
    setSelected(next);

    const params = new URLSearchParams(window.location.search);
    if (next.size === 0) {
      params.delete("sev");
    } else {
      params.set("sev", Array.from(next).join(","));
    }
    const qs = params.toString();
    router.push(qs ? "/?" + qs : "/");
  }

  function clearAll() {
    setSelected(new Set());
    const params = new URLSearchParams(window.location.search);
    params.delete("sev");
    const qs = params.toString();
    router.push(qs ? "/?" + qs : "/");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-zinc-500 mr-1">Filter:</span>
      {SEVERITIES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          className={chipClass(s, selected.has(s))}
        >
          {s}
        </button>
      ))}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-zinc-500 hover:text-zinc-300 ml-1"
        >
          clear
        </button>
      )}
    </div>
  );
}