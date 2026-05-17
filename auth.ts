import { cache } from "react";
import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE, type Session } from "@/lib/session";

// Server-side session read. Wrapped in React's cache() so a single request
// (page + Suspense child + server action) doesn't pay for repeated cookie
// parses + signature checks.
export const auth = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
});
