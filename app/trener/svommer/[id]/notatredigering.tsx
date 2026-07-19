"use client";

// Client component: an editable notes box with a save button.
// It receives the swimmer's id and current note as props from the
// server page, keeps the text in local state while editing, and calls
// the updateNotes server action when the user saves.

import { useState } from "react";
import { updateNotes } from "./actions";

type Props = {
  swimmerId: string;
  initialNotes: string | null;
};

export default function NotatRedigering({ swimmerId, initialNotes }: Props) {
  // The text currently in the box. Starts as whatever was saved (or "").
  const [notes, setNotes] = useState(initialNotes ?? "");

  // "idle" = nothing happening, "saving" = request in flight,
  // "saved" = just saved OK, "error" = something failed.
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  // Called when the user clicks "Lagre".
  async function handleSave() {
    setStatus("saving");
    const result = await updateNotes(swimmerId, notes);

    if (result?.error) {
      setStatus("error");
    } else {
      setStatus("saved");
      // Clear the "Lagret" message after a couple of seconds.
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="mt-1">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Skriv et notat om svømmeren..."
        className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-blue-500 focus:outline-none"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {status === "saving" ? "Lagrer..." : "Lagre notat"}
        </button>

        {/* Small status messages next to the button */}
        {status === "saved" && (
          <span className="text-sm text-green-700">Lagret</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-700">
            Kunne ikke lagre. Prøv igjen.
          </span>
        )}
      </div>
    </div>
  );
}