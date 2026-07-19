
// Server Component. Shows everything about one swimmer: base data, guardian, health, GDPR, enrolled courses, and earned badges.

// This page shows SENSITIVE data (health, contact info). RLS ensures
// only the swimmer's trainer (or an admin) can load it — but be mindful
// it's not a page to leave open on a poolside screen.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TilbakeKnapp from "./tilbakeknapp";
import NotatRedigering from "./notatredigering";

// --- Types for the data we fetch ---

type Swimmer = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  swim_level: string | null;
  health_info: string | null;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  gdpr_consent: boolean;
  gdpr_consent_at: string | null;
  notes: string | null;
};

// An enrollment row with its course pulled in.
type EnrollmentRow = {
  status: "active" | "waitlist" | "cancelled";
  courses: { id: string; name: string } | null;
};

// A badge row with the badge name pulled in.
type BadgeRow = {
  id: string;
  awarded_date: string;
  badges: { name: string } | null;
};

// --- Formatting helpers ---

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Age from birth date, for a quick reference next to the date.
function calculateAge(birthDateStr: string): number {
  const [y, m, d] = birthDateStr.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  // Haven't had this year's birthday yet? Subtract one.
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Norwegian label for an enrollment status.
function statusLabel(status: string): string {
  if (status === "active") return "Aktiv";
  if (status === "waitlist") return "Venteliste";
  if (status === "cancelled") return "Avmeldt";
  return status;
}

// --- The page ---

export default async function SvommerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: swimmerId } = await params;
  const supabase = await createClient();

  // Confirm login (middleware already gated this route).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/trener/login");

  // 1. The swimmer. RLS returns nothing if this trainer isn't allowed to see them -> 404.
  const { data: swimmer } = await supabase
    .from("swimmers")
    .select(
      "id, first_name, last_name, birth_date, swim_level, health_info, guardian_name, guardian_email, guardian_phone, gdpr_consent, gdpr_consent_at, notes"
    )
    .eq("id", swimmerId)
    .single();

  if (!swimmer) notFound();
  const s = swimmer as Swimmer;

  // 2. Enrolled courses (with the course name via the FK).
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("status, courses ( id, name )")
    .eq("swimmer_id", swimmerId);

  const enrollments = (enrollmentsData ?? []) as unknown as EnrollmentRow[];

  // 3. Earned badges (with the badge name via the FK), newest first.
  const { data: badgesData } = await supabase
    .from("swimmer_badges")
    .select("id, awarded_date, badges ( name )")
    .eq("swimmer_id", swimmerId)
    .order("awarded_date", { ascending: false });

  const badges = (badgesData ?? []) as unknown as BadgeRow[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <TilbakeKnapp />

      {/* Name + age */}
      <h1 className="mt-4 text-3xl font-bold text-gray-900">
        {s.first_name} {s.last_name}
      </h1>
      <p className="mt-1 text-gray-600">
        Født {formatDate(s.birth_date)} ({calculateAge(s.birth_date)} år)
      </p>

      {/* Swim level */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Svømmenivå
        </h2>
        <p className="mt-1 text-gray-900">
          {s.swim_level || "Ikke registrert"}
        </p>
      </section>

      {/* Health info — highlighted, since it's safety-relevant */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Helse / allergier
        </h2>
        {s.health_info ? (
          <p className="mt-1 rounded-lg bg-amber-50 p-3 text-amber-900">
            {s.health_info}
          </p>
        ) : (
          <p className="mt-1 text-gray-500">Ingen registrert</p>
        )}
      </section>

     {/* Guardian */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Foresatt
        </h2>
        <p className="mt-1 text-gray-900">{s.guardian_name}</p>
        <p className="text-gray-600">
          <a
            href={`mailto:${s.guardian_email}`}
            className="text-blue-600 hover:underline"
          >
            {s.guardian_email}
          </a>
        </p>
        <p className="text-gray-600">
          <a
            href={`tel:${s.guardian_phone}`}
            className="text-blue-600 hover:underline"
          >
            {s.guardian_phone}
          </a>
        </p>
      </section>

      {/* Enrolled courses */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Påmeldte kurs
        </h2>
        {enrollments.length === 0 ? (
          <p className="mt-1 text-gray-500">Ingen påmeldinger</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {enrollments.map((e, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <span className="text-gray-900">
                  {e.courses?.name ?? "Ukjent kurs"}
                </span>
                <span className="text-sm text-gray-600">
                  {statusLabel(e.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Badges */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Merker
        </h2>
        {badges.length === 0 ? (
          <p className="mt-1 text-gray-500">Ingen merker ennå</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {badges.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <span className="text-gray-900">
                  {b.badges?.name ?? "Ukjent merke"}
                </span>
                <span className="text-sm text-gray-600">
                  {formatDate(b.awarded_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Notater
        </h2>
        <NotatRedigering swimmerId={s.id} initialNotes={s.notes} />
      </section>

      {/* GDPR */}
      <section className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          {s.gdpr_consent
            ? `Samtykke gitt${
                s.gdpr_consent_at
                  ? " " + formatDate(s.gdpr_consent_at.slice(0, 10))
                  : ""
              }`
            : "Samtykke ikke registrert"}
        </p>
      </section>
    </main>
  );
}