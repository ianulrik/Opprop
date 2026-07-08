"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    // Ask Supabase Auth to sign the user in with email + password.
    // On success, the browser client stores the session in cookies, so later page loads know this trainer is logged in.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setSubmitting(false);
      // Supabase Auth returns English messages, translate to norwagian
      
      if (error.message === "Invalid login credentials") {
        setErrorMsg("Feil e-post eller passord. Prøv igjen.");
      } else if (error.message === "Email not confirmed") {
        setErrorMsg("E-posten er ikke bekreftet ennå.");
      } else {
        setErrorMsg("Innlogging feilet. Prøv igjen.");
      }
      return;
    }

    
    router.push("/trener");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Logg inn</h1>
      <p className="mt-2 text-gray-600">For trenere og administratorer.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            E-post
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Passord
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
          />
        </div>

        {errorMsg && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Logger inn…" : "Logg inn"}
        </button>
      </form>
    </main>
  );
}