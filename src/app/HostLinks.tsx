"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Host = { host: string; count: number };

export default function HostLinks() {
  const pathname = usePathname();
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    fetch("/api/hosts")
      .then(r => r.json())
      .then(d => setHosts(d.hosts ?? []))
      .catch(() => {});
  }, []);

  if (hosts.length === 0) return null;

  return (
    <div className="px-2 mt-2">
      <p className="px-2 pb-1 text-zinc-600 uppercase tracking-widest" style={{fontSize:"9px"}}>Hosts</p>
      {hosts.map(({ host, count }) => {
        const active = pathname === "/hosts/" + encodeURIComponent(host);
        return (
          <Link
            key={host}
            href={"/hosts/" + encodeURIComponent(host)}
            className={
              "flex items-center justify-between rounded-md px-2 py-2 text-sm transition " +
              (active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200")
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              <span className="truncate text-xs">{host}</span>
            </div>
            <span className="ml-2 shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-500" style={{fontSize:"9px"}}>{count}</span>
          </Link>
        );
      })}
    </div>
  );
}
