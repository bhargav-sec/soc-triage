"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SAMPLES = [
  {
    label: "ssh failed",
    payload: {
      source_type: "linux_auth",
      source_host: "honeypot-01",
      raw_payload:
        "{TIME} honeypot-01 sshd[12345]: Failed password for root from 185.220.101.42 port 54321 ssh2",
      parsed: {
        username: "root",
        source_ip: "185.220.101.42",
        auth_result: "failure",
        port: 54321,
        service: "sshd",
      },
    },
  },
  {
    label: "ssh success",
    payload: {
      source_type: "linux_auth",
      source_host: "honeypot-01",
      raw_payload:
        "{TIME} honeypot-01 sshd[12399]: Accepted publickey for bhargav from 203.0.113.45 port 51234 ssh2",
      parsed: {
        username: "bhargav",
        source_ip: "203.0.113.45",
        auth_result: "success",
        auth_method: "publickey",
        port: 51234,
        service: "sshd",
      },
    },
  },
  {
    label: "sudo failed",
    payload: {
      source_type: "linux_auth",
      source_host: "honeypot-01",
      raw_payload:
        "{TIME} honeypot-01 sudo: bhargav : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/bhargav ; USER=root ; COMMAND=/bin/bash",
      parsed: {
        username: "bhargav",
        auth_result: "failure",
        service: "sudo",
        target_user: "root",
      },
    },
  },
];

export default function SendSampleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
      const now = new Date();
      const month = now.toLocaleString("en-US", { month: "short" });
      const day = String(now.getDate()).padStart(2, " ");
      const hms = now.toTimeString().slice(0, 8);
      const syslogTime = `${month} ${day} ${hms}`;

      const body = {
        ...sample.payload,
        event_time: now.toISOString(),
        raw_payload: sample.payload.raw_payload.replace("{TIME}", syslogTime),
      };

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          `${res.status} ${j.error ?? "ingest_failed"}${
            j.field ? ` (${j.field})` : ""
          }`
        );
      }

      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Sending..." : "Send sample event"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
