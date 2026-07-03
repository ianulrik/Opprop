// app/page.tsx
// ---------------------------------------------------------------
// FORSIDEN — det første folk ser på "/".
// Enkel velkomst med én knapp videre til påmelding.
// (Testlisten som hentet nivåer er fjernet nå som vi har bekreftet
//  at databasekoblingen fungerer.)
// ---------------------------------------------------------------

import Link from "next/link";

export default function Forside() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Svømmepartner</h1>

      <Link
        href="/pamelding"
        className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium"
      >
        Meld på svømmekurs
      </Link>
    </main>
  );
}