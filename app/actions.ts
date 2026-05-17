"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  fetchDeployFailures,
  VercelAuthError,
  type DeployEvent,
} from "@/lib/vercel-api";
import {
  encodeSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type Installation,
  type Session,
} from "@/lib/session";

// Sign-in / Add-another-org both go through the same OAuth start route.
// The callback handles whether to create a new session or append to an
// existing one.
export async function signInWithVercel() {
  redirect("/api/auth/vercel/start");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}

// Fetches failed deployments across every installation in the session and
// merges them. Side effect: any installation whose access token comes back
// as auth-expired is pruned from the session cookie. This is how the app
// "auto-removes" installations after the user uninstalls them on Vercel.
export async function fetchEvents(
  limit: number
): Promise<{ events: DeployEvent[]; ok: boolean; authExpired: boolean }> {
  const session = await auth();
  if (!session || session.installations.length === 0) {
    return { events: [], ok: false, authExpired: true };
  }

  const n = session.installations.length;
  const perInstall = Math.max(1, Math.ceil(limit / n));

  type Result = {
    inst: Installation;
    events: DeployEvent[];
    authExpired: boolean;
  };
  const results: Result[] = await Promise.all(
    session.installations.map(async (inst) => {
      try {
        const events = await fetchDeployFailures({
          accessToken: inst.accessToken,
          teamId: inst.teamId,
          teamSlug: inst.teamSlug,
          limit: perInstall,
        });
        return { inst, events, authExpired: false };
      } catch (e) {
        if (e instanceof VercelAuthError) {
          console.warn(
            "fetchEvents: installation auth dead — pruning",
            { configurationId: inst.configurationId, teamId: inst.teamId }
          );
          return { inst, events: [], authExpired: true };
        }
        console.error(
          "fetchEvents: non-auth error on installation",
          { configurationId: inst.configurationId },
          e
        );
        return { inst, events: [], authExpired: false };
      }
    })
  );

  // Prune installations whose tokens are dead. This is the auto-cleanup
  // path after the user uninstalls from Vercel's dashboard.
  const liveInstallations = results
    .filter((r) => !r.authExpired)
    .map((r) => r.inst);
  if (liveInstallations.length < session.installations.length) {
    const cookieStore = await cookies();
    if (liveInstallations.length === 0) {
      cookieStore.delete(SESSION_COOKIE);
    } else {
      const next: Session = { ...session, installations: liveInstallations };
      cookieStore.set(SESSION_COOKIE, encodeSession(next), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
      });
    }
  }

  const allEvents = results.flatMap((r) => r.events);
  allEvents.sort((a, b) => (a.date < b.date ? 1 : -1));
  const trimmed = allEvents.slice(0, limit);

  // Surface "auth expired" only when EVERY installation is dead — i.e. the
  // session is now empty. A single rotting install just gets pruned.
  return {
    events: trimmed,
    ok: liveInstallations.length > 0,
    authExpired: liveInstallations.length === 0,
  };
}
