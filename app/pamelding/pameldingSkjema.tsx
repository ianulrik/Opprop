
// "use client" means this runs in the browser, so it can react to
// typing and handle form submission. It receives the course list as a
// prop from the page, and submits via the public_enroll RPC.

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// One course, as returned by public_active_courses(). Same shape the
// page uses; we only need a few fields here.
type Course = {
  id: string;
  name: string;
  spots_left: number;
};

// What public_enroll() gives back on success.
type EnrollResult = {
  swimmer_id: string;
  status: "active" | "waitlist";
  course_name: string;
};

export default function PameldingSkjema({ courses }: { courses: Course[] }) {
  const supabase = createClient();

  // --- Form fields (one piece of state each, for clarity) ---
  const [courseId, setCourseId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [swimLevel, setSwimLevel] = useState("");
  const [healthInfo, setHealthInfo] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);

  // --- UI state ---
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<EnrollResult | null>(null);

  // Runs when the user submits the form.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page
    setErrorMsg(null);
    setSubmitting(true);

    // Call the RPC. The keys here MUST match the p_* parameter names
    // exactly. Empty optional fields are sent as null (|| null turns
    // "" into null); required fields are guarded by the inputs below.
    const { data, error } = await supabase.rpc("public_enroll", {
      p_course_id: courseId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_birth_date: birthDate,
      p_swim_level: swimLevel || null,
      p_health_info: healthInfo || null,
      p_guardian_name: guardianName,
      p_guardian_email: guardianEmail,
      p_guardian_phone: guardianPhone,
      p_gdpr_consent: gdprConsent,
    });

    setSubmitting(false);

    if (error) {
      // The DB raises Norwegian messages (e.g. "GDPR-samtykke kreves"),
      // so we can show error.message directly.
      setErrorMsg(error.message);
      return;
    }

    // Success: data is the JSON object { swimmer_id, status, course_name }.
    setResult(data as EnrollResult);
  }

  // --- Confirmation screen (shown after a successful submit) ---
  if (result) {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        {result.status === "active" ? (
          <p className="text-green-700">
            <strong>{firstName}</strong> er nå påmeldt {result.course_name}. Vi
            gleder oss til å se dere!
          </p>
        ) : (
          <p className="text-amber-700">
            {result.course_name} er dessverre fullt. <strong>{firstName}</strong>{" "}
            står nå på venteliste, og vi tar kontakt hvis det blir ledig plass.
          </p>
        )}
      </div>
    );
  }

  // --- The form ---
  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {/* Course selection */}
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Kurs
        </label>
        <select
          required
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        >
          <option value="" disabled>
            Velg kurs
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name} —{" "}
              {course.spots_left > 0
                ? `${course.spots_left} ledige`
                : "fullt (venteliste)"}
            </option>
          ))}
        </select>
      </div>

      {/* Child: first + last name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Barnets fornavn
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Barnets etternavn
          </label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
      </div>

      {/* Child: birth date */}
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Fødselsdato
        </label>
        <input
          type="date"
          required
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
      </div>

      {/* Child: swim level (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Svømmenivå <span className="text-gray-500">(valgfritt)</span>
        </label>
        <select
          value={swimLevel}
          onChange={(e) => setSwimLevel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        >
          <option value="">Vet ikke / ikke sikker</option>
          <option value="Nybegynner">Nybegynner</option>
          <option value="Litt øvet">Litt øvet</option>
          <option value="Øvet">Øvet</option>
        </select>
      </div>

      {/* Child: health / allergy (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Helse / allergier <span className="text-gray-500">(valgfritt)</span>
        </label>
        <textarea
          rows={3}
          value={healthInfo}
          onChange={(e) => setHealthInfo(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          placeholder="F.eks. astma, allergier, eller annet vi bør vite om."
        />
      </div>

      {/* Guardian: name */}
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Foresattes navn
        </label>
        <input
          type="text"
          required
          value={guardianName}
          onChange={(e) => setGuardianName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 p-2"
        />
      </div>

      {/* Guardian: email + phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Foresattes e-post
          </label>
          <input
            type="email"
            required
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Foresattes telefon
          </label>
          <input
            type="tel"
            required
            value={guardianPhone}
            onChange={(e) => setGuardianPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>
      </div>

      {/* GDPR consent */}
      <div className="flex items-start gap-2">
        <input
          id="gdpr"
          type="checkbox"
          required
          checked={gdprConsent}
          onChange={(e) => setGdprConsent(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="gdpr" className="text-sm text-gray-700">
          Jeg samtykker til at svømmeklubben lagrer disse opplysningene for å
          administrere kurset.
        </label>
      </div>

      {/* Error message, if any */}
      {errorMsg && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Sender…" : "Meld på"}
      </button>
    </form>
  );
}