"use client";

import { useState, useRef } from "react";
import Link from "next/link";

type Status = "idle" | "uploading" | "done";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const cancelledRef = useRef(false);

  async function handleUpload() {
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    if (lines.length === 0) return;
    cancelledRef.current = false;
    setStatus("uploading");
    setTotal(lines.length);
    setCurrent(0);
    setSuccessCount(0);
    setFailureCount(0);
    let success = 0;
    let failure = 0;
    for (let i = 0; i < lines.length; i++) {
      if (cancelledRef.current) break;
      setCurrent(i + 1);
      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_payload: lines[i],
            source_type: "linux_auth",
            source_host: "uploaded",
          }),
        });
        if (res.ok) { success++; } else { failure++; }
      } catch {
        failure++;
      }
      setSuccessCount(success);
      setFailureCount(failure);
      if (i < lines.length - 1 && !cancelledRef.current) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    setStatus("done");
  }

  function handleCancel() { cancelledRef.current = true; }

  function handleReset() {
    setFile(null);
    setStatus("idle");
    setCurrent(0);
    setTotal(0);
    setSuccessCount(0);
    setFailureCount(0);
    cancelledRef.current = false;
  }

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200 transition">
          Back to queue
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Bulk Log Upload</h1>
      <p className="text-sm text-zinc-400 mb-8">
        Upload a .log or .txt file. Each line is ingested as a separate event with AI scoring.
        Lines starting with # are skipped.
      </p>

      {status === "idle" && (
        <div className="space-y-5">
          <div>
            <label htmlFor="logfile" className="block text-sm text-zinc-400 mb-2">
              Select file
            </label>
            <input
              id="logfile"
              type="file"
              accept=".log,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-800 file:text-zinc-200 file:text-sm file:cursor-pointer hover:file:bg-zinc-700 file:transition cursor-pointer"
            />
            {file && (
              <p className="mt-2 text-xs text-zinc-500">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={!file}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Upload and Ingest
          </button>
        </div>
      )}

      {status === "uploading" && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-300">Processing line {current} of {total}</span>
              <span className="text-sm text-zinc-500">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: pct + "%" }} />
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-400">{successCount} ingested</span>
            <span className="text-red-400">{failureCount} failed</span>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-5">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-5 py-4 space-y-2">
            <p className="text-sm font-medium text-zinc-200">Upload complete</p>
            <p className="text-sm text-zinc-400">
              {current} of {total} lines processed
              {cancelledRef.current && (
                <span className="ml-2 text-amber-400">(cancelled early)</span>
              )}
            </p>
            <div className="flex gap-4 text-sm pt-1">
              <span className="text-emerald-400">{successCount} ingested</span>
              <span className="text-red-400">{failureCount} failed</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition"
            >
              View queue
            </Link>
            <button
              onClick={handleReset}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
            >
              Upload another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}