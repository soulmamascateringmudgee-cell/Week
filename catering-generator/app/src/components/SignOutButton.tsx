"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client.ts";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="linklike" onClick={() => void signOut()}>
      Sign out
    </button>
  );
}
