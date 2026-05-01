"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type View = "active" | "investigating" | "closed";

function Tabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current: View =
    searchParams.get("view") === "investigating" ? "investigating" :
    searchParams.get("view") === "closed" ? "closed" :
    "active";

  function go(view: View) {
    router.push(view === "active" ? "/" : "/?view=" + view);
  }

  function tabClass(view: View) {
    return current === view
      ? "rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100"
      : "rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition";
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => go("active")} className={tabClass("active")}>Active</button>
      <button type="button" onClick={() => go("investigating")} className={tabClass("investigating")}>Investigating</button>
      <button type="button" onClick={() => go("closed")} className={tabClass("closed")}>Closed</button>
    </div>
  );
}

export default function ViewTabs() {
  return (
    <Suspense fallback={<div className="h-8 w-48 rounded bg-zinc-800 animate-pulse" />}>
      <Tabs />
    </Suspense>
  );
}
