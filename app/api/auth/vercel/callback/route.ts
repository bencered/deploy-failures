import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  decodeSession,
  encodeSession,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  type Installation,
  type Session,
} from "@/lib/session";
import { fetchTeamSlug } from "@/lib/vercel-api";

// Vercel redirects here after the user installs the integration.
//
// Two modes:
//   - No existing session → create a new one with this single installation.
//   - Existing session → append this installation (or replace, if the user
//     re-installed the same configurationId).
//
// Steps:
//   1. Verify the state cookie (CSRF).
//   2. Exchange `code` for an access token.
//   3. Best-effort lookup of the team slug + username for display.
//   4. Merge into session and set the encrypted cookie.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const teamIdParam = url.searchParams.get("teamId");
  const configurationIdParam = url.searchParams.get("configurationId");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code) return error(origin, "missing_code");
  if (!configurationIdParam) return error(origin, "missing_configuration");
  if (!state || !expectedState) return error(origin, "state");
  const stateBuf = Buffer.from(state);
  const expectedBuf = Buffer.from(expectedState);
  if (
    stateBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(stateBuf, expectedBuf)
  ) {
    return error(origin, "state");
  }

  const clientId = process.env.VERCEL_CLIENT_ID;
  const clientSecret = process.env.VERCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("auth callback: VERCEL_CLIENT_ID/SECRET not set");
    return error(origin, "server");
  }

  const redirectUri = `${origin}/api/auth/vercel/callback`;
  const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    console.error("vercel token exchange failed", tokenRes.status, text);
    return error(origin, "exchange");
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
    installation_id?: string;
    user_id: string;
    team_id?: string | null;
  };

  const teamId = data.team_id ?? teamIdParam ?? null;
  const configurationId = data.installation_id ?? configurationIdParam;

  // Best-effort enrichment — neither failure is fatal.
  const [username, teamSlug] = await Promise.all([
    fetchUsername(data.access_token),
    fetchTeamSlug(data.access_token, teamId),
  ]);

  const newInstallation: Installation = {
    accessToken: data.access_token,
    teamId,
    teamSlug,
    userId: data.user_id,
    username,
    configurationId,
  };

  // Merge with any existing session so "Add another" works as append.
  const existing = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  const installations = mergeInstallation(existing?.installations ?? [], newInstallation);

  const session: Session = {
    installations,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };

  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return NextResponse.redirect(new URL("/", origin));
}

function mergeInstallation(
  existing: Installation[],
  next: Installation
): Installation[] {
  // If the user re-installs on the same scope (same configurationId),
  // replace the old entry — its access token has been invalidated.
  const out = existing.filter(
    (i) => i.configurationId !== next.configurationId
  );
  out.push(next);
  return out;
}

async function fetchUsername(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      user?: { username?: string; name?: string };
    };
    return body.user?.username ?? body.user?.name ?? null;
  } catch {
    return null;
  }
}

function error(origin: string, code: string) {
  return NextResponse.redirect(
    new URL(`/?auth_error=${encodeURIComponent(code)}`, origin)
  );
}
