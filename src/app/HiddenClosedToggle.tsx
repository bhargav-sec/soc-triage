"use client";

import { useRouter, useSearchParams } from "next/navigation";

type View = "active" | "closed";

export default function ViewTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current: View = searchParams.get("view") === "closed" ? "closed" : "active";

  function go(view: View) {
    if (view === current) return;
    if (view === "active") {
      router.push("/");
    } else {
      router.push("/?view=closed");
    }
  }

  function tabClass(view: View): string {
    const isActive = view === current;
    if (isActive) {
      return "rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100";
    }
    return "rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200";
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => go("active")} className={tabClass("active")}>
        Active
      </button>
      <button type="button" onClick={() => go("closed")} className={tabClass("closed")}>
        Closed
      </button>
    </div>
  );
}