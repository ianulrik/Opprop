// app/admin/NyttKursSkjema.tsx
// The "create course" form.
//
// No "use client" — this is a plain HTML form whose action points at our
// Server Action. That means no client-side JavaScript is needed for it
// to work, and we don't need useState for every field.
//
// It receives the list of trainers from the page, for the dropdown.

import { createCourse } from "./actions";

type Trainer = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function NyttKursSkjema({ trainers }: { trainers: Trainer[] }) {
  return (
    <form action={createCourse} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Kursnavn
        </label>
        <input
          type="text"
          name="name"
          required
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          placeholder="F.eks. Nybegynner tirsdag"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">Sted</label>
        <input
          type="text"
          name="location"
          required
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          placeholder="F.eks. Fredrikstad svømmehall"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Startdato
          </label>
          <input
            type="date"
            name="start_date"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
          <p className="mt-1 text-xs text-gray-500">
            De 10 øktene lages automatisk, én uke fra hverandre.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Klokkeslett
          </label>
          <input
            type="time"
            name="start_time"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Maks deltakere
          </label>
          <input
            type="number"
            name="max_participants"
            required
            min={1}
            defaultValue={12}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Trener <span className="text-gray-500">(valgfritt)</span>
          </label>
          <select
            name="trainer_id"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          >
            <option value="">Ikke tildelt ennå</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {/* Fall back to email if the profile has no name yet */}
                {t.full_name || t.email || "Uten navn"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >
        Opprett kurs
      </button>
    </form>
  );
}