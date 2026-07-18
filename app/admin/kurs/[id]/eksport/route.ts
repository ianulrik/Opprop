// app/admin/kurs/[id]/eksport/route.ts
// CSV export of a course's participant list.
//
// This is a Route Handler (route.ts, not page.tsx): it returns a FILE,
// not a web page. The browser downloads it when the admin clicks the
// export link.
//
// Deliberately "lean": name, birth date, guardian contact, and an
// attendance summary. No health info in a file that might be shared.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Turn one field into a safe CSV cell: wrap in quotes and escape any
// quotes inside. This keeps commas, quotes, and line breaks in names or
// addresses from breaking the file's columns.
function csvCell(value: string | number | null): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const supabase = await createClient();

  // Access control — same as the admin pages. A Route Handler is a
  // public endpoint, so we check the role here too. (RLS is the backstop.)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Ikke innlogget", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return new NextResponse("Ingen tilgang", { status: 403 });
  }

  // The course (for the filename and a sanity check via RLS).
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, start_date")
    .eq("id", courseId)
    .single();

  if (!course) {
    return new NextResponse("Fant ikke kurset", { status: 404 });
  }

  // How many sessions does this course have? (The "Y" in "X av Y".)
  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  const totalSessions = sessionCount ?? 0;

  // Active participants, with the fields we want to export.
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select(
      "swimmers ( id, first_name, last_name, birth_date, guardian_name, guardian_email, guardian_phone )"
    )
    .eq("course_id", courseId)
    .eq("status", "active");

  type Swimmer = {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    guardian_name: string;
    guardian_email: string;
    guardian_phone: string;
  };

  const swimmers = (enrollmentsData ?? [])
    .map((row) => row.swimmers as unknown as Swimmer)
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "nb"));

  // Attendance: count each swimmer's "present" rows for this course's
  // sessions. We fetch all present-rows joined to this course's sessions,
  // then tally per swimmer.
  const { data: attendanceData } = await supabase
    .from("attendance")
    .select("swimmer_id, status, sessions!inner ( course_id )")
    .eq("sessions.course_id", courseId)
    .eq("status", "present");

  // Tally: swimmer_id -> number of present sessions.
  const presentCount = new Map<string, number>();
  for (const row of attendanceData ?? []) {
    presentCount.set(
      row.swimmer_id,
      (presentCount.get(row.swimmer_id) ?? 0) + 1
    );
  }

  // Build the CSV. First the header row, then one row per swimmer.
  const header = [
    "Fornavn",
    "Etternavn",
    "Fødselsdato",
    "Foresatt",
    "Foresatt e-post",
    "Foresatt telefon",
    "Oppmøte",
  ];

  const rows = swimmers.map((s) => {
    const present = presentCount.get(s.id) ?? 0;
    return [
      csvCell(s.first_name),
      csvCell(s.last_name),
      csvCell(s.birth_date),
      csvCell(s.guardian_name),
      csvCell(s.guardian_email),
      csvCell(s.guardian_phone),
      csvCell(`${present} av ${totalSessions}`),
    ].join(",");
  });

  // A BOM (\uFEFF) at the start tells Excel the file is UTF-8, so
  // Norwegian characters (æ, ø, å) display correctly.
  const csv =
    "\uFEFF" +
    [header.map(csvCell).join(","), ...rows].join("\r\n");

  // Build a safe filename from the course name.
  const safeName = course.name.replace(/[^a-z0-9æøå]/gi, "_").toLowerCase();
  const filename = `deltakerliste_${safeName}_${course.start_date}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // "attachment" makes the browser download rather than display it.
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}