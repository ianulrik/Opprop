// It receives the swimmers (with their already-recorded status for this
// session) from the page, and lets the trainer tap to set each one to
// "present" or "absent". Updates feel instant: we change the screen
// immediately (optimistic), then save to the database in the background.

"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";


// The status values our app uses. (bruker ikke excused)
type Status = "present" | "absent";

type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  status: Status | "excused" | null; // may arrive as excused/null from the database
};

export default function OppmoteListe({
  sessionId,
  swimmers: initialSwimmers,
  recordedBy,
}: {
  sessionId: string;
  swimmers: Swimmer[];
  recordedBy: string; // the logged-in trainer's id, for the audit trail
})  

{
  const supabase = createClient();

  // We keep the list in state so we can update it instantly on tap.
  const [swimmers, setSwimmers] = useState<Swimmer[]>(initialSwimmers);

  // Tracks which swimmer rows are currently mid-save, so we can show a
  // subtle "saving" hint and avoid double-taps racing each other.
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Tracks any swimmer whose save just failed, so we can flag it.
  const [failed, setFailed] = useState<Set<string>>(new Set());

  async function setStatus(swimmerId: string, newStatus: Status) {
    // Remember the old status so we can roll back if the save fails.
    const previous = swimmers.find((s) => s.id === swimmerId)?.status ?? null;

    // 1. OPTIMISTIC UPDATE: change the screen right away.
    setSwimmers((list) =>
      list.map((s) => (s.id === swimmerId ? { ...s, status: newStatus } : s))
    );
    // Mark this row as saving, and clear any earlier failure on it.
    setSaving((set) => new Set(set).add(swimmerId));
    setFailed((set) => {
      const next = new Set(set);
      next.delete(swimmerId);
      return next;
    });

    //    SAVE in the background. upsert = insert, or update if a row for
    //    this (session_id, swimmer_id) already exists. The unique index
    //    on those two columns is what makes this safe — we never create
    //    duplicates, we just overwrite the status.
    const { error } = await supabase.from("attendance").upsert(
      {
        session_id: sessionId,
        swimmer_id: swimmerId,
        status: newStatus,
        recorded_by: recordedBy,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: "session_id,swimmer_id" }
    );

    //   Done saving (whether it worked or not), so drop the saving mark.
    setSaving((set) => {
      const next = new Set(set);
      next.delete(swimmerId);
      return next;
    });

    if (error) {
      // ROLL BACK: put the old status back and flag the failure.
      setSwimmers((list) =>
        list.map((s) => (s.id === swimmerId ? { ...s, status: previous } : s))
      );
      setFailed((set) => new Set(set).add(swimmerId));
    }
  }

  return (
    <ul className="mt-8 space-y-3">
      {swimmers.map((swimmer) => {
        const isSaving = saving.has(swimmer.id);
        const didFail = failed.has(swimmer.id);

        return (
          <li
            key={swimmer.id}
            className="rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/trener/svommer/${swimmer.id}`}
                className="text-xl font-medium text-gray-900 hover:underline"
              >
                {swimmer.first_name} {swimmer.last_name}
              </Link>

              {/* The two big tap targets.
                  IMPORTANT: each full class string is written out
                  completely (not assembled from pieces), so Tailwind's
                  build-time scanner sees them and generates the CSS. */}
              <div className="flex gap-2">
                {/* Til stede */}
                <button
                  type="button"
                  onClick={() => setStatus(swimmer.id, "present")}
                  className={
                    swimmer.status === "present"
                      ? "rounded-lg px-5 py-4 text-base font-medium bg-green-600 text-white"
                      : "rounded-lg px-5 py-4 text-base font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }
                >
                  Til stede
                </button>

                {/* Ikke til stede (Borte) */}
                <button
                  type="button"
                  onClick={() => setStatus(swimmer.id, "absent")}
                  className={
                    swimmer.status === "absent"
                      ? "rounded-lg px-5 py-4 text-base font-medium bg-red-600 text-white"
                      : "rounded-lg px-5 py-4 text-base font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }
                >
                  Borte
                </button>
              </div>
            </div>

            {/* Small status hints under the row */}
            {isSaving && (
              <p className="mt-2 text-right text-xs text-gray-400">Lagrer…</p>
            )}
            {didFail && (
              <p className="mt-2 text-right text-xs text-red-600">
                Kunne ikke lagre. Prøv igjen.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}