"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function HiddenClosedToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showClosed = searchParams.get("closed") === "1";

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    if (showClosed) {
      params.delete("closed");
    } else {
      params.set("closed", "1");
    }
    const qs = params.toString();
    router.push(qs ? "/?" + qs : "/");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
    >
      {showClosed ? "Hide closed" : "Show closed"}
    </button>
  );
}