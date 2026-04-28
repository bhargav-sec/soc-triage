"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "investigating" | "true_positive" | "false_positive";

const STATUSES: Status[] = ["open", "investigating", "true_positive", "false_positive"];

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  investigating: "Investigating",
  true_positive: "True positive",
  false_positive: "False positive",
};

function statusButtonClass(status: Status, isActive: boolean): string {
  if (isActive) {
    switch (status) {
      case "open":           return "bg-sky-500/30 text-sky-200 border-sky-500/60";
      case "investigating":  return "bg-amber-500/30 text-amber-200 border-amber-500/60";
      case "true_positive":  return "bg-emerald-500/30 text-emerald-200 border-emerald-500/60";
      case "false_positive": return "bg-zinc-600/40 text-zinc-200 border-zinc-500/60";
    }
  }
  return "bg-zinc-900/60 text-zinc-400 border-zinc-700 hover:bg-zinc-800";
}

type Props = {
  investigationId: string;
  initialStatus: Status;
  initialNotes: string;
};

export default function InvestigationControls({ investigationId, initialStatus, initialNotes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [notes, setNotes] = useState<string>(initialNotes);
  const [savedNotes, setSavedNotes] = useState<string>(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);

  async function patchInvestigation(payload: { notes?: string; status?: Status }) {
    const res = await fetch("/api/investigations/" + investigationId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Update failed");
    }
    return data;
  }

  async function handleNotesBlur() {
    if (notes === savedNotes) return;
    setError(null);
    setSavingNotes(true);
    try {
      await patchInvestigation({ notes });
      setSavedNotes(notes);
      setNotesSavedAt(Date.now());
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleStatusChange(newStatus: Status) {
    if (newStatus === status) return;
    setError(null);
    const isClosing = newStatus === "true_positive" || newStatus === "false_positive";
    if (isClosing && (notes.trim().length === 0)) {
      setError("A note is required before closing the investigation.");
      return;
    }
    try {
      const payload: { status: Status; notes?: string } = { status: newStatus };
      if (notes !== savedNotes) {
        payload.notes = notes;
      }
      await patchInvestigation(payload);
      setStatus(newStatus);
      if (notes !== savedNotes) setSavedNotes(notes);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  const notesDirty = notes !== savedNotes;
  const recentlySaved = notesSavedAt !== null && Date.now() - notesSavedAt < 3000;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Notes</h2>
          <span className="text-xs text-zinc-500">
            {savingNotes && "Saving..."}
            {!savingNotes && notesDirty && "Unsaved changes"}
            {!savingNotes && !notesDirty && recentlySaved && "Saved"}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="What did you find? What did you do?"
          rows={5}
          className="mt-2 w-full rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Status</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange(s)}
              className={"rounded border px-3 py-1.5 text-sm transition disabled:opacity-50 " + statusButtonClass(s, s === status)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Closing as true positive or false positive requires a note.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}