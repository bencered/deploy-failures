import { cache } from "react";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

async function refreshGoogleToken(refreshToken: string) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET not set");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`google refresh failed: ${res.status}`);
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
}

const nextAuth = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: `openid email profile ${GMAIL_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: capture tokens from the OAuth response.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // Subsequent requests: refresh if the access token is near expiry.
      const expiresAt = token.expiresAt ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) return token;

      if (!token.refreshToken) {
        token.error = "RefreshTokenMissing";
        return token;
      }

      try {
        const fresh = await refreshGoogleToken(token.refreshToken);
        token.accessToken = fresh.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + fresh.expires_in;
        // Google may issue a new refresh token; keep the old one if not.
        if (fresh.refresh_token) token.refreshToken = fresh.refresh_token;
        delete token.error;
      } catch {
        token.error = "RefreshFailed";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      // Exposed so the /revoke action can call Google's revocation endpoint
      // with the refresh token (which also revokes all access tokens issued
      // alongside it — full cleanup).
      session.refreshToken = token.refreshToken;
      session.error = token.error;
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;
// Dedupe zero-arg `auth()` calls within a single request — important so that
// the page and the Suspense child don't both trigger a token refresh. Only the
// zero-arg overload is wrapped so the other overloads remain available if
// needed later (middleware, route handler wrapping, etc).
export const auth = cache(() => nextAuth.auth());
