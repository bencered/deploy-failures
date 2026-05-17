import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_STATE_COOKIE } from "@/lib/session";

// Kicks off the Vercel OAuth install flow. We generate a random `state`,
// stash it in an httpOnly cookie, and redirect the user to Vercel's
// integration install URL. Vercel echoes `state` back in the callback so
// we can verify CSRF.
export async function GET() {
  const slug = process.env.VERCEL_INTEGRATION_SLUG;
  if (!slug) {
    return new NextResponse(
      "VERCEL_INTEGRATION_SLUG is not set. Create an integration at " +
        "https://vercel.com/dashboard/integrations/console and add its URL slug to .env.local.",
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  const installUrl = `https://vercel.com/integrations/${slug}/new?state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(installUrl);
}
