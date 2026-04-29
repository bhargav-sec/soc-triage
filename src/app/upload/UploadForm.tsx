"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Status = "idle" | "uploading" | "done" | "cancelled";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  async function handleUpload() {
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    cancelledRef.current = false;
    setStatus("uploading");
    setTotal(lines.length);
    setCurrent(0);
    setSuccessCount(0);
    setFailureCount(0);
    setLastError(null);

    let success = 0;
    let failure = 0;

    for (let i = 0; i < lines.length; i++) {
      if (cancelledRef.current) {
        setStatus("cancelled");
        return;
      }
      setCurrent(i + 1);

      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_payload: lines[i],
            source_type: "linux_auth",
            source_host: "uploaded",
            event_time: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          success++;
        } else {
          failure++;
          if (!lastError) {
            try {
              const errBody = await res.json();
              setLastError("HTTP " + res.status + ": " + JSON.stringify(errBody));
            } catch {
              setLastError("HTTP " + res.status + " (no body)");
            }
          }
        }
      } catch (err) {
        failure++;
        if (!lastError) {
          setLastError("Fetch error: " + (err instanceof Error ? err.message : String(err)));
        }
      }
      setSuccessCount(success);
      setFailureCount(failure);
      if (i < lines.length - 1 && !cancelledRef.current) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setStatus("done");
  }

  function handleCancel() {
    cancelledRef.current = true;
  }

  function reset() {
    setFile(null);
    setStatus("idle");
    setCurrent(0);
    setTotal(0);
    setSuccessCount(0);
    setFailureCount(0);
    setLastError(null);
    cancelledRef.current = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          &larr; Back to queue
        </Link>
      </div>

      <header className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bulk Log Upload</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload a .log or .txt file. Each line is ingested as a separate event with AI scoring. Lines starting with # are skipped.
        </p>
      </header>

      {status === "idle" && (
        <div className="space-y-4">
          <input
            type="file"
            accept=".log,.txt,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-zinc-200 file:hover:bg-zinc-800"
          />
          {file && (
            <div className="text-xs text-zinc-500">
              Selected: <span className="text-zinc-300">{file.name}</span> ({Math.round(file.size / 1024)} KB)
            </div>
          )}
          <button
            type="button"
            disabled={!file}
            onClick={handleUpload}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      )}

      {status === "uploading" && (
        <div className="space-y-3">
          <div className="text-sm text-zinc-300">
            Processing line {current} of {total}...
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-900">
            <div
              className="h-full bg-emerald-500/60 transition-all"
              style={{ width: total > 0 ? (current / total) * 100 + "%" : "0%" }}
            />
          </div>
          <div className="text-xs text-zinc-500">
            {successCount} ingested · {failureCount} failed
          </div>
          {lastError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              First error: {lastError}
            </div>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20"
          >
            Cancel
          </button>
        </div>
      )}

      {(status === "done" || status === "cancelled") && (
        <div className="space-y-3">
          <div className="text-sm text-zinc-300">
            {status === "done" ? "Upload complete" : "Upload cancelled"}
          </div>
          <div className="text-xs text-zinc-500">
            {current} of {total} lines processed
          </div>
          <div className="text-xs text-zinc-400">
            <span className="text-emerald-300">{successCount} ingested</span> ·{" "}
            <span className="text-red-300">{failureCount} failed</span>
          </div>
          {lastError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              First error: {lastError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Upload another file
            </button>
            <Link
              href="/"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Back to queue
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}