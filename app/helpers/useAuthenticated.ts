"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";

export function useAuthenticated() {
  const { data: session, status } = useSession();

  const authenticated =
    status === "authenticated" && typeof session?.user?.email === "string";

  return useMemo(
    () => ({
      isAuthenticated: { value: authenticated },
      email: {
        value: authenticated ? session?.user?.email ?? null : null,
      },
    }),
    [authenticated, session?.user?.email],
  );
}
