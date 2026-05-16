"use server";

import { auth, signIn, signOut } from "@/auth";
import {
  fetchDeployFailures,
  GmailAuthError,
  type DeployEvent,
} from "@/lib/gmail-stats";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// Revokes the user's Gmail authorization with Google, then signs them out.
// We send the refresh token (not the access token) because Google's revoke
// endpoint, given a refresh token, invalidates both the refresh token AND
// every access token issued alongside it — full cleanup. The next sign-in
// will show the Google consent screen fresh.
export async function revokeAccessAction() {
  const session = await auth();
  const token = session?.refreshToken ?? session?.accessToken;
  if (token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
    } catch {
      // If Google is down or the token is already invalid, still sign the
      // user out below so the local session goes away.
    }
  }
  await signOut({ redirectTo: "/" });
}

// Single events fetcher used for both the fast initial paint (small limit)
// and the background "fill in everything else" pass (large limit). Client
// component drives both phases so the page itself renders instantly.
export async function fetchEvents(
  limit: number
): Promise<{ events: DeployEvent[]; ok: boolean; authExpired: boolean }> {
  const session = await auth();
  if (!session?.accessToken || session.error) {
    return { events: [], ok: false, authExpired: true };
  }
  try {
    const events = await fetchDeployFailures(session.accessToken, limit);
    return { events, ok: true, authExpired: false };
  } catch (e) {
    if (e instanceof GmailAuthError) {
      return { events: [], ok: false, authExpired: true };
    }
    return { events: [], ok: false, authExpired: false };
  }
}
