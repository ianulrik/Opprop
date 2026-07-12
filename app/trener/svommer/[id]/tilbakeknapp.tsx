// app/trener/svommer/[id]/TilbakeKnapp.tsx
// A small "back" button that returns to wherever the user came from
// (mirrors the browser's back button). Client component because
// navigating through history happens in the browser.

"use client";

import { useRouter } from "next/navigation";

export default function TilbakeKnapp() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      ← Tilbake
    </button>
  );
}