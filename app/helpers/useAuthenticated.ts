"use client";

import { useSession } from "next-auth/react";
import { signal } from "@preact/signals";

export function useAuthenticated() {
  const { data: session, status } = useSession();

  const isAuthenticated = signal(
    status === "authenticated" && !!session?.user?.email
  );

  const email = signal(isAuthenticated.value ? session?.user?.email : null);

  return { isAuthenticated, email };
}
