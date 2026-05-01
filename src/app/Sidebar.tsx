"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const NAV = [
  {
    label: "Dashboard",
    href: "/dashboard",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: "Triage Queue",
    href: "/",
    query: "",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    label: "Investigating",
    href: "/?view=investigating",
    query: "investigating",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    label: "Closed",
    href: "/?view=closed",
    query: "closed",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  {
    label: "Sources",
    href: "/sources",
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    label: "Upload Logs",
    href: "/upload",
    exact: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
];

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "";
  const [collapsed, setCollapsed] = useState(false);

  function isActive(item: typeof NAV[number]) {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    if (item.href === "/sources") return pathname.startsWith("/sources");
    if (item.href === "/upload") return pathname === "/upload";
    // Queue items — match on pathname + view param
    if (pathname !== "/") return false;
    const itemView = item.query ?? "";
    return currentView === itemView;
  }

  return (
    <aside
      className={
        "flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-200 shrink-0 " +
        (collapsed ? "w-14" : "w-52")
      }
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-zinc-800">
        {!collapsed && (
          <span className="font-mono text-sm font-semibold text-zinc-100 truncate">
            SOC Triage
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          aria-label="Toggle sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {/* Divider label */}
        {!collapsed && (
          <p className="px-2 pb-1 text-zinc-600 uppercase tracking-widest" style={{fontSize:"9px"}}>Queue</p>
        )}
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition " +
                (active
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200")
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 px-3 py-3">
        {!collapsed && (
          <p className="text-zinc-600" style={{fontSize:"10px"}}>Phase 3 · Linux auth</p>
        )}
      </div>
    </aside>
  );
}

export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="w-52 bg-zinc-900 border-r border-zinc-800 shrink-0" />}>
      <SidebarInner />
    </Suspense>
  );
}
