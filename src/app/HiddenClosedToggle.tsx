"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type View = "active" | "investigating" | "closed";

export default function ViewTabs() {
  const router = useRouter();
  const [current, setCurrent] = useState<View>("active");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get("view");
    setCurrent(
      param === "investigating" ? "investigating" :
      param === "closed" ? "closed" :
      "active"
    );
  }, []);

  function go(view: View) {
    if (view === current) return;
    setCurrent(view);
    if (view === "active") {
      router.push("/");
    } else {
      router.push("/?view=" + view);
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
      <button type="button" onClick={() => go("investigating")} className={tabClass("investigating")}>
        Investigating
      </button>
      <button type="button" onClick={() => go("closed")} className={tabClass("closed")}>
        Closed
      </button>
    </div>
  );
}