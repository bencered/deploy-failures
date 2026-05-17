import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

// POST only — GET would let any third-party page sign the user out via
// <img src=".../signout">. The sign-out form already POSTs.
export async function POST(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/", req.url), 303);
}
