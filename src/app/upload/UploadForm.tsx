"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type LineResult = { ok: boolean };
type FileResult = {
  filename: string;
  total: number;
  succeeded: number;
  failed: number;
};

export default function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFilename, setCurrentFilename] = useState("");
  const [currentLine, setCurrentLine] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [done, setDone] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  function reset() {
    cancelRef.current = false;
    setRunning(false);
    setCurrentFileIndex(0);
    setTotalFiles(0);
    setCurrentFilename("");
    setCurrentLine(0);
    setTotalLines(0);
    setFileResults([]);
    setDone(false);
    setCancelled(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function parseLines(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
  }

  async function ingestLine(line: string, filename: string): Promise<LineResult> {
    const now = new Date().toISOString();
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "log_upload",
          event_time: now,
          raw_payload: line,
          source_label: filename,
        }),
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function handleUpload() {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;

    reset();
    cancelRef.current = false;
    setRunning(true);
    setDone(false);
    setCancelled(false);
    setTotalFiles(files.length);
    setFileResults([]);

    const allResults: FileResult[] = [];

    for (let f = 0; f < files.length; f++) {
      if (cancelRef.current) break;

      const file = files[f];
      setCurrentFileIndex(f + 1);
      setCurrentFilename(file.name);

      const text = await file.text();
      const lines = parseLines(text);
      setTotalLines(lines.length);
      setCurrentLine(0);

      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < lines.length; i++) {
        if (cancelRef.current) break;
        setCurrentLine(i + 1);
        const result = await ingestLine(lines[i], file.name);
        if (result.ok) succeeded++;
        else failed++;
        if (i < lines.length - 1) await sleep(600);
      }

      const fileResult: FileResult = {
        filename: file.name,
        total: lines.length,
        succeeded,
        failed,
      };
      allResults.push(fileResult);
      setFileResults([...allResults]);
    }

    setRunning(false);
    if (cancelRef.current) {
      setCancelled(true);
    } else {
      setDone(true);
    }
  }

  function handleCancel() {
    cancelRef.current = true;
  }

  const totalSucceeded = fileResults.reduce((s, r) => s + r.succeeded, 0);
  const totalFailed = fileResults.reduce((s, r) => s + r.failed, 0);
  const totalProcessed = fileResults.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      {!running && !done && !cancelled && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Select log files
            </label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".log,.txt,.csv"
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded file:border file:border-zinc-600 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Select one or more .log / .txt / .csv files. Each file is processed individually.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition"
          >
            Upload and ingest
          </button>
        </div>
      )}

      {running && (
        <div className="space-y-4">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 space-y-2">
            <p className="text-sm text-zinc-300">
              Processing file <span className="text-white font-medium">{currentFileIndex}</span> of{" "}
              <span className="text-white font-medium">{totalFiles}</span>:{" "}
              <span className="font-mono text-zinc-200">{currentFilename}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Line {currentLine} of {totalLines}
            </p>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-400 transition-all duration-300"
                style={{ width: totalLines > 0 ? (currentLine / totalLines) * 100 + "%" : "0%" }}
              />
            </div>
          </div>

          {fileResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Completed files</p>
              {fileResults.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
                  <span className="font-mono text-zinc-300">{r.filename}</span>
                  <span className="text-zinc-500">
                    <span className="text-emerald-400">{r.succeeded} ok</span>
                    {r.failed > 0 && <span className="text-red-400 ml-2">{r.failed} failed</span>}
                    <span className="ml-2 text-zinc-600">/ {r.total} lines</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {(done || cancelled) && (
        <div className="space-y-4">
          {cancelled && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Upload cancelled.
            </div>
          )}

          {done && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              All files processed — {totalSucceeded} lines ingested
              {totalFailed > 0 && <>, {totalFailed} failed</>}
              {" "}across {fileResults.length} file{fileResults.length === 1 ? "" : "s"}.
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">File summary</p>
            {fileResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs">
                <span className="font-mono text-zinc-300">{r.filename}</span>
                <span className="text-zinc-500">
                  <span className="text-emerald-400">{r.succeeded} ok</span>
                  {r.failed > 0 && <span className="text-red-400 ml-2">{r.failed} failed</span>}
                  <span className="ml-2 text-zinc-600">/ {r.total} lines</span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition"
            >
              Upload more files
            </button>
            <Link
              href="/"
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white transition"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}